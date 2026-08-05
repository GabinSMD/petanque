import type { CategorieCritere, ConcoursMode, ConcoursStatus, EtatMise, CritereClassification, CritereSexe, Discipline, Formule, NiveauConcours, RolePetanque, TeamFormat } from '@shared';
import type { AnomalieEquipe, ChampLicence } from '@shared';

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  petanque: 'Pétanque',
  jeu_provencal: 'Jeu provençal',
};

export const FORMAT_LABELS: Record<TeamFormat, string> = {
  tete_a_tete: 'Tête-à-tête',
  doublette: 'Doublette',
  triplette: 'Triplette',
};

/**
 * Rôles de jeu. Absents du manuel fédéral : ils ne servent qu'au tirage des
 * mêlées, pour éviter une équipe de trois pointeurs.
 */
export const ROLE_LABELS: Record<RolePetanque, string> = {
  pointeur: 'Pointeur',
  milieu: 'Milieu',
  tireur: 'Tireur',
};

/** Marque courte, pour les listes et l'annonce au micro. */
export const ROLE_ABREGE: Record<RolePetanque, string> = {
  pointeur: 'P',
  milieu: 'M',
  tireur: 'T',
};

export const MODE_LABELS: Record<ConcoursMode, string> = {
  poules: 'Poules puis élimination',
  elimination_directe: 'Élimination directe',
  melee: 'Mêlée tournante',
  suisse: 'Système suisse',
  championnat: 'Championnat (toutes rondes)',
  tir_precision: 'Tir de précision',
};

/**
 * Formules fédérales du tableau (manuel « Gestion Concours » §3.D.8 à
 * §3.D.12). Libellés en langage courant : « A / B / C » ne parle qu'aux
 * habitués, on nomme donc les tableaux comme dans l'application.
 */
export const FORMULE_LABELS: Record<Formule, string> = {
  a: 'Un seul tableau',
  ab: 'Tableau + consolante',
  abc: 'Tableau + consolante + complémentaire',
  abc_recup: 'Avec repêchage au cadrage (A-B-C récup.)',
  abc_cd19: 'Avec repêchage vers le complémentaire (CD19)',
  abc_cd53: 'Double repêchage au cadrage (CD53)',
};

export const FORMULE_HINTS: Record<Formule, string> = {
  a: 'Qui perd sort, définitivement.',
  ab: 'Les perdants du 1er tour rejouent dans la consolante.',
  abc: 'Les perdants du 1er tour de la consolante rejouent dans un 3e tableau.',
  abc_recup:
    'Comme ci-dessus, et les perdants du 2e tour du tableau principal entrent directement au 2e tour de la consolante (le « cadrage ») — la formule des concours officiels A-B-C.',
  abc_cd19:
    'Comme A-B-C, mais les perdants du 2e tour du tableau principal partent au complémentaire au lieu de la consolante (usage CD19).',
  abc_cd53:
    'Comme le repêchage au cadrage, et en plus les perdants du 2e tour de la consolante entrent au 2e tour du complémentaire (usage CD53).',
};

/** Formules proposées à la création (élimination directe). */
export const FORMULE_CHOICES: Formule[] = [
  'a',
  'ab',
  'abc',
  'abc_recup',
  'abc_cd19',
  'abc_cd53',
];

export interface ModeInfo {
  emoji: string;
  /** Accroche en langage courant, pour les novices. */
  tagline: string;
  description: string;
  /** Inscriptions individuelles (équipes tirées au sort à chaque ronde). */
  individual?: boolean;
  /** Formule « en rondes » (pas d'élimination, classement final). */
  rondes?: boolean;
  /** Discipline en séries de tir (pas de parties). */
  tir?: boolean;
  /** La consolante a du sens pour cette formule. */
  consolante?: boolean;
}

