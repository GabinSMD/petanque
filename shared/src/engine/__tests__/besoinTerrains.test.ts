import { describe, expect, it } from 'vitest';
import { besoinTerrains, terrainsSimultanes } from '../besoinTerrains';

describe('terrains occupés en même temps par des poules', () => {
  it('deux par poule de 4, un par poule de 3', () => {
    // La règle vient de `pouleSizes`, où elle servait déjà à choisir la
    // répartition quand les terrains manquent : une poule de 4 lance ses deux
    // premières parties ensemble, une poule de 3 une seule.
    expect(terrainsSimultanes([4, 4, 4])).toBe(6);
    expect(terrainsSimultanes([4, 4, 3])).toBe(5);
    expect(terrainsSimultanes([3, 3])).toBe(2);
    expect(terrainsSimultanes([])).toBe(0);
  });
});

describe('besoin en terrains avant le tirage (§3.B.6)', () => {
  const base = { nbTerrains: 8, scoreMax: 13 };

  it('en poules, suit la répartition que le tirage va produire', () => {
    // 16 équipes : quatre poules de 4, donc huit terrains.
    expect(besoinTerrains({ ...base, mode: 'poules' }, 16)?.necessaires).toBe(8);
    // 15 équipes : trois poules de 4 et une de 3, donc sept.
    expect(besoinTerrains({ ...base, mode: 'poules' }, 15)?.necessaires).toBe(7);
  });

  it('en élimination directe, compte les parties réelles du premier tour', () => {
    // 16 équipes : huit parties. 12 équipes dans un tableau de 16 : quatre
    // parties et quatre exemptes.
    expect(besoinTerrains({ ...base, mode: 'elimination_directe' }, 16)?.necessaires).toBe(8);
    expect(besoinTerrains({ ...base, mode: 'elimination_directe' }, 12)?.necessaires).toBe(4);
    expect(besoinTerrains({ ...base, mode: 'elimination_directe' }, 5)?.necessaires).toBe(1);
  });

  it('en rondes, la moitié de l\'effectif, l\'exempte arrondie vers le haut', () => {
    for (const mode of ['suisse', 'melee', 'championnat'] as const) {
      expect(besoinTerrains({ ...base, mode }, 16)?.necessaires, mode).toBe(8);
      expect(besoinTerrains({ ...base, mode }, 15)?.necessaires, mode).toBe(8);
    }
  });

  it('ne rend rien pour le tir de précision : des ateliers, pas des terrains', () => {
    // Cinq ateliers de tir, quel que soit l'effectif : annoncer un nombre de
    // terrains n'aurait aucun sens.
    expect(besoinTerrains({ ...base, mode: 'tir_precision' }, 16)).toBeUndefined();
  });

  it('ne rend rien sur un effectif que les poules refusent', () => {
    // 5 équipes ne se répartissent pas en poules de 3 et 4 : le tirage lui-même
    // refusera, et un besoin inventé n'aiderait pas.
    expect(besoinTerrains({ ...base, mode: 'poules' }, 5)).toBeUndefined();
    expect(besoinTerrains({ ...base, mode: 'poules' }, 0)).toBeUndefined();
  });

  it('ne rend rien en dessous de deux équipes, quel que soit le mode', () => {
    // Le sabotage a montré que mon test ne couvrait que les poules, où
    // `pouleSizes` refuse déjà. Ailleurs, l'absence de garde donnait des
    // absurdités : une seule équipe en élimination directe demandait **0,5
    // terrain**, et zéro équipe en rondes en demandait zéro — un nombre juste
    // qui n'a aucun sens à annoncer.
    for (const mode of ['poules', 'elimination_directe', 'suisse', 'melee', 'championnat'] as const) {
      expect(besoinTerrains({ ...base, mode }, 1), mode).toBeUndefined();
      expect(besoinTerrains({ ...base, mode }, 0), mode).toBeUndefined();
    }
  });

  it('un besoin est toujours un entier positif', () => {
    for (const mode of ['poules', 'elimination_directe', 'suisse', 'melee', 'championnat'] as const) {
      for (const n of [2, 3, 4, 7, 12, 15, 16, 31, 32]) {
        const r = besoinTerrains({ ...base, mode }, n);
        if (!r) continue;
        expect(Number.isInteger(r.necessaires), `${mode} ${n}`).toBe(true);
        expect(r.necessaires, `${mode} ${n}`).toBeGreaterThan(0);
      }
    }
  });

  it('reporte les terrains disponibles tels que le concours les déclare', () => {
    expect(besoinTerrains({ ...base, mode: 'poules', nbTerrains: 6 }, 16)?.disponibles).toBe(6);
  });

  it('en poules, la répartition s\'adapte d\'abord aux terrains disponibles', () => {
    // Découvert en écrivant ce test : `pouleSizes` ajoute des poules de 3 quand
    // les terrains manquent (§3.A zone 8). Seize équipes sur six terrains
    // deviennent une poule de 4 et quatre de 3 — six parties simultanées, ça
    // tient. Le besoin annoncé tient donc compte de l'adaptation, et il ne sert à
    // rien d'annoncer un manque que le tirage évite.
    const six = besoinTerrains({ ...base, mode: 'poules', nbTerrains: 6 }, 16);
    expect(six?.necessaires).toBe(6);
    expect(six?.suffisants).toBe(true);
  });

  it('dit quand les terrains manquent vraiment, et de combien', () => {
    // Trois terrains pour seize équipes : même la répartition la moins gourmande
    // en demande six. C'est tout l'intérêt du rapport — le savoir avant, pas
    // quand les équipes attendent.
    const court = besoinTerrains({ ...base, mode: 'poules', nbTerrains: 3 }, 16);
    expect(court?.necessaires).toBe(6);
    expect(court?.suffisants).toBe(false);
    expect(court?.manquants).toBe(3);
  });

  it('en élimination directe, aucune adaptation possible : le manque se dit', () => {
    // Un tableau ne se réarrange pas selon les jeux : 32 équipes font seize
    // parties au premier tour, quoi qu'il arrive.
    const ed = besoinTerrains({ ...base, mode: 'elimination_directe', nbTerrains: 8 }, 32);
    expect(ed?.necessaires).toBe(16);
    expect(ed?.suffisants).toBe(false);
    expect(ed?.manquants).toBe(8);
  });

  it('assez de terrains : rien ne manque', () => {
    const large = besoinTerrains({ ...base, mode: 'poules', nbTerrains: 10 }, 16);
    expect(large?.suffisants).toBe(true);
    expect(large?.manquants).toBe(0);
  });

  it('sans terrains déclarés, ne prétend pas qu\'ils manquent', () => {
    // `nbTerrains` à 0 veut dire « non renseigné » dans la fenêtre fédérale
    // elle-même : on annonce le besoin sans juger de la disponibilité.
    const r = besoinTerrains({ ...base, mode: 'poules', nbTerrains: 0 }, 16);
    expect(r?.necessaires).toBe(8);
    expect(r?.suffisants).toBeUndefined();
  });
});
