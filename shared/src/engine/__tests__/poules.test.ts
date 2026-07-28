import { describe, expect, it } from 'vitest';
import { drawPoules, pouleOutcome, pouleSizes } from '../poules';
import { validateScore, winnerOf } from '../match';
import { bySlot, makeTeams, playPouleSlot, testCtx } from './helpers';

describe('pouleSizes', () => {
  it('répartit en poules de 4 et de 3 selon la règle FFPJP', () => {
    expect(pouleSizes(4)).toEqual([4]);
    expect(pouleSizes(6)).toEqual([3, 3]);
    expect(pouleSizes(7)).toEqual([4, 3]);
    expect(pouleSizes(8)).toEqual([4, 4]);
    expect(pouleSizes(9)).toEqual([3, 3, 3]);
    expect(pouleSizes(10)).toEqual([4, 3, 3]);
    expect(pouleSizes(13)).toEqual([4, 3, 3, 3]);
    expect(pouleSizes(16)).toEqual([4, 4, 4, 4]);
    expect(pouleSizes(32)?.length).toBe(8);
  });

  it('refuse les effectifs impossibles', () => {
    expect(pouleSizes(2)).toBeNull();
    expect(pouleSizes(3)).toBeNull();
    expect(pouleSizes(5)).toBeNull();
  });
});

describe('drawPoules', () => {
  it('place chaque équipe exactement une fois', () => {
    const teams = makeTeams(16);
    const draw = drawPoules('c1', teams, testCtx())!;
    expect(draw.poules).toHaveLength(4);
    const placed = draw.poules.flatMap((p) => p.teamIds).sort();
    expect(placed).toEqual(teams.map((t) => t.id).sort());
  });

  it('crée 5 parties par poule de 4 et 3 par poule de 3', () => {
    const draw = drawPoules('c1', makeTeams(7), testCtx())!;
    const p4 = draw.poules.find((p) => p.teamIds.length === 4)!;
    const p3 = draw.poules.find((p) => p.teamIds.length === 3)!;
    expect(draw.matches.filter((m) => m.pouleId === p4.id)).toHaveLength(5);
    expect(draw.matches.filter((m) => m.pouleId === p3.id)).toHaveLength(3);
  });

  it('sépare les clubs quand c\'est possible', () => {
    const teams = makeTeams(16).map((t, i) => ({ ...t, club: `Club ${i % 4}` }));
    const draw = drawPoules('c1', teams, testCtx(7), { protections: [] })!;
    for (const poule of draw.poules) {
      const clubs = poule.teamIds.map(
        (id) => teams.find((t) => t.id === id)!.club,
      );
      expect(new Set(clubs).size).toBe(clubs.length);
    }
  });
});

