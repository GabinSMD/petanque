import Dexie, { type Table } from 'dexie';
import type { Concours, EntityType, Licencie, Match, Poule, Team } from '@shared';

/** Correspondance type d'entité → objet du domaine. */
export interface EntityDataMap {
  concours: Concours;
  team: Team;
  poule: Poule;
  match: Match;
  licencie: Licencie;
}

export interface EntityRecord<T extends EntityType = EntityType> {
  type: T;
  id: string;
  /** Dénormalisé pour les requêtes par concours (le concours pointe sur lui-même). */
  concoursId: string;
  data: EntityDataMap[T] | null;
  updatedAt: string;
  deleted: 0 | 1;
  /** 1 = modification locale non encore poussée au serveur. */
  dirty: 0 | 1;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

class LocalDatabase extends Dexie {
  entities!: Table<EntityRecord, [string, string]>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('petanque-concours');
    this.version(1).stores({
      entities: '[type+id], [type+concoursId], concoursId, dirty, updatedAt',
      meta: 'key',
    });
  }
}

export const db = new LocalDatabase();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Vide toutes les données locales (changement d'organisation, déconnexion). */
export async function wipeLocalData(): Promise<void> {
  await db.transaction('rw', db.entities, db.meta, async () => {
    await db.entities.clear();
    await db.meta.clear();
  });
}

/**
 * Rattache les données locales (mode invité) à un nouveau compte : tout
 * est re-marqué « à pousser » et le curseur repart de zéro — la prochaine
 * synchronisation envoie l'intégralité au serveur du compte.
 */
export async function adoptLocalDataForNewOrg(): Promise<void> {
  await db.transaction('rw', db.entities, db.meta, async () => {
    await db.entities.toCollection().modify({ dirty: 1 });
    await db.meta.delete('cursor');
    await db.meta.delete('orgId');
  });
}

/** Y a-t-il au moins un concours vivant sur cet appareil ? */
export async function hasLocalConcours(): Promise<boolean> {
  const rows = await db.entities.where('type').equals('concours').toArray();
  return rows.some((r) => r.deleted === 0);
}
