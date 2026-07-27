/**
 * Types du domaine — partagés entre le client (moteur local hors-ligne)
 * et le serveur (réplication / sauvegarde SaaS).
 */

/** Formation des équipes. */
export type TeamFormat = 'tete_a_tete' | 'doublette' | 'triplette';

/**
 * Formule du concours :
 * - poules : poules de 3/4 puis tableau (le classique FFPJP)
 * - elimination_directe : tableau à la coupe
 * - melee : inscriptions individuelles, équipes tirées au sort à chaque ronde
 * - suisse : N rondes, appariement par classement, personne n'est éliminé
 * - championnat : toutes rondes (chacun rencontre chacun)
 * - tir_precision : séries de tir individuelles (100 points max)
 */
export type ConcoursMode =
  | 'poules'
  | 'elimination_directe'
  | 'melee'
  | 'suisse'
  | 'championnat'
  | 'tir_precision';

/** Cycle de vie d'un concours. */
export type ConcoursStatus = 'inscriptions' | 'poules' | 'tableau' | 'rondes' | 'termine';

export type MatchStage = 'poule' | 'principal' | 'consolante' | 'complementaire' | 'ronde';

/** Discipline fédérale (le jeu diffère, la gestion est identique). */
export type Discipline = 'petanque' | 'jeu_provencal';

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
  /** Discipline (pétanque par défaut). */
  discipline?: Discipline;
  /** Catégorie (Seniors, Vétérans, Féminines, Jeunes…) — facultatif. */
  category?: string;
  /** Nombre de qualifiés pour une phase suivante (championnat qualificatif). */
  nbQualifies?: number;
  /** Consolante à 2 niveaux : ajoute un complémentaire (perdants de la consolante). */
  complementaire?: boolean;
  /** Consolante : repêchage des éliminés (poules ou 1er tour). */
  consolante: boolean;
  /** Score gagnant d'une mène complète (13 en pétanque). */
  scoreMax: number;
  nbTerrains: number;
  /** Nombre de rondes prévues (mêlée, système suisse) ou de séries (tir). */
  nbRondes?: number;
  /** Durée indicative des parties en minutes (parties au temps). */
  tempsLimite?: number;
  /**
   * Afficher l'onglet « Plan des terrains ». Absent/true = affiché ;
   * false = masqué (les terrains restent gérables dans les poules).
   */
  planTerrains?: boolean;
  /** Indemnités : mise par équipe (€) et frais d'organisation (%). */
  miseParEquipe?: number;
  fraisPct?: number;
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
  /** Engagement réglé (suivi de caisse). */
  paid?: boolean;
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
  /**
   * Mêlée : identifiants des participants de chaque côté (les « équipes »
   * n'existent que le temps d'une ronde et peuvent être inégales, 3 contre 2).
   */
  playersA?: string[];
  playersB?: string[];
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

/**
 * Licencié du fichier club/comité (import CSV) : sert à l'autocomplétion
 * des inscriptions. Rattaché à l'organisation, pas à un concours.
 */
export interface Licencie {
  id: string;
  name: string;
  licence?: string;
  club?: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Protocole de synchronisation SaaS                                   */
/* ------------------------------------------------------------------ */

export type EntityType = 'concours' | 'team' | 'poule' | 'match' | 'licencie';

export const ENTITY_TYPES: EntityType[] = ['concours', 'team', 'poule', 'match', 'licencie'];

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
