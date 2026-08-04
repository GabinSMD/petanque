import { describe, expect, it } from 'vitest';
import { BYE_SCORE, rondeStandings } from '../rondes';
import type { Match, Team } from '../../types';
import { makeTeams } from './helpers';

/** Une partie de ronde jouée, entre deux équipes, à un tour donné. */
function ronde(
  id: string,
  round: number,
  a: string,
  b: string,
  scoreA: number | null,
  scoreB: number | null,
  reste: Partial<Match> = {},
): Match {
  return {
    id,
    concoursId: 'c1',
    stage: 'ronde',
    round,
    position: 0,
    teamAId: a,
    teamBId: b,
    scoreA,
    scoreB,
    done: scoreA !== null || Boolean(reste.vainqueur),
    terrain: null,
    updatedAt: '2026-08-04T00:00:00.000Z',
    ...reste,
  };
}

const suite = (id: string, standings: ReturnType<typeof rondeStandings>): string =>
  standings.find((s) => s.id === id)!.resultatsParties;

describe('colonne « Résultats Parties »', () => {
  it('rend une lettre par partie, G pour une victoire et P pour une défaite', () => {
    // Le document fédéral (p.106) écrit `GGGG`, `GGGP`, `PGGG`, `PPPP` — une
    // lettre par tour, dans l'ordre.
    const [a, b] = makeTeams(2);
    const matches = [
      ronde('m1', 0, a!.id, b!.id, 13, 7),
      ronde('m2', 1, b!.id, a!.id, 13, 5),
      ronde('m3', 2, a!.id, b!.id, 13, 11),
    ];
    const cl = rondeStandings([a!, b!], matches);
    expect(suite(a!.id, cl)).toBe('GPG');
    expect(suite(b!.id, cl)).toBe('PGP');
  });

  it('respecte l ordre des tours même si les parties arrivent mélangées', () => {
    // Rien ne garantit l'ordre du tableau : c'est `round` qui fait foi.
    const [a, b] = makeTeams(2);
    const melange = [
      ronde('m3', 2, a!.id, b!.id, 13, 11),
      ronde('m1', 0, a!.id, b!.id, 13, 7),
      ronde('m2', 1, b!.id, a!.id, 13, 5),
    ];
    expect(suite(a!.id, rondeStandings([a!, b!], melange))).toBe('GPG');
  });

  it('une partie non jouée ne produit pas de lettre', () => {
    // La suite est alors plus courte que le nombre de tours, ce qui se lit :
    // deux lettres pour trois tours, c'est une partie en attente.
    const [a, b] = makeTeams(2);
    const matches = [
      ronde('m1', 0, a!.id, b!.id, 13, 7),
      ronde('m2', 1, a!.id, b!.id, 13, 5),
      ronde('m3', 2, a!.id, b!.id, null, null),
    ];
    const cl = rondeStandings([a!, b!], matches);
    expect(suite(a!.id, cl)).toBe('GG');
    expect(cl.find((s) => s.id === a!.id)!.played).toBe(2);
  });

  it('un vainqueur désigné sans score produit sa lettre', () => {
    // La saisie rapide (`vainqueurSeul`) n'alimente pas le goal-average, mais la
    // victoire compte : elle doit donc paraître dans la suite.
    const [a, b] = makeTeams(2);
    const matches = [ronde('m1', 0, a!.id, b!.id, null, null, { vainqueur: 'A' })];
    const cl = rondeStandings([a!, b!], matches);
    expect(suite(a!.id, cl)).toBe('G');
    expect(suite(b!.id, cl)).toBe('P');
  });

  it('un exempt lit G, parce que notre moteur le crédite d une victoire', () => {
    // C'est la cohérence qui décide, pas l'esthétique : un exempt reçoit
    // BYE_SCORE (13-7) et compte dans `wins`. Lui refuser son G ferait
    // contredire deux colonnes de la même table. Le manuel, lui, ne donne
    // aucune notation pour l'exempt — il n'y a donc rien à imiter.
    const [a] = makeTeams(1);
    const exempt = ronde('m1', 0, a!.id, '', BYE_SCORE[0], BYE_SCORE[1], { byeB: true });
    const cl = rondeStandings([a!], [exempt]);
    expect(suite(a!.id, cl)).toBe('G');
    expect(cl[0]!.wins).toBe(1);
  });

  it('la suite compte autant de lettres que de parties comptées', () => {
    // L'invariant qui protège les deux colonnes de se contredire : autant de
    // lettres que `played`, et autant de G que `wins`.
    const [a, b, c, d] = makeTeams(4);
    const matches = [
      ronde('m1', 0, a!.id, b!.id, 13, 7),
      ronde('m2', 0, c!.id, d!.id, 9, 13),
      ronde('m3', 1, a!.id, c!.id, 6, 13),
      ronde('m4', 1, b!.id, d!.id, 13, 2),
      ronde('m5', 2, a!.id, d!.id, 13, 12),
    ];
    for (const s of rondeStandings([a!, b!, c!, d!], matches)) {
      expect(s.resultatsParties).toHaveLength(s.played);
      expect([...s.resultatsParties].filter((l) => l === 'G')).toHaveLength(s.wins);
    }
  });

  it('une partie nulle ne lit pas G, et reste d accord avec les victoires', () => {
    // Le manuel interdit la partie nulle (« Partie nulle non acceptée »), et
    // `validateScore` la refuse à la saisie. Mais un enregistrement venu d'une
    // version ancienne par réplication pourrait en porter une : la suite doit
    // alors rester cohérente avec `wins`, qui ne la compte pas. C'est le
    // sabotage qui a montré que ce cas n'était pas couvert.
    const [a, b] = makeTeams(2);
    const nulle = [ronde('m1', 0, a!.id, b!.id, 11, 11)];
    const cl = rondeStandings([a!, b!], nulle);
    expect(suite(a!.id, cl)).toBe('P');
    expect(cl.find((s) => s.id === a!.id)!.wins).toBe(0);
    expect(suite(b!.id, cl)).toBe('P');
  });

  it('en mêlée, la suite est celle du joueur et non d une équipe', () => {
    // Les parties de mêlée portent des joueurs : chacun a sa propre suite, même
    // s'ils ont partagé un camp.
    const [a, b, c, d] = makeTeams(4);
    const matches = [
      ronde('m1', 0, '', '', 13, 4, { playersA: [a!.id, b!.id], playersB: [c!.id, d!.id] }),
      ronde('m2', 1, '', '', 7, 13, { playersA: [a!.id, c!.id], playersB: [b!.id, d!.id] }),
    ];
    const cl = rondeStandings([a!, b!, c!, d!], matches);
    expect(suite(a!.id, cl)).toBe('GP');
    expect(suite(b!.id, cl)).toBe('GG');
    expect(suite(c!.id, cl)).toBe('PP');
    expect(suite(d!.id, cl)).toBe('PG');
  });
});
