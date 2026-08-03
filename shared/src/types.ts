/**
 * Types du domaine — partagés entre le client (moteur local hors-ligne)
 * et le serveur (réplication / sauvegarde SaaS).
 */

/** Formation des équipes. */
export type TeamFormat = 'tete_a_tete' | 'doublette' | 'triplette';

/**
 * Mise d'une équipe : les trois positions du cadre « Mises » (manuel §3.B.1,
 * zone 19). Les règles qui vont avec sont dans `engine/mises.ts`.
 */
export type EtatMise = 'non_paye' | 'paye' | 'facturation';

/**
 * Deux équipes dont l'organisateur a échangé les places au classement (manuel,
 * classeur des phases finales : « CHANGEMENT DANS LE CLASSEMENT — suite à une
 * égalité »). Les règles sont dans `engine/permutationClassement.ts`.
 */
export interface PermutationClassement {
  a: string;
  b: string;
}

/**
 * Une mène : le camp qui l'a remportée et ce qu'elle lui a rapporté. Les règles
 * qui vont avec sont dans `engine/evolutionScore.ts`.
 */
export interface Mene {
  camp: 'a' | 'b';
  points: number;
}

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
  /* Les huit valeurs de la liste fédérale (manuel §3.A, copie d'écran p.13). */
  /** « Concours Départemental » — code de numéro `DEPT`. */
  | 'departemental'
  /** « Concours Régional ». */
  | 'regional'
  /** « Championnat Départemental Honorifique ». */
  | 'championnat_departemental_honorifique'
  | 'national'
  | 'international'
  /** « Qualificatif Départemental » — code de numéro `QUALIF_CD`. */
  | 'qualificatif_departemental'
  /** « Championnat Départemental » — code de numéro `CD`. */
  | 'championnat_departemental'
  /** « Championnat Régional ». */
  | 'championnat_regional'
  /* Les deux qui sont à nous, absentes de la liste fédérale. */
  /** Concours interne au club, hors fédération : pas de numéro. */
  | 'club'
  /** Coupe de France : le manuel la traite au menu « Championnat – Coupe » (§3.E). */
  | 'coupe_de_france'
  /**
   * **Ancienne valeur**, gardée pour les concours déjà en base : elle
   * confondait les quatre championnats de la liste fédérale. Plus proposée à la
   * saisie ; traitée comme un championnat départemental, seul dont le code soit
   * attesté.
   */
  | 'championnat';

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
   * Licence délivrée par une fédération étrangère (manuel §3.B.1, zone 21) :
   * code pays, par exemple `BE` ou `CH`. Le joueur **a** une licence, elle n'est
   * simplement pas française — la signaler manquante ferait chercher un numéro
   * qui n'existe pas. Le code sert aussi au contingent hors UE (§3.C).
   */
  licenceEtrangere?: string;
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
  /**
   * Comité départemental — la colonne « CD » de la grille d'inscription (manuel
   * §3.B.1, zone 15). Code fédéral à trois chiffres (`038`), affiché `CD38`.
   *
   * Appartient au joueur et non à l'équipe : la copie d'écran p.25 montre une
   * même équipe à trois comités différents. Voir `engine/comites.ts`.
   */
  comite?: string;
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
  /**
   * Interversions décidées par l'organisateur dans le classement des rondes,
   * quand les départages automatiques laissent une égalité (manuel, classeur des
   * phases finales). Enregistrées par équipe et non par rang : le classement est
   * vivant, une place ne désigne pas toujours la même équipe.
   */
  permutationsClassement?: PermutationClassement[];
  /** Comité départemental organisateur (ex. « CD 38 Isère »). */
  comiteOrganisateur?: string;
  /** Club organisateur. */
  clubOrganisateur?: string;
  /**
   * Numéro de concours fédéral (manuel §3.A) : ces trois codes s'ajoutent aux
   * **noms** ci-dessus, sans les remplacer — les documents remis au comité
   * portent les noms, le numéro porte les codes.
   *
   * `20261217_DEPT_PET_038_T_0423`
   *            ^^^^      ^^^ ^ ^^^^
   *          niveau   comité │ club
   *                      segment
   */
  /** Code du comité départemental, à trois chiffres (`038`). */
  comiteNumero?: string;
  /** Numéro fédéral du club, préfixe de comité compris (`0380423`). */
  clubNumero?: string;
  /**
   * Segment de catégorie du numéro (`T`, `DSMixte`, `ISM`…). Déduit des critères
   * quand toutes les abréviations sont attestées, saisi à la main sinon : le
   * manuel ne documente pas les cas féminin, cadet, minime, élite ni honneur.
   */
  segmentFederal?: string;
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
  /**
   * Nombre de rondes prévues (mêlée, système suisse) ou de séries (tir).
   *
   * En championnat, c'est le **marathon** du manuel §3.D.14.B : la rotation
   * circulaire s'arrête là au lieu de jouer le calendrier complet. Absent =
   * calendrier complet (chacun rencontre chacun).
   */
  nbRondes?: number;
  /**
   * Retirage à chaque tour du tableau principal (manuel §3.D.1.A) : les
   * vainqueurs sont tirés au sort dans les cases du tour suivant au lieu de
   * monter par la position dans l'arbre. Absent = arbre fixe, où le chemin
   * jusqu'à la finale est connu dès le tirage.
   */
  retirageParTour?: boolean;
  /**
   * « Tirage à la reprise » (manuel §3.D.1.A) : les qualifiés des poules
   * n'entrent pas au tableau au fil de l'eau, ils attendent que l'organisateur
   * tire. C'est le concours interrompu en fin de soirée, dont on veut tirer le
   * tour suivant le lendemain devant les équipes présentes.
   */
  tirageDiffere?: boolean;
  /**
   * Système suisse : n'opposer que des équipes à égalité **stricte** de
   * victoires (manuel §3.D.14.C, graphique 17), quitte à laisser des exempts.
   * Absent/false = appariement par classement, gagnant contre perdant toléré
   * (graphique 15).
   */
  ggStrict?: boolean;
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
  /**
   * Engagement réglé. **Ancien champ**, gardé en accord avec `mise` : une
   * tablette restée sur la version précédente ne lit que celui-ci. Voir
   * `engine/mises.ts`.
   */
  paid?: boolean;
  /**
   * Mise de l'équipe (manuel §3.B.1, zone 19) : le cadre « Mises » a **trois**
   * positions — Non Payé, Payé, Facturation. Absent sur les équipes inscrites
   * avant ce champ, où `paid` fait foi.
   */
  mise?: EtatMise;
  /**
   * Commentaire libre du cadre « Mises » (« chèque n° 214 », « facture au
   * comité »). Le champ est *dans* ce cadre sur la copie d'écran, d'où son nom.
   */
  commentaireMise?: string;
  /**
   * Horodatage du dépôt des licences (manuel §3.C) : l'équipe a présenté ses
   * licences à la table de marque. Absent = pas encore passée.
   */
  licencesDeposees?: string;
  /**
   * Retenue dans la « Liste Spécifique » (manuel §3.D.1.B.5.1) : sélection
   * cochée à la main pendant le concours, exportée pour amorcer le suivant.
   * C'est un choix de l'organisateur, jamais un calcul.
   */
  retenue?: boolean;
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
  /**
   * Retirage à chaque tour (manuel §3.D.1.A) : cette place reçoit le vainqueur
   * de la partie désignée, tirée au sort au moment où il arrive. Comme pour les
   * autres références, elle retient la **partie** et non l'équipe, si bien
   * qu'une correction en amont se répercute.
   */
  vainqueurDeA?: string;
  vainqueurDeB?: string;
  /**
   * Cette partie reçoit ses équipes par **tirage** et non par la position dans
   * l'arbre (manuel §3.D.1.A). Posé à la création du tableau : la donnée dit
   * elle-même comment elle se remplit, plutôt que de dépendre d'un réglage lu
   * ailleurs — deux mécanismes sur les mêmes cases se contrediraient.
   */
  retirage?: boolean;
  qualifFromA?: string;
  qualifFromB?: string;
  scoreA: number | null;
  scoreB: number | null;
  /**
   * Historique mène par mène (manuel, copie d'écran p.60 : « Evolution du
   * Score »). Facultatif : le score final reste la référence, ceci n'est qu'un
   * détail — et il doit toujours redonner ce score. Voir
   * `engine/evolutionScore.ts`.
   */
  menes?: Mene[];
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

