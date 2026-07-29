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
 *   au lieu du B (§3.D.12) ;
 * - `abc_cd53` : comme `abc_recup`, plus les perdants de la 2e partie de B
 *   reversés à la 2e partie du C (§3.D.13).
 */
export type Formule = 'a' | 'ab' | 'abc' | 'abc_recup' | 'abc_cd19' | 'abc_cd53';

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

/**
 * Rôle de jeu à la pétanque. Hors manuel fédéral — celui-ci ne parle ni de
 * mêlée ni de rôles : c'est un confort d'organisateur, utilisé pour que le
 * tirage d'une mêlée forme des équipes jouables.
 */
export type RolePetanque = 'pointeur' | 'milieu' | 'tireur';

export interface Player {
  name: string;
  licence?: string;
  /**
   * Rôle de prédilection, déclaré à l'inscription. Facultatif : non renseigné,
   * le joueur complète n'importe quel camp.
   */
  role?: RolePetanque;
  /**
   * Club du joueur. En national et en régional, une équipe peut réunir des
   * licenciés de clubs différents : le club appartient donc au joueur. Le
   * champ `club` de l'équipe reste la valeur par défaut des concours de club.
   */
  club?: string;
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
   * Terrains retirés du jeu pendant le concours (manuel §3.D.1.B.5.2) :
   * flaque d'eau, jeu réservé… Ils restent affichés mais ne sont plus
   * attribués.
   */
  terrainsBloques?: number[];
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
  /**
   * Groupes de clubs protégés ensemble au tirage (manuel §3.B.5, niveau 2) :
   * deux clubs d'un même village, une entente… La protection club — niveau 1 —
   * s'applique de toute façon.
   */
  protections?: string[][];
  /**
   * Licences dont le certificat médical a été validé à la main, sur
   * présentation du papier au dépôt (manuel §3.C).
   */
  certificatsValides?: string[];
  /** Nombre de qualifiés pour une phase suivante (championnat qualificatif). */
  nbQualifies?: number;
  /**
   * Ordre du classement des rondes imposé à la main (manuel §3.D.15,
   * « CHANGEMENT DANS LE CLASSEMENT — suite à une égalité »). Il ne départage
   * que les ex æquo : il ne peut pas faire passer une équipe devant une autre
   * qui a plus de victoires.
   */
  ordreClassement?: string[];
  /** Consolante à 2 niveaux : ajoute un complémentaire (perdants de la consolante). */
  complementaire?: boolean;
  /** Consolante : repêchage des éliminés (poules ou 1er tour). */
  consolante: boolean;
  /**
   * Formule fédérale du tableau (élimination directe). Absente : la formule
   * est déduite de `consolante` / `complementaire`.
   */
  formule?: Formule;
  /**
   * Concours par poules : les perdants du 1er tour du tableau principal
   * rejoignent le cadrage de la consolante (manuel §3.D.4).
   */
  recupCadrage?: boolean;
  /**
   * Formule par groupes A-B-C (manuel §3.D.5) : groupes de 4 sans barrage, dont
   * l'issue se lit au nombre de victoires — 2 victoires au concours A, 1 au B
   * (les deux équipes), 0 au C. Tout le monde continue de jouer.
   */
  parGroupes?: boolean;
  /**
   * Autorise à désigner le vainqueur d'une partie sans saisir le score, pour
   * aller plus vite. Réservé aux formules où le score ne sert pas au
   * classement : en rondes, il faut les points.
   */
  vainqueurSeul?: boolean;
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
  /**
   * Indemnités versées jusqu'à ce rang inclus ; au-delà, les équipes
   * repartent avec des lots ou des tickets. Absent = tous les rangs classés.
   */
  indemnitesJusquAuRang?: number;
  status: ConcoursStatus;
  /**
   * Date de rangement du concours (manuel §3.F.3) : il sort des listes
   * courantes sans rien perdre. Absente = concours courant.
   */
  archiveLe?: string;
  /**
   * Concours d'origine, quand celui-ci est né du fractionnement multisite
   * (manuel §3.B.10.D). Absent = concours créé directement.
   */
  issuDeConcours?: string;
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
  /**
   * Horodatage du dépôt des licences (manuel §3.C) : l'équipe a présenté ses
   * licences à la table de marque. Absent = pas encore passée.
   */
  licencesDeposees?: string;
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
  /**
   * Alimenté par un qualifié de poule, sous la forme `pouleId:rang` (rang 1 ou
   * 2). La place mémorise **d'où vient** l'équipe, pas l'équipe : corriger un
   * résultat de poule met donc le tableau à jour tout seul, comme pour les
   * repêchages. C'est ce qui permet d'entrer au tableau au fil des poules
   * (manuel §3.D.1.A) sans attendre la dernière.
   */
  qualifFromA?: string;
  qualifFromB?: string;
  scoreA: number | null;
  scoreB: number | null;
  done: boolean;
  terrain: number | null;
  /**
   * Vainqueur désigné sans saisir le score, quand le concours l'autorise
   * (« ouvert à tous » : le score n'a pas d'enjeu). Le score, s'il existe,
   * reste la source de vérité.
   */
  vainqueur?: 'A' | 'B';
  /**
   * Heure d'annonce de la partie (ISO), posée dès que les deux camps sont
   * connus. Justificatif des pénalités de retard : elle ne bouge plus.
   */
  lanceeA?: string;
  /** Signalée à la table de marque : le résultat n'a pas été annoncé. */
  retard?: boolean;
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

/**
 * Types d'entités répliquées.
 *
 * ⚠ Le serveur tient sa propre liste blanche dans `server/src/sync.ts` — il ne
 * peut pas lire celle-ci sans casser son `rootDir` et donc son chemin de
 * déploiement. **Tout ajout ici doit être fait là-bas aussi**, dans le même
 * commit : un type absent de la liste du serveur est ignoré silencieusement, et
 * l'entité ne quitte jamais l'appareil.
 */
export type EntityType = 'concours' | 'team' | 'poule' | 'match' | 'licencie' | 'feuilleMatch';

export const ENTITY_TYPES: EntityType[] = [
  'concours',
  'team',
  'poule',
  'match',
  'licencie',
  'feuilleMatch',
];

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
