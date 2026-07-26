import { describe, expect, it } from 'vitest';
import { drawPoules } from '../poules';
import { drawElimination, seedSlotOrder, winnerOf } from '../bracket';
import { isByeMatch } from '../match';
import { makeTeams, testCtx } from './helpers';

describe('têtes de série — poules', () => {
  it('répartit les têtes de série dans des poules différentes', () => {
    const teams = makeTeams(16); // 4 poules de 4
    const seeds = ['t1', 't2', 't3', 't4'];
    const draw = drawPoules('c1', teams, testCtx(3), { seeds })!;
    expect(draw.poules).toHaveLength(4);
    // Chaque poule contient exactement une tête de série.
    for (const poule of draw.poules) {
      const inPoule = poule.teamIds.filter((id) => seeds.includes(id));
      expect(inPoule).toHaveLength(1);
    }
    // Toutes les équipes placées une fois.
    const placed = draw.poules.flatMap((p) => p.teamIds).sort();
    expect(placed).toEqual(teams.map((t) => t.id).sort());
  });

  it('fonctionne avec moins de têtes que de poules', () => {
    const teams = makeTeams(16);
    const draw = drawPoules('c1', teams, testCtx(5), { seeds: ['t1', 't2'] })!;
    const poulesWithSeed1 = draw.poules.filter((p) => p.teamIds.includes('t1'));
    const poulesWithSeed2 = draw.poules.filter((p) => p.teamIds.includes('t2'));
    expect(poulesWithSeed1).toHaveLength(1);
    expect(poulesWithSeed2).toHaveLength(1);
    expect(poulesWithSeed1[0]).not.toBe(poulesWithSeed2[0]);
  });
});

describe('seedSlotOrder', () => {
  it('produit le placement standard des têtes de série', () => {
    // Standard : dans chaque paire, tête k contre tête (taille+1−k).
    expect(seedSlotOrder(2)).toEqual([1, 2]);
    expect(seedSlotOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedSlotOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    // Tête 1 première ; têtes 1 et 2 dans des moitiés opposées.
    const o = seedSlotOrder(8);
    expect(o[0]).toBe(1);
    expect(o.indexOf(1) < 4).toBe(true);
    expect(o.indexOf(2) >= 4).toBe(true);
  });
});

describe('têtes de série — élimination', () => {
  it('8 équipes : têtes 1 et 2 dans des moitiés opposées', () => {
    const teams = makeTeams(8);
    const matches = drawElimination('c1', 'principal', teams, testCtx(7), {
      seeds: ['t1', 't2'],
    });
    const round0 = matches.filter((m) => m.round === 0).sort((a, b) => a.position - b.position);
    // 4 parties : positions 0-1 = moitié haute, 2-3 = moitié basse.
    const half = (id: string) => {
      const idx = round0.findIndex((m) => m.teamAId === id || m.teamBId === id);
      return idx < round0.length / 2 ? 0 : 1;
    };
    expect(round0[0]!.teamAId).toBe('t1'); // tête 1 en tête du tableau
    expect(half('t1')).not.toBe(half('t2'));
  });

  it('12 équipes : exempts attribués aux têtes de série', () => {
    const teams = makeTeams(12);
    const seeds = ['t1', 't2', 't3', 't4'];
    const matches = drawElimination('c1', 'principal', teams, testCtx(2), { seeds });
    const round0 = matches.filter((m) => m.round === 0);
    expect(round0).toHaveLength(8); // tableau de 16
    const byes = round0.filter(isByeMatch);
    expect(byes).toHaveLength(4); // 16 - 12

    // Les 4 têtes de série sont exemptées (elles passent le tour).
    for (const seed of seeds) {
      const inBye = byes.some((m) => m.teamAId === seed || m.teamBId === seed);
      expect(inBye).toBe(true);
    }
  });

  it('place toutes les équipes une seule fois', () => {
    const teams = makeTeams(11);
    const matches = drawElimination('c1', 'principal', teams, testCtx(9), {
      seeds: ['t1', 't2', 't3'],
    });
    const placed = matches
      .filter((m) => m.round === 0)
      .flatMap((m) => [m.teamAId, m.teamBId])
      .filter((id): id is string => Boolean(id));
    expect(new Set(placed).size).toBe(11);
  });
});
