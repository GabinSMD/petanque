import { describe, expect, it } from 'vitest';
import { drawElimination } from '../bracket';
import {
  nbToursQualification,
  qualifiesTableau,
  tronquerTableau,
} from '../qualification';
import { isByeMatch } from '../match';
import { makeTeams, playStageRound, testCtx } from './helpers';
import type { Match } from '../../types';

function jouerTout(all: Match[], stage = 'principal'): Match[] {
  const tours = Math.max(...all.filter((m) => m.stage === stage).map((m) => m.round));
  let out = all;
  for (let r = 0; r <= tours; r += 1) out = playStageRound(out, stage, r);
  return out;
}

describe('nombre de tours pour qualifier N équipes', () => {
  it('un tableau de 16 qualifie 8 en un tour', () => {
    expect(nbToursQualification(16, 8)).toBe(1);
  });

  it('24 équipes qualifient 8 en deux tours', () => {
    // Tableau de 32 : 24 → 16 → 8.
    expect(nbToursQualification(24, 8)).toBe(2);
  });

  it('un effectif déjà au nombre voulu ne joue rien', () => {
    expect(nbToursQualification(8, 8)).toBe(0);
  });

  it('refuse un nombre de qualifiés qui n est pas une puissance de deux', () => {
    expect(nbToursQualification(24, 6)).toBeNull();
    expect(nbToursQualification(24, 10)).toBeNull();
  });

  it('refuse de qualifier plus d équipes qu il n y en a', () => {
    expect(nbToursQualification(8, 16)).toBeNull();
    expect(nbToursQualification(8, 0)).toBeNull();
  });

  it('un tableau complet joué jusqu au bout revient à qualifier 1 équipe', () => {
    expect(nbToursQualification(16, 1)).toBe(4);
    expect(nbToursQualification(24, 1)).toBe(5);
  });
});

describe('tableau tronqué', () => {
  it('ne garde que les tours à jouer', () => {
    const complet = drawElimination('c1', 'principal', makeTeams(24), testCtx());
    // 32 places : 5 tours au complet, 2 pour qualifier 8.
    expect(Math.max(...complet.map((m) => m.round))).toBe(4);
    const tronque = tronquerTableau(complet, 2);
    expect(Math.max(...tronque.map((m) => m.round))).toBe(1);
    // Les 2 tours conservés gardent toutes leurs parties.
    expect(tronque.filter((m) => m.round === 0)).toHaveLength(16);
    expect(tronque.filter((m) => m.round === 1)).toHaveLength(8);
  });

  it('tronquer à zéro tour ne laisse rien', () => {
    const complet = drawElimination('c1', 'principal', makeTeams(8), testCtx());
    expect(tronquerTableau(complet, 0)).toEqual([]);
  });

  it('tronquer plus loin que le tableau le laisse intact', () => {
    const complet = drawElimination('c1', 'principal', makeTeams(8), testCtx());
    expect(tronquerTableau(complet, 9)).toHaveLength(complet.length);
  });
});

describe('équipes qualifiées à l issue d un tableau tronqué', () => {
  it('les vainqueurs du dernier tour joué sont les qualifiés', () => {
    const teams = makeTeams(24);
    const tronque = tronquerTableau(drawElimination('c1', 'principal', teams, testCtx()), 2);
    const joue = jouerTout(tronque);
    const qualifies = qualifiesTableau(joue, 'principal');
    expect(qualifies).toHaveLength(8);
    expect(new Set(qualifies).size).toBe(8);
  });

  it('tant que le dernier tour n est pas fini, la liste est partielle', () => {
    const teams = makeTeams(16);
    const tronque = tronquerTableau(drawElimination('c1', 'principal', teams, testCtx()), 1);
    // Aucun tour joué : personne n'est qualifié.
    expect(qualifiesTableau(tronque, 'principal')).toHaveLength(0);
    const joue = playStageRound(tronque, 'principal', 0);
    expect(qualifiesTableau(joue, 'principal')).toHaveLength(8);
  });

  it('les exempts comptent comme qualifiés, sans avoir joué', () => {
    // 12 équipes, tableau de 16, un seul tour pour qualifier 8 : 4 exempts
    // passent sans jouer, 8 équipes se départagent en 4 parties.
    const teams = makeTeams(12);
    const tronque = tronquerTableau(drawElimination('c1', 'principal', teams, testCtx()), 1);
    expect(tronque.filter((m) => m.round === 0 && isByeMatch(m))).toHaveLength(4);
    const joue = jouerTout(tronque);
    expect(qualifiesTableau(joue, 'principal')).toHaveLength(8);
  });
});
