import { describe, expect, it } from 'vitest';
import {
  autoAssignTerrains,
  freeTerrains,
  terrainBoard,
  terrainsPoule,
} from '../terrains';
import { pouleSizes } from '../poules';
import type { Match } from '../../types';

function live(id: string, terrain: number | null): Match {
  return {
    id, concoursId: 'c1', stage: 'principal', round: 0, position: Number(id.slice(1)),
    teamAId: 'a' + id, teamBId: 'b' + id, scoreA: null, scoreB: null,
    done: false, terrain, updatedAt: '2026-07-28T00:00:00.000Z',
  };
}

describe('terrains bloqués', () => {
  it('un terrain bloqué apparaît comme tel sur le plateau', () => {
    const board = terrainBoard([], 4, 0, [2]);
    expect(board.map((t) => t.number)).toEqual([1, 2, 3, 4]);
    expect(board.find((t) => t.number === 2)!.bloque).toBe(true);
    expect(board.find((t) => t.number === 1)!.bloque).toBe(false);
  });

  it('un terrain bloqué n est pas libre', () => {
    expect(freeTerrains([], 4, 0, [2, 3])).toEqual([1, 4]);
  });

  it('l affectation automatique évite les terrains bloqués', () => {
    const matches = [live('m1', null), live('m2', null)];
    expect(autoAssignTerrains(matches, 4, 0, [1]).map((a) => a.terrain)).toEqual([2, 3]);
  });

  it('un terrain bloqué mais occupé reste signalé occupé', () => {
    // Cas réel : on bloque un terrain où une partie est en cours, pour qu'il
    // ne soit pas réattribué ensuite.
    const board = terrainBoard([live('m1', 2)], 3, 0, [2]);
    const t2 = board.find((t) => t.number === 2)!;
    expect(t2.bloque).toBe(true);
    expect(t2.match?.id).toBe('m1');
  });

  it('le décalage s applique aussi aux terrains bloqués', () => {
    expect(freeTerrains([], 3, 50, [52])).toEqual([51, 53]);
  });
});

describe('convention fédérale des terrains de poule', () => {
  it('chaque poule occupe deux jeux voisins : impair en haut, pair en bas', () => {
    expect(terrainsPoule(1)).toEqual({ haut: 1, bas: 2 });
    expect(terrainsPoule(2)).toEqual({ haut: 3, bas: 4 });
    expect(terrainsPoule(5)).toEqual({ haut: 9, bas: 10 });
  });

  it('suit le décalage de numérotation', () => {
    expect(terrainsPoule(1, 50)).toEqual({ haut: 51, bas: 52 });
    expect(terrainsPoule(3, 100)).toEqual({ haut: 105, bas: 106 });
  });
});

describe('répartition des poules selon les terrains disponibles', () => {
  it('sans contrainte, privilégie les poules de 4', () => {
    expect(pouleSizes(12)).toEqual([4, 4, 4]);
    expect(pouleSizes(7)).toEqual([4, 3]);
  });

  it('avec peu de terrains, préfère des poules de 3', () => {
    // 12 équipes : 3 poules de 4 demandent 6 jeux simultanés, 4 poules de 3
    // n'en demandent que 4.
    expect(pouleSizes(12, 4)).toEqual([3, 3, 3, 3]);
  });

  it('assez de terrains : la répartition fédérale est conservée', () => {
    expect(pouleSizes(12, 6)).toEqual([4, 4, 4]);
    expect(pouleSizes(12, 99)).toEqual([4, 4, 4]);
  });

  it('trop peu de terrains pour tout mélange : prend le moins gourmand', () => {
    // 12 équipes, 2 jeux : aucun mélange ne tient, on prend le minimum (4×3).
    expect(pouleSizes(12, 2)).toEqual([3, 3, 3, 3]);
  });

  it('un effectif sans solution reste sans solution', () => {
    expect(pouleSizes(5)).toBeNull();
    expect(pouleSizes(5, 4)).toBeNull();
  });

  it('les tailles somment toujours à l effectif', () => {
    for (const n of [4, 6, 7, 8, 9, 10, 11, 12, 15, 16, 20, 24, 33]) {
      for (const terrains of [undefined, 2, 4, 6, 8, 20]) {
        const sizes = pouleSizes(n, terrains);
        if (!sizes) continue;
        expect(sizes.reduce((a, b) => a + b, 0), `${n} équipes, ${terrains} terrains`).toBe(n);
      }
    }
  });
});
