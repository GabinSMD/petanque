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

/**
 * Formule fédérale : quels tableaux coexistent et où sont reversés les
 * perdants (manuel « Gestion Concours » §3.D.8 à §3.D.12).
 * - `a` : un seul tableau ;
 * - `ab` : perdants de la 1re partie de A → concours B (§3.D.9) ;
 * - `abc` : idem + perdants de la 1re partie de B → concours C (§3.D.10) ;
 * - `abc_recup` : idem `abc` + perdants de la **2e** partie de A reversés au
 *   cadrage du B (§3.D.8) ;
 * - `abc_cd19` : les perdants de la 2e partie de A partent au 1er tour du C
 *   au lieu du B (§3.D.12).
 */
export type Formule = 'a' | 'ab' | 'abc' | 'abc_recup' | 'abc_cd19';

/** Cycle de vie d'un concours. */
export type ConcoursStatus = 'inscriptions' | 'poules' | 'tableau' | 'rondes' | 'termine';

export type MatchStage = 'poule' | 'principal' | 'consolante' | 'complementaire' | 'ronde';

/**
 * Niveau du concours (manuel §3.A) : il détermine le contrôle des licences
 * et la remontée fédérale.
 */
export type NiveauConcours =
  | 'club'
  | 'departemental'
  | 'regional'
  | 'national'
  | 'international'
  | 'championnat'
  | 'coupe_de_france';

/** Discipline fédérale (le jeu diffère, la gestion est identique). */
export type Discipline = 'petanque' | 'jeu_provencal';

/** Rôle d'une partie au sein d'une poule. */
export type PouleSlot = 'M1' | 'M2' | 'GAGNANTS' | 'PERDANTS' | 'BARRAGE';

export interface Player {
  name: string;
  licence?: string;
}

/** Sexe porté par la licence fédérale. */
export type Sexe = 'M' | 'F';

/** Classification fédérale : Élite, Honneur, Promotion. */
export type Classification = 'E' | 'H' | 'P';

/**
 * Catégorie d'âge fédérale (manuel §3.C) : bornes calculées sur l'année en
 * cours, pas sur la date anniversaire.
 */
export type CategorieAge =
  | 'veterans'
  | 'seniors'
  | 'juniors'
  | 'cadets'
  | 'minimes'
  | 'benjamins';

/** Critère de sexe d'un concours ; `mixte` exige au moins 1 M et 1 F par équipe. */
export type CritereSexe = 'tous' | 'masculin' | 'feminin' | 'mixte';

/** Critère de classification d'un concours. */
export type CritereClassification = 'tous' | 'elite' | 'honneur' | 'promotion';

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
  /** Niveau fédéral du concours. */
  niveau?: NiveauConcours;
  /** Comité départemental organisateur (ex. « CD 38 Isère »). */
  comiteOrganisateur?: string;
  /** Club organisateur. */
  clubOrganisateur?: string;
  /**
   * Décalages de numérotation, quand un club enchaîne plusieurs concours le
   * même jour : équipes 101.., terrains 51… (manuel §3.A zones 6 et 7).
   */
  decalageEquipe?: number;
  decalageTerrain?: number;
  /**
   * Critères de contrôle des licences (manuel §3.A zones 2 à 5 et 9).
   * Tous facultatifs : un concours de club n'en a pas besoin.
   */
  categorieAge?: CategorieAge;
  /** Case « strict » : interdit les catégories d'âge inférieures. */
  strict?: boolean;
  critereSexe?: CritereSexe;
  critereClassification?: CritereClassification;
  /** Équipes homogènes exigées (tous les joueurs du même club). */
  homogene?: boolean;
  /** Nombre de qualifiés pour une phase suivante (championnat qualificatif). */
  nbQualifies?: number;
  /** Consolante à 2 niveaux : ajoute un complémentaire (perdants de la consolante). */
  complementaire?: boolean;
  /** Consolante : repêchage des éliminés (poules ou 1er tour). */
  consolante: boolean;
  /**
   * Formule fédérale du tableau (élimination directe). Absente : la formule
   * est déduite de `consolante` / `complementaire`.
   */
  formule?: Formule;
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
  /** Numéro de club fédéral (ex. 0266013). */
  clubNumero?: string;
  /** Comité départemental d'appartenance (ex. 026). */
  comite?: string;
  /** Date de naissance au format YYYY-MM-DD : détermine la catégorie d'âge. */
  dateNaissance?: string;
  sexe?: Sexe;
  classification?: Classification;
  /**
   * Année de validation de la licence. Une licence de l'année suivante est
   * valide : un joueur peut la prendre dès novembre.
   */
  anneeReprise?: number;
  /** Fin de validité du certificat médical (YYYY-MM-DD) — jeunes uniquement. */
  certificatMedical?: string;
  /** Code pays ; les joueurs hors UE sont contingentés en championnat. */
  nationalite?: string;
  /** Joueur muté (position fédérale) : contingenté en championnat des clubs. */
  mutation?: boolean;
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