/**
 * Fiche de la **base personnelle** de licenciés étrangers (manuel §3.B.1,
 * zone 21, fenêtre « Création Licence Etrangère : Base Personnelle »).
 *
 * Distincte de `Licencie`, qui porte les mêmes champs : le fichier des licenciés
 * est un import fédéral qu'on purge et remplace, alors que ces fiches sont
 * saisies à la main et doivent survivre à un réimport. Voir
 * `engine/licenceEtrangere.ts`.
 */
export interface LicencieEtranger {
  id: string;
  /** Numéro délivré par sa fédération — pas un numéro fédéral français. */
  licence?: string;
  nom: string;
  prenom: string;
  /** Date de naissance au format YYYY-MM-DD (saisie en JJ/MM/AAAA). */
  dateNaissance?: string;
  sexe?: Sexe;
  /** Code pays à deux lettres de sa fédération (`BE`, `CH`…). */
  pays: string;
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
export type EntityType =
  | 'concours'
  | 'team'
  | 'poule'
  | 'match'
  | 'licencie'
  | 'feuilleMatch'
  /** Photo du podium diffusée sur la page publique (manuel §3.D.1.B.5.5). */
  | 'photo'
  /** Fiche de la base personnelle de licenciés étrangers (§3.B.1, zone 21). */
  | 'licencieEtranger';

export const ENTITY_TYPES: EntityType[] = [
  'concours',
  'team',
  'poule',
  'match',
  'licencie',
  'feuilleMatch',
  // Tout ajout ici doit être fait dans `server/src/sync.ts` **dans le même
  // commit** : le serveur tient sa propre copie et ignore en silence un type
  // qu'il ne connaît pas, laissant l'entité bloquée sur l'appareil.
  'photo',
  'licencieEtranger',
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