describe('déroulement d\'une poule de 4', () => {
  it('enchaîne gagnants, perdants, barrage et qualifie 2 équipes', () => {
    const teams = makeTeams(4);
    const draw = drawPoules('c1', teams, testCtx())!;
    const poule = draw.poules[0]!;
    let matches = draw.matches;

    const m1 = bySlot(matches, poule.id, 'M1');
    const m2 = bySlot(matches, poule.id, 'M2');
    const [a, b] = [m1.teamAId!, m1.teamBId!];
    const [c, d] = [m2.teamAId!, m2.teamBId!];

    matches = playPouleSlot(poule, matches, 'M1', 13, 7); // a bat b
    matches = playPouleSlot(poule, matches, 'M2', 13, 5); // c bat d

    expect(bySlot(matches, poule.id, 'GAGNANTS').teamAId).toBe(a);
    expect(bySlot(matches, poule.id, 'GAGNANTS').teamBId).toBe(c);
    expect(bySlot(matches, poule.id, 'PERDANTS').teamAId).toBe(b);
    expect(bySlot(matches, poule.id, 'PERDANTS').teamBId).toBe(d);

    matches = playPouleSlot(poule, matches, 'GAGNANTS', 13, 9); // a qualifié 1er
    matches = playPouleSlot(poule, matches, 'PERDANTS', 13, 2); // d éliminé

    const barrage = bySlot(matches, poule.id, 'BARRAGE');
    expect(barrage.teamAId).toBe(c); // perdant des gagnants
    expect(barrage.teamBId).toBe(b); // vainqueur des perdants

    matches = playPouleSlot(poule, matches, 'BARRAGE', 6, 13); // b qualifié 2e

    const outcome = pouleOutcome(poule, matches.filter((m) => m.pouleId === poule.id));
    expect(outcome.complete).toBe(true);
    expect(outcome.q1).toBe(a);
    expect(outcome.q2).toBe(b);
    expect(outcome.eliminated.sort()).toEqual([c, d].sort());
  });

  it('réinitialise l\'aval quand un score amont est corrigé', () => {
    const draw = drawPoules('c1', makeTeams(4), testCtx())!;
    const poule = draw.poules[0]!;
    let matches = draw.matches;
    matches = playPouleSlot(poule, matches, 'M1', 13, 7);
    matches = playPouleSlot(poule, matches, 'M2', 13, 5);
    matches = playPouleSlot(poule, matches, 'GAGNANTS', 13, 9);

    // Correction : le résultat de M1 s'inverse.
    matches = playPouleSlot(poule, matches, 'M1', 2, 13);

    const g = bySlot(matches, poule.id, 'GAGNANTS');
    expect(g.done).toBe(false);
    expect(g.scoreA).toBeNull();
    expect(g.teamAId).toBe(bySlot(matches, poule.id, 'M1').teamBId);
  });
});

describe('déroulement d\'une poule de 3', () => {
  it('exempte la 3e équipe puis joue gagnants et barrage', () => {
    const teams = makeTeams(6);
    const draw = drawPoules('c1', teams, testCtx())!;
    const poule = draw.poules[0]!;
    let matches = draw.matches;
    const [tA, tB, tC] = poule.teamIds as [string, string, string];

    const m1 = bySlot(matches, poule.id, 'M1');
    expect([m1.teamAId, m1.teamBId]).toEqual([tA, tB]);
    expect(bySlot(matches, poule.id, 'GAGNANTS').teamBId).toBe(tC);

    matches = playPouleSlot(poule, matches, 'M1', 13, 10); // A bat B
    expect(bySlot(matches, poule.id, 'GAGNANTS').teamAId).toBe(tA);

    matches = playPouleSlot(poule, matches, 'GAGNANTS', 8, 13); // C bat A
    const barrage = bySlot(matches, poule.id, 'BARRAGE');
    expect(barrage.teamAId).toBe(tB);
    expect(barrage.teamBId).toBe(tA);

    matches = playPouleSlot(poule, matches, 'BARRAGE', 13, 12); // B bat A

    const outcome = pouleOutcome(poule, matches.filter((m) => m.pouleId === poule.id));
    expect(outcome.complete).toBe(true);
    expect(outcome.q1).toBe(tC);
    expect(outcome.q2).toBe(tB);
    expect(outcome.eliminated).toEqual([tA]);
  });
});

describe('validateScore', () => {
  it('applique la règle des 13 points', () => {
    expect(validateScore(13, 7, 13).ok).toBe(true);
    expect(validateScore(0, 13, 13).ok).toBe(true);
    expect(validateScore(12, 7, 13).ok).toBe(false);
    expect(validateScore(13, 13, 13).ok).toBe(false);
    expect(validateScore(14, 7, 13).ok).toBe(false);
    expect(validateScore(-1, 13, 13).ok).toBe(false);
    expect(validateScore(11, 5, 11).ok).toBe(true); // concours en 11 points
  });
});

describe('winnerOf', () => {
  it('gère les exempts', () => {
    const draw = drawPoules('c1', makeTeams(4), testCtx())!;
    const m = { ...draw.matches[0]!, byeB: true, teamBId: null, done: true };
    expect(winnerOf(m)).toBe(m.teamAId);
  });
});
