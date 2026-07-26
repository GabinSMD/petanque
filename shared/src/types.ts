/**
 * Types du domaine — partagés entre le client (moteur local hors-ligne)
 * et le serveur (réplication / sauvegarde SaaS).
 */

/** Formation des équipes. */
export type TeamFormat = 'tete_a_tete' | 'doublette' | 'triplette';

/** Déroulement du concours. */
export type ConcoursMode = 'poules' | 'elimination_directe';

/** Cycle de vie d'un concours. */
export type ConcoursStatus = 'inscriptions' | 'poules' | 'tableau' | 'termine';

export type MatchStage = 'poule' | 'principal' | 'consolante';

/** Rôle d'une partie au sein d'une poule. */
export type PouleSlot = 'M1' | 'M2' | 'GAGNANTS' | 'PERDANTS' | 'BARRAGE';

export interface Player {
  name: string;
  licence?: string;
}

export interface Concours {
  id: string;
  name: string;
  /** Date au format YYYY-MM-DD. */
  date: string;
  lieu?: string;
  format: TeamFormat;
  mode: ConcoursMode;
  /** Consolante : repêchage des éliminés (poules ou 1er tour). */
  consolante: boolean;
  /** Score gagnant d'une mène complète (13 en pétanque). */
  scoreMax: number;
  nbTerrains: number;
  status: ConcoursStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  concoursId: string;
  /** Numéro de dossard, attribué à l'inscription. */
  number: number;
  players: Player[];
  club?: string;
  forfait: boolean;
  updatedAt: string;
}

export interface Poule {
  id: string;
  concoursId: string;
  /** Index 1..N affiché (Poule 1, Poule 2…). */
  index: number;
  /** 3 ou 4 équipes, dans l'ordre du tirage. */
  teamIds: string[];
  terrain: number | null;
  updatedAt: string;
}

export interface Match {
  id: string;
  concoursId: string;
  stage: MatchStage;
  /** Renseigné pour stage === 'poule'. */
  pouleId?: string;
  pouleSlot?: PouleSlot;
  /** Tour du tableau (0 = premier tour / cadrage). 0 pour les poules. */
  round: number;
  /** Position dans le tour. */
  position: number;
  teamAId: string | null;
  teamBId: string | null;
  /** Exempt (place vide au cadrage) : l'équipe en face passe directement. */
  byeA?: boolean;
  byeB?: boolean;
  /** Alimenté par le perdant de la partie référencée (consolante). */
  loserFromA?: string;
  loserFromB?: string;
  scoreA: number | null;
  scoreB: number | null;
  done: boolean;
  terrain: number | null;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Protocole de synchronisation SaaS                                   */
/* ------------------------------------------------------------------ */

export type EntityType = 'concours' | 'team' | 'poule' | 'match';

export const ENTITY_TYPES: EntityType[] = ['concours', 'team', 'poule', 'match'];

export interface SyncChange {
  type: EntityType;
  id: string;
  /** Contenu de l'entité (null si supprimée). */
  data: unknown;
  updatedAt: string;
  deleted: 0 | 1;
}

export interface SyncPushChange extends SyncChange {
  /** Identifiant de l'appareil, départage les écritures simultanées. */
  deviceId: string;
}

export interface SyncRequest {
  /** Dernier numéro de séquence serveur connu du client. */
  cursor: number;
  changes: SyncPushChange[];
}

export interface SyncResponse {
  cursor: number;
  changes: (SyncChange & { seq: number })[];
}
