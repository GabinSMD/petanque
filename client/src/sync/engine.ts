import type { EntityType } from '@shared';
import { db, getMeta, setMeta, wipeLocalData, type EntityRecord } from '../db/local';
import { ApiError, postJson } from '../lib/api';
import { getDeviceId, getSession } from '../lib/session';

export type SyncStatus = 'idle' | 'guest' | 'offline' | 'syncing' | 'synced' | 'error' | 'auth';

interface ServerChange {
  type: EntityType;
  id: string;
  data: Record<string, unknown> | null;
  updatedAt: string;
  deleted: 0 | 1;
  seq: number;
}

interface SyncResult {
  cursor: number;
  hasMore: boolean;
  accepted: string[];
  changes: ServerChange[];
}

let status: SyncStatus = 'idle';
let lastSyncAt: string | null = null;
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus): void {
  if (status === next) return;
  status = next;
  for (const fn of listeners) fn();
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function getLastSyncAt(): string | null {
  return lastSyncAt;
}

export function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------------------------------------------ */
/* Boucle de synchronisation                                           */
/* ------------------------------------------------------------------ */

let syncing = false;
let pendingRun = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Déclenche une synchronisation prochaine (après une écriture locale). */
export function scheduleSync(delayMs = 1200): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, delayMs);
}

/**
 * Pousse les modifications locales puis récupère celles du serveur.
 * Sans réseau l'application reste pleinement fonctionnelle : tout est
 * rejoué à la reconnexion.
 */
export async function syncNow(): Promise<void> {
  const session = getSession();
  if (!session) {
    setStatus('idle');
    return;
  }
  if (session.guest) {
    // Mode invité : tout reste local. Les entités gardent dirty=1, si bien
    // qu'un rattachement ultérieur à un compte pousse tout d'un coup.
    setStatus('guest');
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setStatus('offline');
    return;
  }
  if (syncing) {
    pendingRun = true;
    return;
  }
  syncing = true;
  setStatus('syncing');
  try {
    // La base locale appartient à une organisation : purge si changement.
    const localOrg = await getMeta<string>('orgId');
    if (localOrg && localOrg !== session.org.id) {
      await wipeLocalData();
    }
    await setMeta('orgId', session.org.id);

    const deviceId = getDeviceId();
    for (let loop = 0; loop < 20; loop++) {
      const dirty = await db.entities.where('dirty').equals(1).limit(800).toArray();
      const cursor = (await getMeta<number>('cursor')) ?? 0;

      const res = await postJson<SyncResult>('/api/sync', {
        cursor,
        deviceId,
        changes: dirty.map((r) => ({
          type: r.type,
          id: r.id,
          data: r.deleted ? null : r.data,
          updatedAt: r.updatedAt,
          deleted: r.deleted,
          deviceId,
        })),
      });

      await db.transaction('rw', db.entities, async () => {
        // 1. Applique les changements du serveur (dernier-écrivain-gagnant).
        for (const ch of res.changes) {
          const local = await db.entities.get([ch.type, ch.id]);
          const wins =
            !local ||
            ch.updatedAt > local.updatedAt ||
            (ch.updatedAt === local.updatedAt && local.dirty === 0);
          if (!wins) continue;
          const record: EntityRecord = {
            type: ch.type,
            id: ch.id,
            concoursId:
              (ch.data?.concoursId as string | undefined) ??
              (ch.type === 'concours' ? ch.id : (local?.concoursId ?? '')),
            data: ch.deleted ? null : (ch.data as EntityRecord['data']),
            updatedAt: ch.updatedAt,
            deleted: ch.deleted ? 1 : 0,
            dirty: 0,
          };
          await db.entities.put(record);
        }
        // 2. Acquitte les envois restés inchangés depuis leur lecture.
        for (const rec of dirty) {
          const cur = await db.entities.get([rec.type, rec.id]);
          if (cur && cur.dirty === 1 && cur.updatedAt === rec.updatedAt) {
            await db.entities.put({ ...cur, dirty: 0 });
          }
        }
      });
      await setMeta('cursor', res.cursor);

      const remaining = await db.entities.where('dirty').equals(1).count();
      if (!res.hasMore && remaining === 0) break;
    }
    lastSyncAt = new Date().toISOString();
    setStatus('synced');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      setStatus('auth');
    } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
    } else {
      setStatus('error');
    }
  } finally {
    syncing = false;
    if (pendingRun) {
      pendingRun = false;
      scheduleSync(300);
    }
  }
}

let loopStarted = false;

/** Écouteurs réseau + synchronisation périodique. À appeler une fois. */
export function startSyncLoop(): void {
  if (loopStarted) return;
  loopStarted = true;
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => setStatus('offline'));
  window.setInterval(() => void syncNow(), 30_000);
  void syncNow();
}
