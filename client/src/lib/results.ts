import type { Concours, Match, Poule, Team } from '@shared';
import { bracketRanking, rondeStandings, tirStandings, type RankGroup } from '@shared';
import { isRondesMode, isTirMode } from './labels';

/**
 * Classement final normalisé, toutes formules confondues : liste de groupes
 * (rang, libellé, équipes). Pour les tableaux, c'est le classement du
 * concours principal ; pour les rondes / le tir, chaque participant a son
 * propre rang.
 */
export function finalRanking(
  concours: Concours,
  teams: Team[],
  _poules: Poule[],
  matches: Match[],
): RankGroup[] {
  const active = teams.filter((t) => !t.forfait);
  if (isTirMode(concours.mode)) {
    return tirStandings(active, matches).map((s, i) => ({
      rank: i + 1,
      label: `${i + 1}${i === 0 ? 'er' : 'e'}`,
      teamIds: [s.id],
    }));
  }
  if (isRondesMode(concours.mode)) {
    return rondeStandings(active, matches).map((s, i) => ({
      rank: i + 1,
      label: `${i + 1}${i === 0 ? 'er' : 'e'}`,
      teamIds: [s.id],
    }));
  }
  return bracketRanking(matches, 'principal');
}

/** Vainqueur(s) d'un concours terminé (rang 1 du classement final). */
export function concoursWinners(
  concours: Concours,
  teams: Team[],
  poules: Poule[],
  matches: Match[],
): string[] {
  return finalRanking(concours, teams, poules, matches).find((g) => g.rank === 1)?.teamIds ?? [];
}
