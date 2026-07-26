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
};

export const STATUS_LABELS: Record<ConcoursStatus, string> = {
  inscriptions: 'Inscriptions',
  poules: 'Poules en cours',
  tableau: 'Tableau en cours',
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
