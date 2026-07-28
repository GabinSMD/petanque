import { describe, expect, it } from 'vitest';
import {
  applyChanges,
  bracketRanking,
  bracketSizeOf,
  buildConsolanteFromSources,
  drawElimination,
  drawMainFromPoules,
  firstRoundSources,
  nextPow2,
  propagate,
  roundLabel,
} from '../bracket';
import { drawPoules, pouleOutcome, type PouleOutcome } from '../poules';
import { isByeMatch, winnerOf } from '../match';
import { spreadEvenly } from '../ctx';
import { at, makeTeam, makeTeams, playBracketMatch, playPouleSlot, testCtx } from './helpers';
import type { Match } from '../../types';

describe('utilitaires', () => {
  it('nextPow2', () => {
    expect(nextPow2(2)).toBe(2);
    expect(nextPow2(3)).toBe(4);
    expect(nextPow2(8)).toBe(8);
    expect(nextPow2(9)).toBe(16);
    expect(nextPow2(33)).toBe(64);
  });

  it('spreadEvenly répartit régulièrement', () => {
    const out = spreadEvenly(['a', 'b', 'c', 'd', 'e', 'f'], ['X', 'Y']);
    expect(out).toHaveLength(8);
    expect(out.filter((x) => x === 'X' || x === 'Y')).toHaveLength(2);
    // Pas d'exempts consécutifs quand il y a assez de vraies parties.
    for (let i = 1; i < out.length; i++) {
      expect(out[i] === out[i - 1]).toBe(false);
    }
  });

  it('roundLabel', () => {
    expect(roundLabel(2, 0, false)).toBe('Finale');
    expect(roundLabel(8, 0, false)).toBe('Quarts de finale');
    expect(roundLabel(16, 0, true)).toBe('Cadrage');
    expect(roundLabel(16, 1, true)).toBe('Quarts de finale');
    expect(roundLabel(16, 3, true)).toBe('Finale');
  });
});

describe('drawElimination', () => {
  it('16 équipes : tableau complet sans exempt', () => {
    const matches = drawElimination('c1', 'principal', makeTeams(16), testCtx());
    expect(matches).toHaveLength(15);
    expect(matches.filter((m) => m.round === 0)).toHaveLength(8);
    expect(matches.some((m) => isByeMatch(m))).toBe(false);
    const round0Teams = matches
      .filter((m) => m.round === 0)
      .flatMap((m) => [m.teamAId, m.teamBId]);
    expect(new Set(round0Teams).size).toBe(16);
  });

  it('10 équipes : cadrage avec 6 exempts auto-résolus', () => {
    const matches = drawElimination('c1', 'principal', makeTeams(10), testCtx());
    const round0 = matches.filter((m) => m.round === 0);
    expect(round0).toHaveLength(8);
    const byes = round0.filter(isByeMatch);
    expect(byes).toHaveLength(6);
    for (const b of byes) {
      expect(b.done).toBe(true);
      expect(winnerOf(b)).toBeTruthy();
    }
    // Les exemptés sont déjà montés au tour suivant.
    const round1Filled = matches
      .filter((m) => m.round === 1)
      .flatMap((m) => [m.teamAId, m.teamBId])
      .filter(Boolean);
    expect(round1Filled).toHaveLength(6);
  });

  it('évite deux équipes du même club au premier tour quand possible', () => {
    const teams = makeTeams(16).map((t, i) => ({ ...t, club: `Club ${i % 8}` }));
    const matches = drawElimination('c1', 'principal', teams, testCtx(3), {
      protections: [],
    });
    for (const m of matches.filter((x) => x.round === 0)) {
      const a = teams.find((t) => t.id === m.teamAId)!;
      const b = teams.find((t) => t.id === m.teamBId)!;
      expect(a.club === b.club).toBe(false);
    }
  });

  it('propage les vainqueurs et gère les corrections en cascade', () => {
    let matches = drawElimination('c1', 'principal', makeTeams(4), testCtx());
    const m0 = at(matches, 'principal', 0, 0);
    const m1 = at(matches, 'principal', 0, 1);
    matches = playBracketMatch(matches, m0.id, 13, 4);
    matches = playBracketMatch(matches, m1.id, 13, 9);

    let finale = at(matches, 'principal', 1, 0);
    expect(finale.teamAId).toBe(m0.teamAId);
    expect(finale.teamBId).toBe(m1.teamAId);

    matches = playBracketMatch(matches, finale.id, 13, 11);
    expect(winnerOf(at(matches, 'principal', 1, 0))).toBe(m0.teamAId);

    // Correction du premier match : la finale doit être réinitialisée.
    matches = playBracketMatch(matches, m0.id, 3, 13);
    finale = at(matches, 'principal', 1, 0);
    expect(finale.teamAId).toBe(m0.teamBId);
    expect(finale.done).toBe(false);
    expect(finale.scoreA).toBeNull();
  });
});

