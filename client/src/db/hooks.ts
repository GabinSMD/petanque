import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { db } from './local';
import {
  getLastSyncAt,
  getSyncStatus,
  subscribeSyncStatus,
  type SyncStatus,
} from '../sync/engine';
import { getSession, subscribeSession, type Session } from '../lib/session';

export function useConcoursList(): Concours[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.entities.where('type').equals('concours').toArray();
    return rows
      .filter((r) => r.deleted === 0 && r.data)
      .map((r) => r.data as Concours)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, []);
}

export function useConcours(id: string | undefined): Concours | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined;
    const row = await db.entities.get(['concours', id]);
    if (!row || row.deleted === 1 || !row.data) return undefined;
    return row.data as Concours;
  }, [id]);
}

function useEntityList<T>(type: string, concoursId: string | undefined): T[] | undefined {
  return useLiveQuery(async () => {
    if (!concoursId) return [];
    const rows = await db.entities
      .where('[type+concoursId]')
      .equals([type, concoursId])
      .toArray();
    return rows.filter((r) => r.deleted === 0 && r.data).map((r) => r.data as T);
  }, [type, concoursId]);
}

export function useTeams(concoursId: string | undefined): Team[] | undefined {
  const teams = useEntityList<Team>('team', concoursId);
  return teams?.sort((a, b) => a.number - b.number);
}

export function usePoules(concoursId: string | undefined): Poule[] | undefined {
  const poules = useEntityList<Poule>('poule', concoursId);
  return poules?.sort((a, b) => a.index - b.index);
}

export function useMatches(concoursId: string | undefined): Match[] | undefined {
  return useEntityList<Match>('match', concoursId);
}

export function usePendingCount(): number {
  return useLiveQuery(() => db.entities.where('dirty').equals(1).count(), [], 0);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
}

export function useLastSyncAt(): string | null {
  return useSyncExternalStore(subscribeSyncStatus, getLastSyncAt);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession);
}
