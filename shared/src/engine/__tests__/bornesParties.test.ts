import { describe, expect, it } from 'vitest';
import { bornesParties, partiesDansLesBornes } from '../bornesParties';

describe('bornes du nombre de parties, par formule (§3.D.14)', () => {
  it('système suisse : de 3 à 7 parties', () => {
    // « (15) 3 à 7 Parties GG » — « il est utilisé pour les concours en SWISS
    // System » (p.95).
    expect(bornesParties({ mode: 'suisse' })).toEqual({ min: 3, max: 7 });
    expect(bornesParties({ mode: 'suisse', ggStrict: false })).toEqual({ min: 3, max: 7 });
  });

  it('gagnant contre gagnant strict : de 3 à 5 parties', () => {
    // « (17) 3 à 5 Parties GG Strict » — « toutes les équipes qui s'affrontent
    // ont gagné ou perdu le même nombre de parties, d'où des exempts à certain
    // tour » (p.101). Plus de rondes fragmentent les groupes d'égalité jusqu'à
    // l'impasse : la borne encode ce mur.
    expect(bornesParties({ mode: 'suisse', ggStrict: true })).toEqual({ min: 3, max: 5 });
  });

  it('marathon en rotation circulaire : de 3 à 10 parties', () => {
    // « (16) 3 à 10 Parties » — « fait s'affronter les équipes par rotation
    // circulaire. Utilisé pour les Marathons » (p.98). C'est notre championnat
    // tronqué à N rondes.
    expect(bornesParties({ mode: 'championnat' })).toEqual({ min: 3, max: 10 });
  });

  it('ne borne pas ce que le manuel ne borne pas', () => {
    // La mêlée est à nous : inscriptions individuelles, équipes tirées à chaque
    // ronde. Elle ne figure dans aucune des trois formules fédérales, donc aucune
    // borne à en tirer — et on n'en invente pas.
    expect(bornesParties({ mode: 'melee' })).toBeUndefined();
    // Le tir compte des séries, pas des parties.
    expect(bornesParties({ mode: 'tir_precision' })).toBeUndefined();
    // Les formules à tableau n'ont pas de nombre de parties choisi.
    expect(bornesParties({ mode: 'poules' })).toBeUndefined();
    expect(bornesParties({ mode: 'elimination_directe' })).toBeUndefined();
  });
});

describe('un nombre de parties tient-il dans les bornes ?', () => {
  it('accepte ce que la formule permet', () => {
    expect(partiesDansLesBornes({ mode: 'suisse' }, 3)).toBe(true);
    expect(partiesDansLesBornes({ mode: 'suisse' }, 7)).toBe(true);
    expect(partiesDansLesBornes({ mode: 'suisse', ggStrict: true }, 5)).toBe(true);
    expect(partiesDansLesBornes({ mode: 'championnat' }, 10)).toBe(true);
  });

  it('refuse au-delà et en dessous', () => {
    expect(partiesDansLesBornes({ mode: 'suisse' }, 8)).toBe(false);
    expect(partiesDansLesBornes({ mode: 'suisse' }, 2)).toBe(false);
    // Douze parties en gagnant contre gagnant strict : le manuel plafonne à cinq.
    expect(partiesDansLesBornes({ mode: 'suisse', ggStrict: true }, 12)).toBe(false);
    expect(partiesDansLesBornes({ mode: 'championnat' }, 11)).toBe(false);
  });

  it('accepte tout quand la formule n\'est pas bornée', () => {
    // Ne rien borner n'est pas tout refuser : une mêlée en douze rondes reste
    // possible, le manuel n'en dit rien.
    expect(partiesDansLesBornes({ mode: 'melee' }, 12)).toBe(true);
    expect(partiesDansLesBornes({ mode: 'melee' }, 1)).toBe(true);
  });

  it('refuse un nombre qui n\'en est pas un', () => {
    expect(partiesDansLesBornes({ mode: 'suisse' }, 4.5)).toBe(false);
    expect(partiesDansLesBornes({ mode: 'suisse' }, Number.NaN)).toBe(false);
  });
});
