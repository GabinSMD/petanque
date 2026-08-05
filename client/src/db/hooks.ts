import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useSyncExternalStore } from 'react';
import type {
  BilanEnAttente,
  Concours,
  PhotoConcours,
  DonneeEcartee,
  FeuilleMatch,
  Licencie,
  LicencieEtranger,
  Match,
  Poule,
  Team,
} from '@shared';
import { db } from './local';
import {
  aDesCriteresLicence,
  besoinModeFederal,
  bilanAvantTirage,
  besoinTerrains,
  comptesClassification,
  controlerEquipe,
  criteresDuConcours,
  dateDeLaBase,
  fraicheurLicencies,
  type BilanAvantTirage,
  type FraicheurLicencies,
} from '@shared';
import { useModeFederal } from '../lib/modeFederal';
import {
  getDonneesEcartees,
  getLastSyncAt,
  getProtectionOrg,
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

/**
 * Base personnelle de licenciés étrangers (§3.B.1, zone 21). Distincte du
 * fichier fédéral, qu'un réimport remplace.
 */
export function useLicenciesEtrangers(): LicencieEtranger[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.entities
      .where('[type+concoursId]')
      .equals(['licencieEtranger', ''])
      .toArray();
    return rows
      .filter((r) => r.deleted === 0 && r.data)
      .map((r) => r.data as LicencieEtranger)
      .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
  }, []);
}

export function useLicencies(): Licencie[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.entities
      .where('[type+concoursId]')
      .equals(['licencie', ''])
      .toArray();
    return rows
      .filter((r) => r.deleted === 0 && r.data)
      .map((r) => r.data as Licencie)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, []);
}

/**
 * Nombre de licenciés importés, sans charger le fichier — il peut compter
 * plusieurs milliers de fiches, et on n'a besoin ici que de savoir s'il existe.
 */
export function useLicenciesCount(): number {
  return (
    useLiveQuery(
      () => db.entities.where('[type+concoursId]').equals(['licencie', '']).count(),
      [],
      0,
    ) ?? 0
  );
}

/**
 * Fraîcheur du fichier des licenciés (manuel §2.1) — **sans monter le fichier
 * en mémoire**. Un seul passage sur l'index `[type+concoursId]`, sans tableau de
 * fiches ni tri : ce qui coûte dans `useLicencies` n'est pas la lecture mais les
 * dizaines de milliers d'objets construits puis triés au `localeCompare`.
 *
 * Le `deleted === 0` n'est pas décoratif : un `count()` d'index compterait les
 * **pierres tombales** d'une purge précédente, et l'écran annoncerait plus de
 * fiches qu'il n'y en a. Trouvé en vérifiant dans l'application, où dix lignes
 * répondaient pour deux licenciés.
 */
export function useFraicheurLicencies(): FraicheurLicencies {
  const vide = fraicheurLicencies(undefined, 0, new Date().toISOString());
  return (
    useLiveQuery(async () => {
      const dates: { updatedAt: string }[] = [];
      await db.entities
        .where('[type+concoursId]')
        .equals(['licencie', ''])
        .each((r) => {
          if (r.deleted === 0) dates.push({ updatedAt: r.updatedAt });
        });
      return fraicheurLicencies(dateDeLaBase(dates), dates.length, new Date().toISOString());
    }, []) ?? vide
  );
}

/** Feuilles de match du club, la plus récente d'abord. */
export function useFeuillesMatch(): FeuilleMatch[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.entities.where('[type+concoursId]').equals(['feuilleMatch', '']).toArray();
    return rows
      .filter((r) => r.deleted === 0 && r.data)
      .map((r) => r.data as FeuilleMatch)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, []);
}

export function useFeuilleMatch(id: string | undefined): FeuilleMatch | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined;
    const row = await db.entities.get(['feuilleMatch', id]);
    return row && row.deleted === 0 ? (row.data as FeuilleMatch) : undefined;
  }, [id]);
}

/**
 * Le mode fédéral est-il actif ? Préférence explicite de l'utilisateur si elle
 * existe, sinon ce que le contenu du club suggère (manuel : rien — c'est un
 * confort d'affichage, pas une règle fédérale).
 */
export function useModeFederalActif(): boolean {
  const concours = useConcoursList() ?? [];
  const licencies = useLicenciesCount();
  return useModeFederal(besoinModeFederal({ concours, licencies })).actif;
}

export function usePendingCount(): number {
  return useLiveQuery(() => db.entities.where('dirty').equals(1).count(), [], 0);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
}

/**
 * Bilan de validité des inscriptions (manuel §3.B.6), ou `null` quand le
 * concours n'a aucun critère fédéral — un concours amical n'a rien à contrôler.
 */
export function useBilanAvantTirage(
  concours: Concours | undefined,
  teams: Team[],
): BilanAvantTirage | null {
  const licencies = useLicencies() ?? [];
  return useMemo(() => {
    if (!concours || !aDesCriteresLicence(concours)) return null;
    const fiches = new Map(licencies.filter((l) => l.licence).map((l) => [l.licence!, l]));
    const criteres = criteresDuConcours(concours);
    const engagees = teams.filter((t) => !t.forfait);
    return bilanAvantTirage(
      engagees.map((t) => ({
        number: t.number,
        controle: controlerEquipe(t.players, fiches, criteres, t.club),
      })),
      besoinTerrains(concours, engagees.length),
      // Les comptes par classification n'ont de sens qu'avec un fichier des
      // licenciés : sans lui, on ne peut pas classer, et c'est l'absence qui le
      // dit plutôt que trois zéros.
      fiches.size > 0
        ? comptesClassification(
            engagees.flatMap((t) => t.players),
            fiches,
          )
        : undefined,
    );
  }, [concours, teams, licencies]);
}

/** Photos du podium d'un concours (manuel §3.D.1.B.5.5). */
export function usePhotos(concoursId: string | undefined): PhotoConcours[] | undefined {
  return useLiveQuery(async () => {
    if (!concoursId) return [];
    const rows = await db.entities.where('[type+concoursId]').equals(['photo', concoursId]).toArray();
    return rows.filter((r) => r.deleted === 0 && r.data).map((r) => r.data as PhotoConcours);
  }, [concoursId]);
}

/** Données reçues d'un autre appareil et écartées faute d'être lisibles. */
export function useDonneesEcartees(): DonneeEcartee[] {
  return useSyncExternalStore(subscribeSyncStatus, getDonneesEcartees);
}

/**
 * Modifications non envoyées appartenant à un autre compte, quand la
 * synchronisation est suspendue pour ne pas les effacer.
 */
export function useProtectionOrg(): BilanEnAttente | null {
  return useSyncExternalStore(subscribeSyncStatus, getProtectionOrg);
}

export function useLastSyncAt(): string | null {
  return useSyncExternalStore(subscribeSyncStatus, getLastSyncAt);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession);
}
