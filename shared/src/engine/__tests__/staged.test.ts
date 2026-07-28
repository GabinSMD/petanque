import { describe, expect, it } from 'vitest';
import { applyChanges, bracketSizeOf, buildStagedBracket, propagate } from '../bracket';
import { isByeMatch, winnerOf } from '../match';
import { testCtx } from './helpers';
import type { Match } from '../../types';

/** Joue toutes les parties jouables, en boucle, jusqu'à stabilisation. */
function jouerJusquAuBout(matches: Match[]): Match[] {
  let all = applyChanges(matches, propagate(matches));
  for (let garde = 0; garde < 50; garde += 1) {
    const jouable = all.find(
      (m) => !m.done && !isByeMatch(m) && m.teamAId && m.teamBId,
    );
    if (!jouable) break;
    all = all.map((m) => (m.id === jouable.id ? { ...m, scoreA: 13, scoreB: 7, done: true } : m));
    all = applyChanges(all, propagate(all));
  }
  return all;
}

/** Équipes réelles entrant au tour indiqué. */
const equipes = (n: number, round: number, prefixe = 't') =>
  Array.from({ length: n }, (_, i) => ({ teamId: `${prefixe}${round}-${i}`, round }));

function vainqueurFinal(all: Match[]): string | null {
  const maxRound = Math.max(...all.map((m) => m.round));
  const finale = all.find((m) => m.round === maxRound);
  return winnerOf(finale);
}

describe('tableau à entrées échelonnées', () => {
  it('sans entrée différée, se comporte comme un tableau classique', () => {
    const all = buildStagedBracket('c1', 'consolante', equipes(8, 0), testCtx());
    expect(bracketSizeOf(all.filter((m) => m.stage === 'consolante'))).toBe(8);
    expect(all.filter((m) => m.round === 0)).toHaveLength(4);
    expect(all.some((m) => isByeMatch(m))).toBe(false);
    expect(vainqueurFinal(jouerJusquAuBout(all))).toBeTruthy();
  });

  it('une entrée au 2e tour ne joue pas le 1er', () => {
    // 4 équipes au 1er tour, 2 qui entrent au cadrage.
    const entrees = [...equipes(4, 0), ...equipes(2, 1)];
    const all = jouerJusquAuBout(buildStagedBracket('c1', 'consolante', entrees, testCtx()));

    for (const differee of ['t1-0', 't1-1']) {
      const premiere = all
        .filter((m) => (m.teamAId === differee || m.teamBId === differee) && !isByeMatch(m))
        .sort((a, b) => a.round - b.round)[0];
      expect(premiere, `${differee} doit jouer`).toBeTruthy();
      expect(premiere!.round, `${differee} n'entre qu'au 2e tour`).toBeGreaterThanOrEqual(1);
    }
  });

  it('converge sur un seul vainqueur, quel que soit le mélange d effectifs', () => {
    // Chaque combinaison est un cas réel de récupération fédérale.
    const cas: [number, number][] = [
      [8, 4], [4, 4], [8, 8], [16, 8], [6, 3], [2, 1], [12, 4], [5, 5], [3, 2], [10, 6],
    ];
    for (const [n0, n1] of cas) {
      const entrees = [...equipes(n0, 0), ...equipes(n1, 1)];
      const all = jouerJusquAuBout(buildStagedBracket('c1', 'consolante', entrees, testCtx()));
      const vainqueur = vainqueurFinal(all);
      expect(vainqueur, `${n0} au 1er tour + ${n1} au 2e : pas de vainqueur`).toBeTruthy();

      // Toute équipe engagée apparaît quelque part.
      const vues = new Set(all.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean));
      for (const e of entrees) {
        expect(vues.has(e.teamId), `${e.teamId} absente du tableau`).toBe(true);
      }
    }
  });

  it('aucune partie ne reste bloquée avec un seul camp connu', () => {
    const entrees = [...equipes(8, 0), ...equipes(8, 1)];
    const all = jouerJusquAuBout(buildStagedBracket('c1', 'consolante', entrees, testCtx()));
    const bloquees = all.filter(
      (m) => !m.done && !isByeMatch(m) && ((m.teamAId && !m.teamBId) || (!m.teamAId && m.teamBId)),
    );
    expect(bloquees.map((m) => `${m.round}:${m.position}`)).toEqual([]);
  });

  it('les entrées différées peuvent aussi être des repêchages', () => {
    const entrees = [
      { loserFrom: 'src-1', round: 0 },
      { loserFrom: 'src-2', round: 0 },
      { loserFrom: 'src-3', round: 1 },
      { loserFrom: 'src-4', round: 1 },
    ];
    const all = buildStagedBracket('c1', 'complementaire', entrees, testCtx());
    const refs = all.flatMap((m) => [m.loserFromA, m.loserFromB]).filter(Boolean);
    expect(refs.sort()).toEqual(['src-1', 'src-2', 'src-3', 'src-4']);
  });

  it('une entrée au 3e tour attend deux tours', () => {
    const entrees = [...equipes(4, 0), ...equipes(1, 2)];
    const all = jouerJusquAuBout(buildStagedBracket('c1', 'consolante', entrees, testCtx()));
    const premiere = all
      .filter((m) => (m.teamAId === 't2-0' || m.teamBId === 't2-0') && !isByeMatch(m))
      .sort((a, b) => a.round - b.round)[0];
    expect(premiere!.round).toBeGreaterThanOrEqual(2);
    expect(vainqueurFinal(all)).toBeTruthy();
  });

  it('moins de deux engagés : pas de tableau', () => {
    expect(buildStagedBracket('c1', 'consolante', equipes(1, 0), testCtx())).toEqual([]);
    expect(buildStagedBracket('c1', 'consolante', [], testCtx())).toEqual([]);
  });
});

