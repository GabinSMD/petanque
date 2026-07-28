import { describe, expect, it } from 'vitest';
import {
  bracketSizeOf,
  buildConsolanteFromSources,
  drawElimination,
  firstRoundSources,
} from '../bracket';
import { buildFormuleBrackets, formuleOf, FORMULE_RULES } from '../formules';
import { createPouleMatches, drawPoules, pouleGroupOutcome } from '../poules';
import { isByeMatch, loserOf } from '../match';
import { at, makeTeams, playBracketMatch, playPouleSlot, testCtx } from './helpers';
import type { Match, Poule } from '../../types';

/** Joue tout un tour d'un tableau (le côté A gagne 13-7). */
function playRound(all: Match[], stage: string, round: number): Match[] {
  const ids = all
    .filter((m) => m.stage === stage && m.round === round && !isByeMatch(m) && !m.done)
    .map((m) => m.id);
  let out = all;
  for (const id of ids) out = playBracketMatch(out, id, 13, 7);
  return out;
}

describe('formules A-B-C : structure', () => {
  it('abc_recup (§3.D.8) : le B reçoit les perdants du 1er tour de A et, au cadrage, ceux du 2e', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    const secondary = buildFormuleBrackets('c1', main, 'abc_recup', ctx);

    const b = secondary.filter((m) => m.stage === 'consolante');
    const b0 = b.filter((m) => m.round === 0);
    // 8 perdants du 1er tour de A → 4 vraies parties ; 4 perdants du 2e tour
    // de A → 4 unités exemptées, qui les font entrer au tour suivant.
    expect(bracketSizeOf(b)).toBe(16);
    expect(b0).toHaveLength(8);
    expect(b0.filter((m) => isByeMatch(m))).toHaveLength(4);

    // Le C ne reçoit que les perdants du 1er tour du B.
    const c = secondary.filter((m) => m.stage === 'complementaire');
    expect(bracketSizeOf(c)).toBe(4);
    expect(c.filter((m) => m.round === 0 && isByeMatch(m))).toHaveLength(0);
  });

  it('abc (§3.D.10) : aucune récupération depuis le 2e tour de A', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    const secondary = buildFormuleBrackets('c1', main, 'abc', ctx);

    const b = secondary.filter((m) => m.stage === 'consolante');
    expect(bracketSizeOf(b)).toBe(8);
    expect(b.filter((m) => m.round === 0 && isByeMatch(m))).toHaveLength(0);
  });

  it('ab (§3.D.9) : pas de concours C', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    const secondary = buildFormuleBrackets('c1', main, 'ab', ctx);
    expect(secondary.some((m) => m.stage === 'complementaire')).toBe(false);
  });

  it('a : aucun tableau secondaire', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    expect(buildFormuleBrackets('c1', main, 'a', ctx)).toHaveLength(0);
  });
});

