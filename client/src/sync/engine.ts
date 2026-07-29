import type { EntityType } from '@shared';
import { db, getMeta, setMeta, wipeLocalData, type EntityRecord } from '../db/local';
import { ApiError, postJson } from '../lib/api';
import {
  ajouterEcart,
  bilanEnAttente,
  changementApplicable,
  changementGagne,
  cleEntite,
  decisionChangementOrg,
  envoisAcquittes,
  type BilanEnAttente,
  type DonneeEcartee,
} from '@shared';
import { getDeviceId, getSession } from '../lib/session';

export type SyncStatus =
  | 'idle'
  | 'guest'
  | 'offline'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'auth'
  /**
   * Des données non envoyées d'un autre compte sont sur cet appareil : la
   * synchronisation est suspendue plutôt que de les effacer (§
   * `decisionChangementOrg`). L'organisateur tranche.
   */
  | 'protege';

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

/**
 * Données reçues du serveur mais inexploitables (§ `changementApplicable`).
 *
 * Elles sont retenues et affichées : les refuser en silence laissait
 * l'organisateur devant onze équipes ici et douze là-bas, sans explication —
 * et devant la tentation de ressaisir ce qui existe déjà ailleurs. La liste est
 * enregistrée dans `meta`, donc elle survit à un rechargement : l'écart ne se
 * produit pas forcément sous les yeux de quelqu'un.
 */
let ecartees: DonneeEcartee[] = [];

export function getDonneesEcartees(): DonneeEcartee[] {
  return ecartees;
}

/**
 * Bilan des modifications non envoyées qui appartiennent à un autre compte.
 *
 * Renseigné quand la synchronisation refuse de purger la base : c'est ce qui
 * permet à l'écran de dire quoi est en jeu, et de proposer une sauvegarde avant
 * d'effacer. `null` le reste du temps.
 */
let protection: BilanEnAttente | null = null;

export function getProtectionOrg(): BilanEnAttente | null {
  return protection;
}

/**
 * L'organisateur a choisi d'effacer les données de l'autre compte. C'est la
 * seule porte de sortie qui efface : elle est explicite, et elle relance la
 * synchronisation aussitôt.
 */
export async function purgerDonneesAutreCompte(): Promise<void> {
  await wipeLocalData();
  protection = null;
  notifier();
  await syncNow();
}

function notifier(): void {
  for (const fn of listeners) fn();
}

async function memoriserEcart(type: string, id: string): Promise<void> {
  ecartees = ajouterEcart(ecartees, { type, id, quand: new Date().toISOString() });
  await setMeta('ecartees', ecartees);
  notifier();
}

/** L'organisateur a pris connaissance du signalement. */
export async function oublierDonneesEcartees(): Promise<void> {
  ecartees = [];
  await setMeta('ecartees', ecartees);
  notifier();
}

function setStatus(next: SyncStatus): void {
  if (status === next) return;
  status = next;
  notifier();
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
    // La base locale appartient à une organisation. En changer purge — mais pas
    // ce qui n'a jamais été envoyé : ces données ne sont sur aucun serveur, et
    // les effacer en silence les perdrait pour de bon.
    const localOrg = await getMeta<string>('orgId');
    // Un décompte sur index, pas une lecture : à chaque échange, sur toute la base.
    const enAttente = await db.entities.where('dirty').equals(1).count();
    const decision = decisionChangementOrg({
      orgLocale: localOrg,
      orgSession: session.org.id,
      enAttente,
    });
    if (decision.action === 'proteger') {
      const lignes = await db.entities.where('dirty').equals(1).toArray();
      const bilan = bilanEnAttente(
        lignes.map((r) => ({ type: r.type, id: r.id, concoursId: r.concoursId || undefined })),
      );
      // La boucle repasse toutes les 30 s : ne réveiller l'écran que si le
      // bilan a changé, sinon `useSyncExternalStore` re-rend pour rien.
      if (!protection || protection.total !== bilan.total) {
        protection = bilan;
        notifier();
      }
      setStatus('protege');
      return;
    }
    if (decision.action === 'purger') {
      await wipeLocalData();
    }
    protection = null;
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

      // Ce que le serveur a réellement pris. Acquitter un envoi qu'il n'a pas
      // accepté marquerait « synchronisée » une donnée qui n'est nulle part.
      const acquittes = envoisAcquittes(dirty, res.accepted ?? []);

      // Retenus pendant la transaction, enregistrés après : écrire dans `meta`
      // depuis une transaction qui ne porte que sur `entities` la ferait échouer.
      const aSignaler: { type: string; id: string }[] = [];
      await db.transaction('rw', db.entities, async () => {
        // 1. Applique les changements du serveur (dernier-écrivain-gagnant).
        for (const ch of res.changes) {
          const local = await db.entities.get([ch.type, ch.id]);
          if (!changementGagne(ch, local)) continue;
          // Une équipe malformée poussée par un appareil d'une autre version
          // blanchirait l'écran des inscriptions : on garde ce qu'on a.
          if (!changementApplicable(ch)) {
            console.warn('Synchronisation : changement ignoré, donnée inexploitable', ch.type, ch.id);
            aSignaler.push({ type: ch.type, id: ch.id });
            continue;
          }
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
        // 2. Acquitte les envois acceptés, restés inchangés depuis leur lecture.
        for (const rec of dirty) {
          if (!acquittes.has(cleEntite(rec.type, rec.id))) continue;
          const cur = await db.entities.get([rec.type, rec.id]);
          if (cur && cur.dirty === 1 && cur.updatedAt === rec.updatedAt) {
            await db.entities.put({ ...cur, dirty: 0 });
          }
        }
      });
      await setMeta('cursor', res.cursor);
      for (const { type, id } of aSignaler) await memoriserEcart(type, id);

      const remaining = await db.entities.where('dirty').equals(1).count();
      if (!res.hasMore && remaining === 0) break;
      // Aucun envoi accepté et rien reçu : recommencer donnerait le même
      // résultat. On s'arrête plutôt que d'enchaîner vingt requêtes identiques
      // — ce qui arriverait avec une entité que le serveur refuse.
      if (!res.hasMore && acquittes.size === 0 && res.changes.length === 0) break;
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
  void getMeta<DonneeEcartee[]>('ecartees').then((liste) => {
    if (liste && liste.length > 0) {
      ecartees = liste;
      notifier();
    }
  });
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => setStatus('offline'));
  window.setInterval(() => void syncNow(), 30_000);
  void syncNow();
}
