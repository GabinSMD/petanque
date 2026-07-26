import type { ConcoursMode, ConcoursStatus, TeamFormat } from '@shared';

export const FORMAT_LABELS: Record<TeamFormat, string> = {
  tete_a_tete: 'Tête-à-tête',
  doublette: 'Doublette',
  triplette: 'Triplette',
};

export const PLAYERS_PER_TEAM: Record<TeamFormat, number> = {
  tete_a_tete: 1,
  doublette: 2,
  triplette: 3,
};

export const MODE_LABELS: Record<ConcoursMode, string> = {
  poules: 'Poules puis élimination',
  elimination_directe: 'Élimination directe',
  melee: 'Mêlée tournante',
  suisse: 'Système suisse',
  championnat: 'Championnat (toutes rondes)',
  tir_precision: 'Tir de précision',
};

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
