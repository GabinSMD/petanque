import type { Match } from '../types';

/** Vainqueur d'une partie terminée (null sinon). */
export function winnerOf(m: Match | undefined | null): string | null {
  if (!m || !m.done) return null;
  if (m.byeA) return m.teamBId;
  if (m.byeB) return m.teamAId;
  if (m.scoreA === null || m.scoreB === null) return null;
  return m.scoreA > m.scoreB ? m.teamAId : m.teamBId;
}

/** Perdant d'une partie terminée (null si exempt ou non jouée). */
export function loserOf(m: Match | undefined | null): string | null {
  if (!m || !m.done) return null;
  if (m.byeA || m.byeB) return null;
  if (m.scoreA === null || m.scoreB === null) return null;
  return m.scoreA > m.scoreB ? m.teamBId : m.teamAId;
}

/** Une partie exemptée se termine d'elle-même dès que l'équipe est connue. */
export function isByeMatch(m: Match): boolean {
  return Boolean(m.byeA || m.byeB);
}

export interface ScoreValidation {
  ok: boolean;
  error?: string;
}

/**
 * Règle pétanque : la partie se joue en `scoreMax` points (13),
 * le perdant reste strictement en dessous.
 */
export function validateScore(scoreA: number, scoreB: number, scoreMax: number): ScoreValidation {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { ok: false, error: 'Scores entiers requis' };
  }
  if (scoreA < 0 || scoreB < 0) {
    return { ok: false, error: 'Score négatif impossible' };
  }
  if (scoreA === scoreB) {
    return { ok: false, error: 'Pas de match nul en pétanque' };
  }
  const hi = Math.max(scoreA, scoreB);
  const lo = Math.min(scoreA, scoreB);
  if (hi !== scoreMax) {
    return { ok: false, error: `Le gagnant doit marquer ${scoreMax} points` };
  }
  if (lo >= scoreMax) {
    return { ok: false, error: `Le perdant doit rester sous ${scoreMax}` };
  }
  return { ok: true };
}

/** Clone superficiel utilisé avant toute modification par le moteur. */
export function cloneMatch(m: Match): Match {
  return { ...m };
}