export const MODE_INFO: Record<ConcoursMode, ModeInfo> = {
  poules: {
    emoji: '🎯',
    tagline: 'Le classique des concours officiels',
    description:
      'Poules de 3 ou 4 équipes avec barrage : 2 qualifiés par poule, puis tableau final. Le déroulement FFPJP.',
    consolante: true,
  },
  elimination_directe: {
    emoji: '⚡',
    tagline: 'Rapide : qui perd sort',
    description:
      'Un tableau à la coupe, tiré au sort. Avec la consolante, les perdants du 1er tour rejouent dans un second tableau.',
    consolante: true,
  },
  melee: {
    emoji: '🎲',
    tagline: 'Idéal club & amis — chacun pour soi',
    description:
      'Chacun s\'inscrit seul : les équipes sont tirées au sort à chaque ronde (une triplette peut rencontrer une doublette) et le classement est individuel.',
    individual: true,
    rondes: true,
  },
  suisse: {
    emoji: '⚖️',
    tagline: 'Personne n\'est éliminé',
    description:
      'Tout le monde joue le même nombre de parties : à chaque ronde, les équipes de niveau égal se rencontrent. Classement aux victoires puis au goal-average.',
    rondes: true,
  },
  championnat: {
    emoji: '🏅',
    tagline: 'Chacun rencontre chacun',
    description:
      'Toutes les rencontres sont jouées (idéal jusqu\'à 8 équipes environ). Le calendrier complet est généré d\'un coup.',
    rondes: true,
  },
  tir_precision: {
    emoji: '🏹',
    tagline: 'La discipline de précision',
    description:
      'Chaque tireur réalise des séries de 20 boules sur 5 ateliers (100 points max). Classement à la meilleure série, départage au total.',
    individual: true,
    tir: true,
  },
};

export function isTirMode(mode: ConcoursMode): boolean {
  return MODE_INFO[mode].tir === true;
}

/** Libellé de statut contextualisé (les séries du tir sont des « rondes »). */
export function statusLabel(mode: ConcoursMode, status: ConcoursStatus): string {
  if (isTirMode(mode) && status === 'rondes') return 'Séries en cours';
  return STATUS_LABELS[status];
}

export function isRondesMode(mode: ConcoursMode): boolean {
  return MODE_INFO[mode].rondes === true;
}

export function isIndividualMode(mode: ConcoursMode): boolean {
  return MODE_INFO[mode].individual === true;
}

export function entrantWord(mode: ConcoursMode, plural = false): string {
  const word = isTirMode(mode) ? 'tireur' : isIndividualMode(mode) ? 'participant' : 'équipe';
  return plural ? `${word}s` : word;
}

/** Les trois positions du cadre « Mises » (manuel §3.B.1, zone 19). */
export const ETAT_MISE_LABELS: Record<EtatMise, string> = {
  non_paye: 'Non payé',
  paye: 'Payé',
  facturation: 'Facturation',
};

export const STATUS_LABELS: Record<ConcoursStatus, string> = {
  inscriptions: 'Inscriptions',
  poules: 'Poules en cours',
  tableau: 'Tableau en cours',
  rondes: 'Rondes en cours',
  termine: 'Terminé',
};

export const POULE_SLOT_LABELS: Record<string, string> = {
  M1: '1ère partie',
  M2: '2e partie',
  GAGNANTS: 'Gagnants',
  PERDANTS: 'Perdants',
  BARRAGE: 'Barrage',
};