describe('formule ABC CD53 et récupération au cadrage', () => {
  it('mélange équipes réelles au 1er tour et repêchés au cadrage', () => {
    // Le cas du §3.D.4 : les éliminés de poules ouvrent le concours B, les
    // perdants du 1er tour du A les rejoignent à la 2e partie.
    const entrees = [
      ...equipes(6, 0),
      { loserFrom: 'a-1', round: 1 },
      { loserFrom: 'a-2', round: 1 },
    ];
    const all = buildStagedBracket('c1', 'consolante', entrees, testCtx());
    // Les repêchés n'apparaissent pas dans une vraie partie du 1er tour.
    const premierTour = all.filter((m) => m.round === 0 && !isByeMatch(m));
    expect(premierTour.every((m) => !m.loserFromA && !m.loserFromB)).toBe(true);
    // Et leurs places existent bien, portées par des unités exemptées.
    const refs = all.flatMap((m) => [m.loserFromA, m.loserFromB]).filter(Boolean).sort();
    expect(refs).toEqual(['a-1', 'a-2']);
    // Pas d'assertion sur le vainqueur ici : les parties sources n'existent
    // pas dans ce tableau isolé, donc les repêchés ne peuvent pas arriver.
    // La convergence est prouvée sur le vrai chemin, dans formules.test.ts.
  });
});

describe('équité du placement des entrées différées', () => {
  /** Deux repêchés ne doivent pas se rencontrer entre eux au cadrage. */
  it('répartit les entrées différées entre les parties du 1er tour', () => {
    for (const [n0, n1] of [[4, 2], [8, 4], [8, 2], [12, 4], [16, 8]] as [number, number][]) {
      const entrees = [...equipes(n0, 0), ...equipes(n1, 1)];
      const all = buildStagedBracket('c1', 'consolante', entrees, testCtx());

      // Les unités du 1er tour qui portent un engagé différé (entrée + exempt).
      const unitesDifferees = new Set(
        all
          .filter((m) => m.round === 0 && isByeMatch(m))
          .map((m) => m.position),
      );
      // Aucune partie du 2e tour ne doit avoir ses deux enfants différés.
      const entreEux = all
        .filter((m) => m.round === 1)
        .filter(
          (m) =>
            unitesDifferees.has(m.position * 2) && unitesDifferees.has(m.position * 2 + 1),
        );
      expect(entreEux.map((m) => m.position), `${n0} + ${n1}`).toEqual([]);
    }
  });
});
