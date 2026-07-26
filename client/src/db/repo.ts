import type { EntityType } from '@shared';
import { db, type EntityDataMap, type EntityRecord } from './local';
import { scheduleSync } from '../sync/engine';

/**
 * Horloge monotone : garantit des `updatedAt` strictement croissants
 * sur cet appareil, même en cas d'écritures dans la même milliseconde —
 * indispensable pour la résolution dernier-écrivain-gagnant.
 */
let lastTs = 0;

export function monotonicNow(): string {
  let t = Date.now();
  if (t <= lastTs) t = lastTs + 1;
  lastTs = t;
  return new Date(t).toISOString();
}

function concoursIdOf<T extends EntityType>(type: T, data: EntityDataMap[T]): string {
  if (type === 'concours') return data.id;
  // Les licenciés sont rattachés à l'organisation, pas à un concours.
  return (data as { concoursId?: string }).concoursId ?? '';
}

/** Écrit une entité locale et la marque à synchroniser. */
export async function putEntity<T extends EntityType>(
  type: T,
  data: EntityDataMap[T],
): Promise<void> {
  const updatedAt = monotonicNow();
  const stamped = { ...data, updatedAt };
  const record: EntityRecord = {
    type,
    id: data.id,
    concoursId: concoursIdOf(type, data),
    data: stamped,
    updatedAt,
    deleted: 0,
    dirty: 1,
  };
  await db.entities.put(record);
  scheduleSync();
}

export async function bulkPutEntities<T extends EntityType>(
  type: T,
  items: EntityDataMap[T][],
): Promise<void> {
  if (items.length === 0) return;
  const records: EntityRecord[] = items.map((data) => {
    const updatedAt = monotonicNow();
    return {
      type,
      id: data.id,
      concoursId: concoursIdOf(type, data),
      data: { ...data, updatedAt },
      updatedAt,
      deleted: 0,
      dirty: 1,
    };
  });
  await db.entities.bulkPut(records);
  scheduleSync();
}

/** Suppression douce : pose une pierre tombale synchronisable. */
export async function softDeleteEntity(type: EntityType, id: string): Promise<void> {
  const existing = await db.entities.get([type, id]);
  const updatedAt = monotonicNow();
  await db.entities.put({
    type,
    id,
    concoursId: existing?.concoursId ?? (type === 'concours' ? id : ''),
    data: null,
    updatedAt,
    deleted: 1,
    dirty: 1,
  });
  scheduleSync();
}

export async function softDeleteMany(
  entries: { type: EntityType; id: string }[],
): Promise<void> {
  if (entries.length === 0) return;
  await db.transaction('rw', db.entities, async () => {
    for (const { type, id } of entries) {
      const existing = await db.entities.get([type, id]);
      const updatedAt = monotonicNow();
      await db.entities.put({
        type,
        id,
        concoursId: existing?.concoursId ?? (type === 'concours' ? id : ''),
        data: null,
        updatedAt,
        deleted: 1,
        dirty: 1,
      });
    }
  });
  scheduleSync();
}

/** Entités vivantes d'un type pour un concours. */
export async function listByConcours<T extends EntityType>(
  type: T,
  concoursId: string,
): Promise<EntityDataMap[T][]> {
  const rows = await db.entities
    .where('[type+concoursId]')
    .equals([type, concoursId])
    .toArray();
  return rows
    .filter((r) => r.deleted === 0 && r.data)
    .map((r) => r.data as EntityDataMap[T]);
}

export async function getEntity<T extends EntityType>(
  type: T,
  id: string,
): Promise<EntityDataMap[T] | undefined> {
  const row = await db.entities.get([type, id]);
  if (!row || row.deleted === 1 || !row.data) return undefined;
  return row.data as EntityDataMap[T];
}
