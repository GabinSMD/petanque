import { describe, expect, it } from 'vitest';
import {
  creerSerieTir,
  serieComplete,
  seriesTirees,
  tirStandings,
  validateTirScore,
} from '../tir';
import type { Match } from '../../types';
import { makeTeams, testCtx } from './helpers';

function score(matches: Match[], playerId: string, round: number, points: number): Match[] {
  return matches.map((m) =>
    m.teamAId === playerId && m.round === round
      ? { ...m, scoreA: points, done: true }
      : m,
  );
}

describe('tir de précision', () => {
  it('crée une feuille de tir par participant et par série', () => {
    const players = makeTeams(3);
    const s1 = creerSerieTir('c1', players, 0, testCtx());
    expect(s1).toHaveLength(3);
    expect(new Set(s1.map((m) => m.teamAId)).size).toBe(3);
    expect(seriesTirees(s1)).toBe(1);
    expect(serieComplete(s1, 0)).toBe(false);
  });

  it('valide les scores entre 0 et 100', () => {
    expect(validateTirScore(0).ok).toBe(true);
    expect(validateTirScore(100).ok).toBe(true);
    expect(validateTirScore(57).ok).toBe(true);
    expect(validateTirScore(-1).ok).toBe(false);
    expect(validateTirScore(101).ok).toBe(false);
    expect(validateTirScore(12.5).ok).toBe(false);
  });

  it('classe au meilleur score puis au total', () => {
    const players = makeTeams(3); // t1, t2, t3
    const ctx = testCtx();
    let matches = [
      ...creerSerieTir('c1', players, 0, ctx),
      ...creerSerieTir('c1', players, 1, ctx),
    ];
    expect(seriesTirees(matches)).toBe(2);

    matches = score(matches, 't1', 0, 35);
    matches = score(matches, 't1', 1, 20);
    matches = score(matches, 't2', 0, 35);
    matches = score(matches, 't2', 1, 30); // même meilleur que t1, total supérieur
    matches = score(matches, 't3', 0, 50); // meilleure série
    matches = score(matches, 't3', 1, 0);

    expect(serieComplete(matches, 0)).toBe(true);
    expect(serieComplete(matches, 1)).toBe(true);

    const standings = tirStandings(players, matches);
    expect(standings.map((s) => s.id)).toEqual(['t3', 't2', 't1']);
    expect(standings[0]!.best).toBe(50);
    expect(standings[1]!.total).toBe(65);
    expect(standings[2]!.series).toEqual([35, 20]);
  });
});
