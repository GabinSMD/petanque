import { describe, expect, it } from 'vitest';
import { dureeMinutes, partiesEnRetard, partiesLancees, stampLancees } from '../retards';
import type { Match } from '../../types';

const T = (h: number, m: number) => `2026-07-28T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;

function match(over: Partial<Match> & { id: string }): Match {
  return {
    concoursId: 'c1',
    stage: 'poule',
    round: 0,
    position: 0,
    teamAId: 'a',
    teamBId: 'b',
    scoreA: null,
    scoreB: null,
    done: false,
    terrain: 1,
    updatedAt: T(9, 0),
    ...over,
  };
}

describe('horodatage des parties lancées', () => {
  it('horodate une partie prête et non jouée', () => {
    const changed = stampLancees([match({ id: 'm1' })], T(14, 32));
    expect(changed).toHaveLength(1);
    expect(changed[0]!.lanceeA).toBe(T(14, 32));
  });

  it('n horodate pas deux fois : l heure d annonce ne bouge plus', () => {
    const deja = match({ id: 'm1', lanceeA: T(14, 32) });
    expect(stampLancees([deja], T(15, 0))).toHaveLength(0);
  });

  it('n horodate pas une partie dont un camp est inconnu', () => {
    expect(stampLancees([match({ id: 'm1', teamBId: null })], T(14, 0))).toHaveLength(0);
  });

  it('n horodate ni les exempts ni les parties terminées', () => {
    const exempt = match({ id: 'm1', byeB: true, teamBId: null });
    const finie = match({ id: 'm2', done: true, scoreA: 13, scoreB: 7 });
    expect(stampLancees([exempt, finie], T(14, 0))).toHaveLength(0);
  });

  it('horodate les parties de mêlée, où les camps sont des joueurs', () => {
    const melee = match({
      id: 'm1',
      stage: 'ronde',
      teamAId: null,
      teamBId: null,
      playersA: ['p1', 'p2'],
      playersB: ['p3'],
    });
    expect(stampLancees([melee], T(10, 0))).toHaveLength(1);
  });

  it('conserve l heure quand la partie est ensuite jouée', () => {
    const lancee = match({ id: 'm1', lanceeA: T(14, 32) });
    const jouee = { ...lancee, done: true, scoreA: 13, scoreB: 9 };
    expect(jouee.lanceeA).toBe(T(14, 32));
    expect(stampLancees([jouee], T(15, 30))).toHaveLength(0);
  });
});

describe('durée écoulée', () => {
  it('compte les minutes entières', () => {
    expect(dureeMinutes(T(14, 0), T(14, 45))).toBe(45);
    expect(dureeMinutes(T(14, 0), T(15, 30))).toBe(90);
    expect(dureeMinutes(T(14, 0), T(14, 0))).toBe(0);
  });

  it('ne rend jamais de durée négative', () => {
    expect(dureeMinutes(T(15, 0), T(14, 0))).toBe(0);
  });
});

describe('parties lancées et retards', () => {
  const m1 = match({ id: 'm1', lanceeA: T(14, 5), position: 0 });
  const m2 = match({ id: 'm2', lanceeA: T(14, 0), position: 1, retard: true });
  const m3 = match({ id: 'm3', position: 2 }); // pas encore annoncée
  const m4 = match({ id: 'm4', lanceeA: T(13, 30), position: 3, retard: true, done: true, scoreA: 13, scoreB: 4 });

  it('liste les parties annoncées, de la plus ancienne à la plus récente', () => {
    expect(partiesLancees([m1, m2, m3]).map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('le panneau des retards ne montre que les parties encore en cours', () => {
    // m4 est marquée en retard mais son résultat est saisi : elle sort du panneau.
    expect(partiesEnRetard([m1, m2, m3, m4]).map((m) => m.id)).toEqual(['m2']);
  });

  it('les retards les plus anciens viennent en premier', () => {
    const vieux = match({ id: 'v', lanceeA: T(13, 0), retard: true });
    expect(partiesEnRetard([m2, vieux]).map((m) => m.id)).toEqual(['v', 'm2']);
  });
});
