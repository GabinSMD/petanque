import { describe, expect, it } from 'vitest';
import { loserOf, winnerOf } from '../match';
import { applyChanges, drawElimination, propagate } from '../bracket';
import { rondeStandings } from '../rondes';
import { makeTeams, testCtx } from './helpers';
import type { Match, Team } from '../../types';

function partie(over: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    concoursId: 'c1',
    stage: 'poule',
    round: 0,
    position: 0,
    teamAId: 'a',
    teamBId: 'b',
    scoreA: null,
    scoreB: null,
    done: false,
    terrain: null,
    updatedAt: '2026-07-28T00:00:00.000Z',
    ...over,
  };
}

describe('vainqueur désigné sans score', () => {
  it('désigne le gagnant et le perdant sans aucun score', () => {
    const m = partie({ vainqueur: 'A', done: true });
    expect(winnerOf(m)).toBe('a');
    expect(loserOf(m)).toBe('b');

    const m2 = partie({ vainqueur: 'B', done: true });
    expect(winnerOf(m2)).toBe('b');
    expect(loserOf(m2)).toBe('a');
  });

  it('ne compte pas tant que la partie n est pas validée', () => {
    expect(winnerOf(partie({ vainqueur: 'A' }))).toBeNull();
  });

  it('le score, quand il existe, reste la source de vérité', () => {
    // Cas de correction : on a d'abord cliqué le vainqueur, puis saisi le score.
    const m = partie({ vainqueur: 'A', scoreA: 7, scoreB: 13, done: true });
    expect(winnerOf(m)).toBe('b');
    expect(loserOf(m)).toBe('a');
  });

  it('un exempt reste un exempt, sans perdant', () => {
    const m = partie({ byeB: true, teamBId: null, vainqueur: 'B', done: true });
    expect(winnerOf(m)).toBe('a');
    expect(loserOf(m)).toBeNull();
  });

  it('sans score ni vainqueur, personne ne gagne', () => {
    expect(winnerOf(partie({ done: true }))).toBeNull();
    expect(loserOf(partie({ done: true }))).toBeNull();
  });
});

describe('propagation d un vainqueur sans score', () => {
  const jouerSansScore = (all: Match[], id: string, cote: 'A' | 'B'): Match[] => {
    const maj = all.map((m) => (m.id === id ? { ...m, vainqueur: cote, done: true } : m));
    return applyChanges(maj, propagate(maj));
  };

  it('le gagnant monte au tour suivant', () => {
    const teams: Team[] = makeTeams(4);
    let all = drawElimination('c1', 'principal', teams, testCtx());
    const premiere = all.find((m) => m.round === 0 && m.position === 0)!;
    const attendu = premiere.teamAId;
    all = jouerSansScore(all, premiere.id, 'A');
    const finale = all.find((m) => m.round === 1)!;
    expect([finale.teamAId, finale.teamBId]).toContain(attendu);
  });

  it('changer d avis remonte proprement l aval', () => {
    const teams: Team[] = makeTeams(4);
    let all = drawElimination('c1', 'principal', teams, testCtx());
    const premiere = all.find((m) => m.round === 0 && m.position === 0)!;
    all = jouerSansScore(all, premiere.id, 'A');
    all = jouerSansScore(all, premiere.id, 'B');
    const finale = all.find((m) => m.round === 1)!;
    expect([finale.teamAId, finale.teamBId]).toContain(premiere.teamBId);
    expect([finale.teamAId, finale.teamBId]).not.toContain(premiere.teamAId);
  });
});

describe('classement des rondes sans score', () => {
  it('compte les victoires, sans goal-average', () => {
    const teams = makeTeams(4);
    const ronde = (id: string, a: string, b: string, cote: 'A' | 'B'): Match => ({
      ...partie({ id, stage: 'ronde', teamAId: a, teamBId: b, vainqueur: cote, done: true }),
    });
    const matches = [ronde('r1', 't1', 't2', 'A'), ronde('r2', 't3', 't4', 'B')];
    const classement = rondeStandings(teams, matches);
    const de = (id: string) => classement.find((s) => s.id === id)!;

    expect(de('t1').wins).toBe(1);
    expect(de('t2').wins).toBe(0);
    expect(de('t4').wins).toBe(1);
    expect(de('t1').played).toBe(1);
    // Sans score, le goal-average n'existe pas : il ne doit pas être inventé.
    expect(de('t1').diff).toBe(0);
    expect(de('t1').pointsFor).toBe(0);
  });

  it('mélange de parties avec et sans score', () => {
    const teams = makeTeams(4);
    const matches: Match[] = [
      partie({ id: 'r1', stage: 'ronde', teamAId: 't1', teamBId: 't2', scoreA: 13, scoreB: 3, done: true }),
      partie({ id: 'r2', stage: 'ronde', teamAId: 't3', teamBId: 't4', vainqueur: 'A', done: true }),
    ];
    const classement = rondeStandings(teams, matches);
    const de = (id: string) => classement.find((s) => s.id === id)!;
    expect(de('t1').wins).toBe(1);
    expect(de('t1').diff).toBe(10);
    expect(de('t3').wins).toBe(1);
    expect(de('t3').diff).toBe(0);
    // À égalité de victoires, celui qui a un goal-average passe devant.
    expect(classement[0]!.id).toBe('t1');
  });
});
