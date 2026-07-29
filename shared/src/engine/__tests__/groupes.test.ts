import { describe, expect, it } from 'vitest';
import { drawGroupesABC } from '../groupes';
import { createPouleMatches, drawPoules, pouleGroupOutcome, recomputePoule } from '../poules';
import { applyChanges } from '../bracket';
import { makeTeams, testCtx } from './helpers';
import type { Match, Poule, Team } from '../../types';

/**
 * Quatre groupes de 4 entièrement joués. Dans chaque groupe, l'équipe placée en
 * premier gagne ses deux parties, la dernière perd les deux.
 */
function groupesJoues(nbGroupes: number): {
  teams: Team[];
  poules: Poule[];
  matches: Match[];
} {
  const teams = makeTeams(nbGroupes * 4);
  const ctx = testCtx();
  const tirage = drawPoules('c1', teams, ctx);
  if (!tirage) throw new Error('effectif incompatible avec des groupes de 4');
  const { poules } = tirage;
  let matches: Match[] = poules.flatMap((p: Poule) =>
    createPouleMatches('c1', p, ctx, { sansBarrage: true }),
  );

  for (const poule of poules) {
    const jouer = (slot: string, gagneA: boolean): void => {
      const pouleMatches = matches.filter((m) => m.pouleId === poule.id);
      const m = pouleMatches.find((x) => x.pouleSlot === slot);
      if (!m || !m.teamAId || !m.teamBId) throw new Error(`partie ${slot} non prête`);
      matches = matches.map((x) =>
        x.id === m.id
          ? { ...x, scoreA: gagneA ? 13 : 7, scoreB: gagneA ? 7 : 13, done: true }
          : x,
      );
      matches = applyChanges(
        matches,
        recomputePoule(poule, matches.filter((x) => x.pouleId === poule.id)),
      );
    };
    jouer('M1', true);
    jouer('M2', true);
    jouer('GAGNANTS', true);
    jouer('PERDANTS', true);
  }
  return { teams, poules, matches };
}

function bilans(poules: Poule[], matches: Match[]) {
  return poules.map((p) => pouleGroupOutcome(p, matches.filter((m) => m.pouleId === p.id)));
}

describe('poule sans barrage (formule par groupes)', () => {
  it('un groupe de 4 compte quatre parties, sans barrage', () => {
    const poule = drawPoules('c1', makeTeams(4), testCtx())?.poules[0];
    const matches = createPouleMatches('c1', poule!, testCtx(), { sansBarrage: true });
    expect(matches).toHaveLength(4);
    expect(matches.map((m) => m.pouleSlot).sort()).toEqual([
      'GAGNANTS',
      'M1',
      'M2',
      'PERDANTS',
    ]);
  });

  it('une poule ordinaire garde son barrage', () => {
    const poule = drawPoules('c1', makeTeams(4), testCtx())?.poules[0];
    expect(createPouleMatches('c1', poule!, testCtx())).toHaveLength(5);
  });

  it('le recalcul ne bronche pas sur un barrage absent', () => {
    const { poules, matches } = groupesJoues(1);
    const bilan = bilans(poules, matches)[0]!;
    expect(bilan.complete).toBe(true);
    expect(bilan.gg).toBeTruthy();
    expect(bilan.gp).toHaveLength(2);
    expect(bilan.pp).toBeTruthy();
  });
});

describe('trois tableaux depuis les groupes (§3.D.5)', () => {
  it('A prend les 2 victoires, B les 1 victoire, C les 2 défaites', () => {
    const { teams, poules, matches } = groupesJoues(4);
    const out = bilans(poules, matches);
    const finales = drawGroupesABC('c1', out, teams, testCtx());

    const premierTour = (stage: string): Match[] =>
      finales.filter((m) => m.stage === stage && m.round === 0);
    const equipesDe = (stage: string): string[] =>
      premierTour(stage)
        .flatMap((m) => [m.teamAId, m.teamBId])
        .filter((x): x is string => Boolean(x));

    // 4 groupes : 4 équipes en A, 8 en B, 4 en C.
    expect(new Set(equipesDe('principal')).size).toBe(4);
    expect(new Set(equipesDe('consolante')).size).toBe(8);
    expect(new Set(equipesDe('complementaire')).size).toBe(4);

    // Et chacune est bien celle attendue par son nombre de victoires.
    expect(equipesDe('principal').sort()).toEqual(out.map((o) => o.gg!).sort());
    expect(equipesDe('consolante').sort()).toEqual(out.flatMap((o) => o.gp).sort());
    expect(equipesDe('complementaire').sort()).toEqual(out.map((o) => o.pp!).sort());
  });

  it('chaque équipe joue dans un seul tableau, et aucune n\'est oubliée', () => {
    const { teams, poules, matches } = groupesJoues(4);
    const finales = drawGroupesABC('c1', bilans(poules, matches), teams, testCtx());
    const placees = finales
      .filter((m) => m.round === 0)
      .flatMap((m: Match) => [m.teamAId, m.teamBId])
      .filter((x): x is string => Boolean(x));
    expect(placees).toHaveLength(16);
    expect(new Set(placees).size).toBe(16);
  });

  it('en B, les deux équipes d\'un même groupe ne se rencontrent pas d\'emblée', () => {
    // Elles viennent de se départager dans le groupe : les faire rejouer
    // aussitôt n'aurait pas de sens.
    for (const graine of [1, 2, 3, 5, 8, 13, 21, 42]) {
      const { teams, poules, matches } = groupesJoues(4);
      const out = bilans(poules, matches);
      const groupeDe = new Map<string, number>();
      for (const o of out) for (const id of o.gp) groupeDe.set(id, o.poule.index);
      const b = drawGroupesABC('c1', out, teams, testCtx(graine)).filter(
        (m) => m.stage === 'consolante' && m.round === 0,
      );
      for (const m of b as Match[]) {
        if (!m.teamAId || !m.teamBId) continue;
        expect(groupeDe.get(m.teamAId)).not.toBe(groupeDe.get(m.teamBId));
      }
    }
  });

  it('refuse de tirer tant qu\'un groupe n\'est pas fini', () => {
    const { teams, poules, matches } = groupesJoues(2);
    const out = bilans(poules, matches);
    const inachevé = [{ ...out[0]!, complete: false }, out[1]!];
    expect(() => drawGroupesABC('c1', inachevé, teams, testCtx())).toThrow(/groupe/i);
  });
});
