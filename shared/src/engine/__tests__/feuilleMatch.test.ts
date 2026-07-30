import { describe, expect, it } from 'vitest';
import {
  BAREME_CDC,
  bilanRencontre,
  feuilleDepuisMemoire,
  feuilleVierge,
  partiesVides,
  pointsEnJeu,
  type PartieRencontre,
} from '../feuilleMatch';

/** Feuille où le camp A gagne les `nbA` premières parties, B le reste. */
function jouee(nbA: number): PartieRencontre[] {
  return partiesVides(BAREME_CDC).map((p, i) =>
    i < nbA ? { ...p, scoreA: 13, scoreB: 7 } : { ...p, scoreA: 6, scoreB: 13 },
  );
}

describe('barème de la rencontre', () => {
  it('les 11 parties de la feuille du CD26', () => {
    expect(BAREME_CDC.blocs.map((b) => [b.type, b.nb, b.points])).toEqual([
      ['tete_a_tete', 6, 2],
      ['doublette', 3, 4],
      ['triplette', 2, 6],
    ]);
    expect(partiesVides(BAREME_CDC)).toHaveLength(11);
  });

  it('36 points en jeu — l\'invariant que la feuille rappelle', () => {
    // 6 × 2 + 3 × 4 + 2 × 6 = 36.
    expect(pointsEnJeu(BAREME_CDC)).toBe(36);
  });
});

describe('bilan d\'une feuille de match', () => {
  it('feuille vierge : rien d\'attribué, rien de reproché', () => {
    const bilan = bilanRencontre(BAREME_CDC, partiesVides(BAREME_CDC));
    expect([bilan.totalA, bilan.totalB]).toEqual([0, 0]);
    expect(bilan.jouees).toBe(0);
    expect(bilan.complete).toBe(false);
    expect(bilan.anomalies).toEqual([]);
  });

  it('feuille complète : les deux totaux font toujours 36', () => {
    for (const nbA of [0, 1, 5, 6, 9, 11]) {
      const bilan = bilanRencontre(BAREME_CDC, jouee(nbA));
      expect(bilan.complete).toBe(true);
      expect(bilan.totalA + bilan.totalB).toBe(36);
      expect(bilan.anomalies).toEqual([]);
    }
  });

  it('les points vont au vainqueur, selon le type de partie', () => {
    // A gagne les 6 têtes-à-têtes (12 pts) et rien d'autre.
    const bilan = bilanRencontre(BAREME_CDC, jouee(6));
    expect(bilan.totalA).toBe(12);
    expect(bilan.totalB).toBe(24); // 3 doublettes (12) + 2 triplettes (12)
    expect(bilan.sousTotaux).toEqual([
      { type: 'tete_a_tete', a: 12, b: 0 },
      { type: 'doublette', a: 0, b: 12 },
      { type: 'triplette', a: 0, b: 12 },
    ]);
  });

  it('feuille partielle : les sous-totaux sont justes, le total ne fait pas 36', () => {
    const parties = partiesVides(BAREME_CDC).map((p, i) =>
      i < 3 ? { ...p, scoreA: 13, scoreB: 4 } : p,
    );
    const bilan = bilanRencontre(BAREME_CDC, parties);
    expect(bilan.jouees).toBe(3);
    expect(bilan.complete).toBe(false);
    expect(bilan.totalA).toBe(6);
    expect(bilan.totalB).toBe(0);
    expect(bilan.anomalies).toEqual([]);
  });

  it('partie nulle refusée : le manuel l\'interdit, aucun point attribué', () => {
    const parties = partiesVides(BAREME_CDC).map((p, i) =>
      i === 0 ? { ...p, scoreA: 13, scoreB: 13 } : p,
    );
    const bilan = bilanRencontre(BAREME_CDC, parties);
    expect(bilan.anomalies).toContain('nulle');
    expect([bilan.totalA, bilan.totalB]).toEqual([0, 0]);
    expect(bilan.jouees).toBe(0);
  });

  it('un score seul ne compte pas : il faut les deux', () => {
    const parties = partiesVides(BAREME_CDC).map((p, i) =>
      i === 0 ? { ...p, scoreA: 13, scoreB: null } : p,
    );
    const bilan = bilanRencontre(BAREME_CDC, parties);
    expect(bilan.jouees).toBe(0);
    expect(bilan.anomalies).toContain('incomplete');
  });

  it('un barème différent reste possible : rien n\'est figé dans le code', () => {
    // Une rencontre à 4 doublettes de 3 points : 12 points en jeu.
    const autre = {
      id: 'test',
      label: 'Doublettes seules',
      blocs: [{ type: 'doublette' as const, nb: 4, points: 3 }],
    };
    expect(pointsEnJeu(autre)).toBe(12);
    const toutesA = partiesVides(autre).map((p) => ({ ...p, scoreA: 13, scoreB: 2 }));
    const bilan = bilanRencontre(autre, toutesA);
    expect(bilan.totalA).toBe(12);
    expect(bilan.totalA + bilan.totalB).toBe(pointsEnJeu(autre));
  });
});

describe('contingent d\'étrangers hors UE porté par la feuille (§3.E)', () => {
  it('une feuille neuve limite à un joueur hors UE', () => {
    // C'est la position courante du panneau fédéral, et le comportement qui
    // existait quand la limite était codée en dur.
    expect(feuilleVierge('f1', '2026-03-01', 'cnc_open').horsUE).toBe('un_externe');
  });

  it('garde la position choisie', () => {
    const f = feuilleDepuisMemoire('f1', {
      ...feuilleVierge('f1', '2026-03-01', 'cnc_open'),
      horsUE: 'aucun',
    });
    expect(f.horsUE).toBe('aucun');
  });

  it('une feuille d\'avant ce champ retombe sur la limite d\'un seul', () => {
    // Les feuilles déjà synchronisées entre les tablettes du club n'ont pas ce
    // champ : elles doivent continuer à se contrôler comme avant, pas devenir
    // subitement sans limite.
    const ancienne: Record<string, unknown> = {
      ...feuilleVierge('f1', '2026-03-01', 'cnc_open'),
    };
    delete ancienne.horsUE;
    expect(feuilleDepuisMemoire('f1', ancienne).horsUE).toBe('un_externe');
  });

  it('refuse une position inventée plutôt que de la propager', () => {
    const f = feuilleDepuisMemoire('f1', {
      ...feuilleVierge('f1', '2026-03-01', 'cnc_open'),
      horsUE: 'trois_externes',
    });
    expect(f.horsUE).toBe('un_externe');
  });
});