function playAllPoules(concoursId: string, teamCount: number, seed = 42) {
  const ctx = testCtx(seed);
  const teams = makeTeams(teamCount);
  const draw = drawPoules(concoursId, teams, ctx)!;
  let matches = draw.matches;
  for (const poule of draw.poules) {
    const slots = poule.teamIds.length === 4
      ? ['M1', 'M2', 'GAGNANTS', 'PERDANTS', 'BARRAGE']
      : ['M1', 'GAGNANTS', 'BARRAGE'];
    for (const slot of slots) {
      matches = playPouleSlot(poule, matches, slot, 13, 7);
    }
  }
  const outcomes = draw.poules.map((p) =>
    pouleOutcome(p, matches.filter((m) => m.pouleId === p.id)),
  );
  return { ctx, teams, draw, matches, outcomes };
}

describe('drawMainFromPoules', () => {
  it('8 qualifiés issus de 4 poules : premiers contre seconds d\'autres poules', () => {
    const { ctx, outcomes } = playAllPoules('c1', 16);
    expect(outcomes.every((o) => o.complete)).toBe(true);

    const main = drawMainFromPoules('c1', outcomes, ctx);
    expect(bracketSizeOf(main)).toBe(8);

    const pouleOf = new Map<string, number>();
    const rankOf = new Map<string, 1 | 2>();
    for (const o of outcomes) {
      pouleOf.set(o.q1!, o.poule.index);
      pouleOf.set(o.q2!, o.poule.index);
      rankOf.set(o.q1!, 1);
      rankOf.set(o.q2!, 2);
    }

    for (const m of main.filter((x) => x.round === 0)) {
      expect(pouleOf.get(m.teamAId!)).not.toBe(pouleOf.get(m.teamBId!));
      const ranks = [rankOf.get(m.teamAId!), rankOf.get(m.teamBId!)].sort();
      expect(ranks).toEqual([1, 2]); // un premier rencontre un second
    }

    // Premier et second d'une même poule dans des moitiés opposées.
    const half = (m: Match) => (m.position * 2 < 4 ? 0 : 1);
    for (const o of outcomes) {
      const mQ1 = main.find((m) => m.round === 0 && (m.teamAId === o.q1 || m.teamBId === o.q1))!;
      const mQ2 = main.find((m) => m.round === 0 && (m.teamAId === o.q2 || m.teamBId === o.q2))!;
      expect(half(mQ1)).not.toBe(half(mQ2));
    }
  });

  it('10 qualifiés issus de 5 poules : cadrage, exempts prioritaires aux premiers', () => {
    const { ctx, outcomes } = playAllPoules('c1', 20);
    const main = drawMainFromPoules('c1', outcomes, ctx);
    expect(bracketSizeOf(main)).toBe(16);

    const round0 = main.filter((m) => m.round === 0);
    const byes = round0.filter(isByeMatch);
    expect(byes).toHaveLength(6);

    const firstIds = new Set(outcomes.map((o) => o.q1));
    const byedFirsts = byes.filter((m) => firstIds.has(m.teamAId));
    expect(byedFirsts.length).toBe(5); // tous les premiers exemptés
  });
});

describe('consolante alimentée par les perdants', () => {
  it('reçoit les perdants du cadrage au fil des résultats', () => {
    const ctx = testCtx(11);
    let main = drawElimination('c1', 'principal', makeTeams(10), ctx);
    const realFirstRound = main
      .filter((m) => m.round === 0 && !isByeMatch(m))
      .sort((a, b) => a.position - b.position);
    expect(realFirstRound).toHaveLength(2);

    const conso = buildConsolanteFromSources('c1', realFirstRound.map((m) => m.id), ctx);
    expect(conso).toHaveLength(1);
    expect(conso[0]!.loserFromA).toBe(realFirstRound[0]!.id);
    expect(conso[0]!.loserFromB).toBe(realFirstRound[1]!.id);

    let all = [...main, ...conso];
    const m0 = realFirstRound[0]!;
    all = playBracketMatch(all, m0.id, 13, 6);

    const consoMatch = all.find((m) => m.stage === 'consolante')!;
    expect(consoMatch.teamAId).toBe(m0.teamBId); // le perdant est arrivé
    expect(consoMatch.teamBId).toBeNull();
  });
});

