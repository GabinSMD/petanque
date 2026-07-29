import { describe, expect, it } from 'vitest';
import { rondeStandings } from '../rondes';
import { classementFinales } from '../finales';
import { makeTeams } from './helpers';
import type { Match } from '../../types';

function partie(a: string, b: string, scoreA: number, scoreB: number, round = 0): Match {
  return {
    id: `m-${a}-${b}-${round}`,
    concoursId: 'c1',
    stage: 'ronde',
    round,
    position: 0,
    teamAId: a,
    teamBId: b,
    scoreA,
    scoreB,
    done: true,
    terrain: null,
    updatedAt: '2026-07-29T10:00:00.000Z',
  };
}

const teams = makeTeams(4);
const [t1, t2, t3, t4] = teams.map((t) => t.id) as [string, string, string, string];

describe('le classement affiché applique la confrontation directe (§3.D.15)', () => {
  /**
   * t1 et t2 finissent à égalité parfaite — 1 victoire, goal-average nul,
   * mêmes points marqués — et c'est **t2** qui a battu t1. Il doit donc passer
   * devant, à l'inverse de l'ordre de repli par identifiant : sans cela le test
   * ne prouverait rien.
   */
  const EGALITE = [
    partie(t2, t1, 13, 8),
    partie(t1, t3, 13, 8, 1),
    partie(t4, t2, 13, 8, 2),
  ];

  it('le vainqueur de la rencontre passe devant', () => {
    const rangs = rondeStandings(teams, EGALITE).map((s) => s.id);
    expect(rangs.indexOf(t2)).toBeLessThan(rangs.indexOf(t1));
  });

  it('l\'écran des rondes et les phases finales donnent le même ordre', () => {
    // C'est le défaut qui motive ce lot : le critère n'existait que dans le
    // classement des phases finales. L'organisateur lisait un rang à l'écran et
    // le panneau des finales en produisait un autre.
    const affiche = rondeStandings(teams, EGALITE).map((s) => s.id);
    const finales = classementFinales(teams, EGALITE).map((l) => l.id);
    expect(affiche).toEqual(finales);
  });

  it('le goal-average garde la main sur la confrontation', () => {
    // t2 a battu t1 d'un point, mais t1 a un bien meilleur goal-average : ils
    // ne sont pas à égalité, la confrontation n'a pas à s'en mêler.
    const matches = [
      partie(t2, t1, 13, 12),
      partie(t1, t3, 13, 0, 1),
      partie(t4, t2, 13, 0, 2),
    ];
    const rangs = rondeStandings(teams, matches).map((s) => s.id);
    expect(rangs.indexOf(t1)).toBeLessThan(rangs.indexOf(t2));
  });

  it('reste reproductible, même sur un cycle', () => {
    // A bat B bat C bat A, à égalité parfaite : le critère ne peut pas trancher.
    // Il ne doit surtout pas rendre un ordre qui dépend de l'ordre d'arrivée
    // des équipes — le même concours afficherait deux classements.
    const cycle = [partie(t1, t2, 13, 7), partie(t2, t3, 13, 7), partie(t3, t1, 13, 7)];
    const droit = rondeStandings(teams, cycle).map((s) => s.id);
    const inverse = rondeStandings([...teams].reverse(), cycle).map((s) => s.id);
    expect(inverse).toEqual(droit);
  });

  it('un exempt ne compte pas comme une confrontation', () => {
    // L'exempt est crédité 13-7 sans adversaire : personne n'a été battu.
    const exempt: Match = {
      ...partie(t1, t2, 13, 7),
      id: 'bye-t1',
      teamBId: null,
      byeB: true,
    };
    const matches = [exempt, partie(t2, t3, 13, 7, 1), partie(t4, t1, 7, 13, 1)];
    const avant = rondeStandings(teams, matches).map((s) => s.id);
    // Le même jeu de données sans l'exempt donne le même ordre relatif entre
    // t1 et t2 : l'exempt n'a rien départagé.
    const sansExempt = rondeStandings(teams, matches.slice(1)).map((s) => s.id);
    expect(avant.indexOf(t1) < avant.indexOf(t2)).toBe(
      sansExempt.indexOf(t1) < sansExempt.indexOf(t2),
    );
  });
});