describe('formules A-B-C : cheminement des perdants', () => {
  it('abc_recup : le perdant du 2e tour de A entre au cadrage du B sans jouer le 1er tour', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    let all = [...main, ...buildFormuleBrackets('c1', main, 'abc_recup', ctx)];

    all = playRound(all, 'principal', 0);
    const a1 = at(all, 'principal', 1, 0);
    all = playBracketMatch(all, a1.id, 13, 5);
    const recovered = loserOf(at(all, 'principal', 1, 0));
    expect(recovered).toBeTruthy();

    // Il occupe une unité exemptée du 1er tour du B, déjà résolue…
    const bye = all.find(
      (m) =>
        m.stage === 'consolante' &&
        m.round === 0 &&
        isByeMatch(m) &&
        (m.teamAId === recovered || m.teamBId === recovered),
    );
    expect(bye?.done).toBe(true);
    // … et se retrouve donc au 2e tour du B (le cadrage).
    const inCadrage = all.some(
      (m) =>
        m.stage === 'consolante' &&
        m.round === 1 &&
        (m.teamAId === recovered || m.teamBId === recovered),
    );
    expect(inCadrage).toBe(true);
  });

  it('abc : le perdant du 2e tour de A ne réapparaît nulle part', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    let all = [...main, ...buildFormuleBrackets('c1', main, 'abc', ctx)];

    all = playRound(all, 'principal', 0);
    const a1 = at(all, 'principal', 1, 0);
    all = playBracketMatch(all, a1.id, 13, 5);
    const eliminated = loserOf(at(all, 'principal', 1, 0));

    const reappears = all.some(
      (m) =>
        m.stage !== 'principal' && (m.teamAId === eliminated || m.teamBId === eliminated),
    );
    expect(reappears).toBe(false);
  });

  it('abc_cd19 (§3.D.12) : le perdant du 2e tour de A part au 1er tour du C', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    let all = [...main, ...buildFormuleBrackets('c1', main, 'abc_cd19', ctx)];

    all = playRound(all, 'principal', 0);
    const a1 = at(all, 'principal', 1, 0);
    all = playBracketMatch(all, a1.id, 13, 5);
    const recovered = loserOf(at(all, 'principal', 1, 0));

    const inC = all.find(
      (m) =>
        m.stage === 'complementaire' &&
        m.round === 0 &&
        (m.teamAId === recovered || m.teamBId === recovered),
    );
    expect(inC).toBeTruthy();
    expect(isByeMatch(inC!)).toBe(false);
    // Et pas dans le B.
    const inB = all.some(
      (m) => m.stage === 'consolante' && (m.teamAId === recovered || m.teamBId === recovered),
    );
    expect(inB).toBe(false);
  });

  it('abc_recup : corriger une partie de A retire l équipe récupérée du B', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    let all = [...main, ...buildFormuleBrackets('c1', main, 'abc_recup', ctx)];

    all = playRound(all, 'principal', 0);
    const a1Id = at(all, 'principal', 1, 0).id;
    all = playBracketMatch(all, a1Id, 13, 5);
    const firstLoser = loserOf(at(all, 'principal', 1, 0));

    // Résultat inversé : l'autre équipe descend dans le B.
    all = playBracketMatch(all, a1Id, 5, 13);
    const newLoser = loserOf(at(all, 'principal', 1, 0));
    expect(newLoser).not.toBe(firstLoser);

    const stillThere = all.some(
      (m) => m.stage === 'consolante' && (m.teamAId === firstLoser || m.teamBId === firstLoser),
    );
    expect(stillThere).toBe(false);
    const arrived = all.some(
      (m) => m.stage === 'consolante' && (m.teamAId === newLoser || m.teamBId === newLoser),
    );
    expect(arrived).toBe(true);
  });

  it('chaque formule ne cible que des tableaux existants', () => {
    for (const [formule, rules] of Object.entries(FORMULE_RULES)) {
      for (const r of rules) {
        expect(['principal', 'consolante']).toContain(r.from);
        expect(['consolante', 'complementaire']).toContain(r.to);
        expect(r.fromRound).toBeGreaterThanOrEqual(0);
        expect(r.toRound).toBeGreaterThanOrEqual(0);
        if (r.from === 'consolante') {
          // Le B doit être alimenté avant de servir de source.
          expect(rules.some((x) => x.to === 'consolante')).toBe(true);
        }
        expect(formule).toBeTruthy();
      }
    }
  });
});

describe('formuleOf : compatibilité avec les cases consolante / complémentaire', () => {
  it('sans formule explicite, déduit de consolante et complementaire', () => {
    expect(formuleOf({ consolante: false })).toBe('a');
    expect(formuleOf({ consolante: true })).toBe('ab');
    expect(formuleOf({ consolante: true, complementaire: false })).toBe('ab');
    expect(formuleOf({ consolante: true, complementaire: true })).toBe('abc');
  });

  it('la formule explicite prime sur les cases', () => {
    expect(formuleOf({ formule: 'abc_recup', consolante: false })).toBe('abc_recup');
  });

  it('ab reproduit exactement l ancienne consolante', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(10), ctx);
    const viaFormule = buildFormuleBrackets('c1', main, 'ab', testCtx(7));
    const viaLegacy = buildConsolanteFromSources(
      'c1',
      firstRoundSources(main, 'principal'),
      testCtx(7),
    );
    const shape = (ms: Match[]) =>
      ms
        .map((m) => `${m.stage}/${m.round}/${m.position}/${m.loserFromA ?? '-'}/${m.loserFromB ?? '-'}/${m.byeB ? 'X' : ''}`)
        .sort();
    expect(shape(viaFormule)).toEqual(shape(viaLegacy));
  });
});

