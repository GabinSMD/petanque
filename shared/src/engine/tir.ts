import type { Match, Team } from '../types';
import type { EngineCtx } from './ctx';

/**
 * Tir de précision : chaque participant tire des séries de 20 boules
 * (5 ateliers, boules à 0/1/3/5 points) — 100 points maximum par série.
 * Les séries réutilisent le modèle Match : stage 'ronde', round = n° de
 * série, teamAId = tireur, scoreA = points.
 */
export const TIR_MAX = 100;

/** Une partie « série » par participant. */
export function creerSerieTir(
  concoursId: string,
  players: Team[],
  serieIndex: number,
  ctx: EngineCtx,
): Match[] {
  if (players.length < 1) throw new Error('Il faut au moins un tireur');
  return players.map((p, position) => ({
    id: ctx.newId(),
    concoursId,
    stage: 'ronde' as const,
    round: serieIndex,
    position,
    teamAId: p.id,
    teamBId: null,
    scoreA: null,
    scoreB: null,
    done: false,
    terrain: null,
    updatedAt: ctx.now(),
  }));
}

export function validateTirScore(score: number): { ok: boolean; error?: string } {
  if (!Number.isInteger(score) || score < 0 || score > TIR_MAX) {
    return { ok: false, error: `Score entre 0 et ${TIR_MAX}` };
  }
  return { ok: true };
}

export interface TirStanding {
  id: string;
  /** Meilleure série (critère principal de classement). */
  best: number;
  /** Somme des séries (départage). */
  total: number;
  series: (number | null)[];
}

/** Classement : meilleure série, puis total. */
export function tirStandings(players: Team[], matches: Match[]): TirStanding[] {
  const series = matches.filter((m) => m.stage === 'ronde');
  const nbSeries = series.length ? Math.max(...series.map((m) => m.round)) + 1 : 0;
  const map = new Map<string, TirStanding>(
    players.map((p) => [
      p.id,
      { id: p.id, best: 0, total: 0, series: Array(nbSeries).fill(null) },
    ]),
  );
  for (const m of series) {
    if (!m.teamAId || !m.done || m.scoreA === null) continue;
    const s = map.get(m.teamAId);
    if (!s) continue;
    s.series[m.round] = m.scoreA;
    s.total += m.scoreA;
    if (m.scoreA > s.best) s.best = m.scoreA;
  }
  return [...map.values()].sort((a, b) => b.best - a.best || b.total - a.total);
}

/** Nombre de séries créées. */
export function seriesTirees(matches: Match[]): number {
  const series = matches.filter((m) => m.stage === 'ronde');
  return series.length ? Math.max(...series.map((m) => m.round)) + 1 : 0;
}

/** Toutes les feuilles de la série sont-elles saisies ? */
export function serieComplete(matches: Match[], serieIndex: number): boolean {
  const ms = matches.filter((m) => m.stage === 'ronde' && m.round === serieIndex);
  return ms.length > 0 && ms.every((m) => m.done);
}