describe('complémentaire (consolante à 2 niveaux)', () => {
  it('est alimenté par les perdants du 1er tour de la consolante', () => {
    const ctx = testCtx(7);
    const main = drawElimination('c1', 'principal', makeTeams(8), ctx);
    const mainSources = firstRoundSources(main, 'principal');
    expect(mainSources).toHaveLength(4);

    // Consolante : 4 perdants → tableau de 4 (2 parties au 1er tour).
    const conso = buildConsolanteFromSources('c1', mainSources, ctx);
    const consoSources = firstRoundSources(conso, 'consolante');
    expect(consoSources).toHaveLength(2);

    // Complémentaire : 2 perdants de la consolante → 1 partie.
    const comp = buildConsolanteFromSources('c1', consoSources, ctx, 'complementaire');
    expect(comp).toHaveLength(1);
    expect(comp[0]!.stage).toBe('complementaire');
    expect(comp[0]!.loserFromA).toBe(consoSources[0]);
    expect(comp[0]!.loserFromB).toBe(consoSources[1]);

    // Le perdant remonte en cascade : principal → consolante → complémentaire.
    let all = [...main, ...conso, ...comp];
    for (const id of mainSources) all = playBracketMatch(all, id, 13, 5);
    const consoR0 = all.filter(
      (m) => m.stage === 'consolante' && m.round === 0 && !isByeMatch(m),
    );
    expect(consoR0.every((m) => m.teamAId && m.teamBId)).toBe(true);

    for (const m of consoR0) all = playBracketMatch(all, m.id, 13, 6);
    const compMatch = all.find((m) => m.stage === 'complementaire')!;
    expect(compMatch.teamAId).toBeTruthy();
    expect(compMatch.teamBId).toBeTruthy();

    // Jouer le complémentaire donne un vainqueur classable.
    all = playBracketMatch(all, compMatch.id, 13, 7);
    const groups = bracketRanking(all, 'complementaire');
    expect(groups[0]).toMatchObject({ rank: 1, label: 'Vainqueur' });
    expect(groups[0]!.teamIds).toHaveLength(1);
  });
});

describe('bracketRanking', () => {
  it('classe vainqueur, finaliste et demi-finalistes', () => {
    let matches = drawElimination('c1', 'principal', makeTeams(4), testCtx());
    const m0 = at(matches, 'principal', 0, 0);
    const m1 = at(matches, 'principal', 0, 1);
    matches = playBracketMatch(matches, m0.id, 13, 4);
    matches = playBracketMatch(matches, m1.id, 13, 9);
    const finale = at(matches, 'principal', 1, 0);
    matches = playBracketMatch(matches, finale.id, 13, 11);

    const groups = bracketRanking(matches, 'principal');
    expect(groups[0]).toMatchObject({ rank: 1, label: 'Vainqueur', teamIds: [m0.teamAId] });
    expect(groups[1]).toMatchObject({ rank: 2, label: 'Finaliste', teamIds: [m1.teamAId] });
    expect(groups[2]!.label).toBe('Demi-finalistes');
    expect(groups[2]!.teamIds.sort()).toEqual([m0.teamBId, m1.teamBId].sort());
  });
});

describe('intégration : concours complet en poules (7 équipes)', () => {
  it('déroule poules puis tableau jusqu\'à la finale', () => {
    const { ctx, outcomes } = playAllPoules('c1', 7, 5);
    expect(outcomes).toHaveLength(2);

    let main = drawMainFromPoules('c1', outcomes, ctx);
    expect(bracketSizeOf(main)).toBe(4);

    let pending = main.filter((m) => !m.done && m.teamAId && m.teamBId);
    while (pending.length > 0) {
      main = playBracketMatch(main, pending[0]!.id, 13, 8);
      pending = main.filter((m) => !m.done && m.teamAId && m.teamBId);
    }
    const groups = bracketRanking(main, 'principal');
    expect(groups[0]!.rank).toBe(1);
    expect(groups[0]!.teamIds).toHaveLength(1);
  });
});