describe('poules par groupes A-B-C (§3.D.5)', () => {
  it('2 victoires → A, 1 victoire → B (les deux), 0 victoire → C', () => {
    const ctx = testCtx();
    const draw = drawPoules('c1', makeTeams(4), ctx);
    expect(draw).toBeTruthy();
    const poule = draw!.poules[0]!;
    let matches = draw!.matches;
    const [t1, t2, t3, t4] = poule.teamIds as [string, string, string, string];

    matches = playPouleSlot(poule, matches, 'M1', 13, 7); // t1 bat t2
    matches = playPouleSlot(poule, matches, 'M2', 13, 7); // t3 bat t4
    matches = playPouleSlot(poule, matches, 'GAGNANTS', 13, 7); // t1 bat t3
    matches = playPouleSlot(poule, matches, 'PERDANTS', 13, 7); // t2 bat t4

    const out = pouleGroupOutcome(poule, matches);
    expect(out.complete).toBe(true);
    expect(out.gg).toBe(t1);
    expect(out.gp.slice().sort()).toEqual([t2, t3].sort());
    expect(out.pp).toBe(t4);
  });

  it('incomplet tant que gagnants et perdants ne sont pas joués (le barrage ne compte pas)', () => {
    const ctx = testCtx();
    const draw = drawPoules('c1', makeTeams(4), ctx);
    const poule = draw!.poules[0]!;
    let matches = draw!.matches;

    matches = playPouleSlot(poule, matches, 'M1', 13, 7);
    matches = playPouleSlot(poule, matches, 'M2', 13, 7);
    expect(pouleGroupOutcome(poule, matches).complete).toBe(false);

    matches = playPouleSlot(poule, matches, 'GAGNANTS', 13, 7);
    matches = playPouleSlot(poule, matches, 'PERDANTS', 13, 7);
    expect(pouleGroupOutcome(poule, matches).complete).toBe(true);
  });

  it('refuse une poule de 3 (les victoires ne sont pas comparables)', () => {
    const ctx = testCtx();
    const poule: Poule = {
      id: 'p3',
      concoursId: 'c1',
      index: 1,
      teamIds: ['t1', 't2', 't3'],
      terrain: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(() => pouleGroupOutcome(poule, createPouleMatches('c1', poule, ctx))).toThrow(
      /poules de 4/i,
    );
  });
});

describe('formule ABC CD53 (§3.D.13) : double repêchage au cadrage', () => {
  /** Joue tout ce qui est jouable, dans tous les tableaux, jusqu'à épuisement. */
  function jouerTout(all: Match[]): Match[] {
    let out = all;
    for (let garde = 0; garde < 200; garde += 1) {
      const jouable = out.find((m) => !m.done && !isByeMatch(m) && m.teamAId && m.teamBId);
      if (!jouable) break;
      out = playBracketMatch(out, jouable.id, 13, 7);
    }
    return out;
  }

  it('le B reçoit les perdants du 2e tour de A, le C ceux du 2e tour de B', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    const secondary = buildFormuleBrackets('c1', main, 'abc_cd53', ctx);
    let all = jouerTout([...main, ...secondary]);

    const vainqueurDe = (stage: string) => {
      const ms = all.filter((m) => m.stage === stage);
      const maxRound = Math.max(...ms.map((m) => m.round));
      return loserOf(ms.find((m) => m.round === maxRound)!) === null
        ? null
        : ms.find((m) => m.round === maxRound)!;
    };

    // Les trois tableaux vont au bout : personne ne reste bloqué.
    for (const stage of ['principal', 'consolante', 'complementaire']) {
      const ms = all.filter((m) => m.stage === stage);
      expect(ms.length, `${stage} vide`).toBeGreaterThan(0);
      const bloquees = ms.filter(
        (m) => !m.done && !isByeMatch(m) && ((m.teamAId && !m.teamBId) || (!m.teamAId && m.teamBId)),
      );
      expect(bloquees.map((m) => `${stage} ${m.round}:${m.position}`)).toEqual([]);
      expect(vainqueurDe(stage), `${stage} sans finale jouée`).toBeTruthy();
    }
  });

  it('un perdant du 2e tour du B entre au 2e tour du C, sans jouer le 1er', () => {
    const ctx = testCtx();
    const main = drawElimination('c1', 'principal', makeTeams(16), ctx);
    const secondary = buildFormuleBrackets('c1', main, 'abc_cd53', ctx);
    let all = [...main, ...secondary];

    // Dérouler jusqu'à ce que le 2e tour du B soit jouable, puis le jouer.
    all = jouerTout(all);
    const bRound1 = all.filter((m) => m.stage === 'consolante' && m.round === 1 && m.done && !isByeMatch(m));
    expect(bRound1.length).toBeGreaterThan(0);
    const reverse = loserOf(bRound1[0]!);
    expect(reverse).toBeTruthy();

    const dansLeC = all.filter(
      (m) => m.stage === 'complementaire' && (m.teamAId === reverse || m.teamBId === reverse),
    );
    expect(dansLeC.length, 'le reversé doit apparaître dans le C').toBeGreaterThan(0);
    const premiereVraie = dansLeC.filter((m) => !isByeMatch(m)).sort((a, b) => a.round - b.round)[0];
    if (premiereVraie) expect(premiereVraie.round).toBeGreaterThanOrEqual(1);
  });
});
