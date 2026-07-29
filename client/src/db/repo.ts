import type { EntityType, Match } from '@shared';
import { stampLancees, validerEquipe } from '@shared';
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

/**
 * Invariant fédéral : toute partie écrite porte son heure d'annonce dès que
 * ses deux camps sont connus (manuel §3.D.1.B.3). C'est posé ici, au seul
 * point de passage des écritures, plutôt que dans chaque action — un oubli
 * priverait l'arbitre de son justificatif de retard. `stampLancees` n'agit que
 * sur les parties jouables non encore horodatées : l'opération est idempotente
 * et n'écrase jamais une heure existante.
 */
function horodater<T extends EntityType>(type: T, items: EntityDataMap[T][]): EntityDataMap[T][] {
  if (type !== 'match') return items;
  const matches = items as Match[];
  const stamped = new Map(stampLancees(matches, new Date().toISOString()).map((m) => [m.id, m]));
  if (stamped.size === 0) return items;
  return matches.map((m) => stamped.get(m.id) ?? m) as EntityDataMap[T][];
}

/**
 * Refuse d'écrire une équipe inexploitable, au seul point de passage des
 * écritures locales.
 *
 * Une équipe malformée ne se voit pas comme une faute de saisie : elle fait
 * planter l'écran des inscriptions, et le rechargement avec, puisqu'elle est en
 * base. C'est arrivé, avec un appel qui passait un objet là où un tableau de
 * joueurs était attendu. Échouer bruyamment à l'écriture rend le défaut visible
 * là où il est, au lieu de le déplacer dans un écran blanc.
 *
 * Une équipe arrive de six chemins — saisie, import CSV, lecteur de licences,
 * QR, restauration de sauvegarde, synchronisation. La règle est donc ici plutôt
 * que dans chacun d'eux.
 */
function verifierEquipes<T extends EntityType>(type: T, items: EntityDataMap[T][]): void {
  if (type !== 'team') return;
  for (const item of items) {
    const verdict = validerEquipe(item);
    if (!verdict.ok) throw new Error(verdict.raison);
  }
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
  verifierEquipes(type, [data]);
  const horodate = horodater(type, [data])[0]!;
  const updatedAt = monotonicNow();
  const stamped = { ...horodate, updatedAt };
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
  verifierEquipes(type, items);
  const records: EntityRecord[] = horodater(type, items).map((data) => {
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