export function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** Date longue « Samedi 26/07/2026 » (en-têtes de journée). */
export function dateLongFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[day]} ${formatDateFr(iso)}`;
}

/** Catégories FFPJP courantes, proposées à la création (champ libre). */
export const CATEGORY_SUGGESTIONS = [
  'Seniors',
  'Vétérans',
  'Féminines',
  'Jeunes',
  'Juniors',
  'Cadets',
  'Minimes',
  'Promotion',
  'Honneur',
  'Open',
  'Mixte',
];

/** Nom de concours proposé automatiquement dans l'assistant de création. */
export function suggestedName(mode: ConcoursMode, format: TeamFormat, date: string): string {
  if (mode === 'tir_precision') return `Tir de précision du ${formatDateFr(date)}`;
  const prefix: Record<ConcoursMode, string> = {
    poules: 'Concours',
    elimination_directe: 'Concours',
    melee: 'Mêlée',
    suisse: 'Concours (suisse)',
    championnat: 'Championnat',
    tir_precision: 'Tir de précision',
  };
  const f = FORMAT_LABELS[format].toLowerCase();
  const fPlural = format === 'tete_a_tete' ? f : `${f}s`;
  return `${prefix[mode]} ${fPlural} du ${formatDateFr(date)}`;
}

/* ------------------------------------------------------------------ */
/* Contrôle des licences                                               */
/* ------------------------------------------------------------------ */

export const CATEGORIE_AGE_LABELS: Record<CategorieCritere, string> = {
  veterans: 'Vétérans (60 ans et plus)',
  // §3.E : catégorie de sélection des compétitions de clubs. Personne n'« est »
  // +55 — c'est un plancher qu'un concours exige.
  plus55: '+55 (55 ans et plus)',
  seniors: 'Séniors (18 ans et plus)',
  juniors: 'Juniors (15 à 17 ans)',
  cadets: 'Cadets (12 à 14 ans)',
  minimes: 'Minimes (9 à 11 ans)',
  benjamins: 'Benjamins (moins de 9 ans)',
};

export const CRITERE_SEXE_LABELS: Record<CritereSexe, string> = {
  tous: 'Ouvert à tous',
  masculin: 'Masculin',
  feminin: 'Féminin',
  mixte: 'Mixte (au moins 1 homme et 1 femme)',
};

export const CRITERE_CLASSIFICATION_LABELS: Record<CritereClassification, string> = {
  tous: 'Toutes classifications',
  elite: 'Élite',
  honneur: 'Honneur',
  // L'étiquette fédérale est bien « Promotion/NC » : ce critère accepte les
  // non-classés, là où « Non Classé » les exige.
  promotion: 'Promotion ou non classé',
  nonClasse: 'Non classé seulement',
};

/** Champ en anomalie → formulation lisible à la table de marque. */
export const ANOMALIE_LABELS: Record<ChampLicence, string> = {
  licence: 'n° de licence manquant',
  anneeReprise: 'licence non renouvelée',
  dateNaissance: "catégorie d'âge",
  sexe: 'sexe',
  classification: 'classification',
  certificatMedical: 'certificat médical',
  club: 'club',
};

export const ANOMALIE_EQUIPE_LABELS: Record<AnomalieEquipe, string> = {
  mixte: 'équipe non mixte',
  homogeneite: 'équipe non homogène',
  mutes: 'trop de joueurs mutés',
  horsUE: 'plus d\'un joueur hors Union européenne',
  // Le libellé du manuel dit ce qu'il faut faire, pas seulement ce qui est faux.
  clubEquipeNonHomogene: 'club d\'équipe incorrect : devrait être N.H.',
  clubEquipeErrone: 'club d\'équipe incorrect : les joueurs ne sont pas de ce club',
};

/**
 * Libellés des niveaux, dans les mots de la liste fédérale (manuel §3.A). Le
 * choix des mots n'est pas cosmétique : « Championnat » tout court ne permettait
 * pas de dire lequel des quatre, donc pas de composer un numéro de concours.
 */
export const NIVEAU_LABELS: Record<NiveauConcours, string> = {
  departemental: 'Concours départemental',
  regional: 'Concours régional',
  championnat_departemental_honorifique: 'Championnat départemental honorifique',
  national: 'National',
  international: 'International',
  qualificatif_departemental: 'Qualificatif départemental',
  championnat_departemental: 'Championnat départemental',
  championnat_regional: 'Championnat régional',
  club: 'Concours de club',
  coupe_de_france: 'Coupe de France',
  // Ancienne valeur : ne s'affiche que sur les concours qui la portent déjà.
  championnat: 'Championnat (ancien libellé)',
};
