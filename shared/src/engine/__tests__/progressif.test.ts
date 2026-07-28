import { describe, expect, it } from 'vitest';
import { applyChanges, propagate } from '../bracket';
import { buildTableauVide, placerQualifie, qualifiesManquants } from '../progressif';
import { createPouleMatches, drawPoules } from '../poules';
import { isByeMatch, winnerOf } from '../match';
import { makeTeams, playPouleSlot, testCtx } from './helpers';
import type { Match, Poule } from '../../types';
import type { Qualifie } from '../progressif';

/** Tire des poules et rend le tout, prêt à jouer. */
function concoursPoules(nbEquipes: number) {
  const ctx = testCtx();
  const teams = makeTeams(nbEquipes);
  const draw = drawPoules('c1', teams, ctx, { sansProtection: true })!;
  return { ctx, teams, poules: draw.poules, matches: draw.matches };
}

/** Joue une poule de 4 entièrement : t1 sort 1er, t2 sort 2e. */
function jouerPoule(poule: Poule, matches: Match[]): Match[] {
  let out = matches;
  out = playPouleSlot(poule, out, 'M1', 13, 7);
  out = playPouleSlot(poule, out, 'M2', 13, 7);
  out = playPouleSlot(poule, out, 'GAGNANTS', 13, 7);
  out = playPouleSlot(poule, out, 'PERDANTS', 13, 7);
  out = playPouleSlot(poule, out, 'BARRAGE', 13, 7);
  return out;
}

describe('tableau créé vide', () => {
  it('se dimensionne sur les qualifiés attendus', () => {
    const ctx = testCtx();
    // 3 poules → 6 qualifiés → tableau de 8 avec 2 exempts.
    const vide = buildTableauVide('c1', 6, ctx);
    expect(vide.filter((m) => m.round === 0)).toHaveLength(4);
    expect(vide.filter((m) => m.round === 0 && isByeMatch(m))).toHaveLength(2);
    expect(vide.every((m) => m.stage === 'principal')).toBe(true);
    // Aucune équipe encore : rien n'est jouable.
    expect(vide.every((m) => !m.teamAId && !m.teamBId)).toBe(true);
  });

  it('sans exempt quand l effectif tombe juste', () => {
    const vide = buildTableauVide('c1', 8, testCtx());
    expect(vide.filter((m) => m.round === 0)).toHaveLength(4);
    expect(vide.some((m) => isByeMatch(m))).toBe(false);
  });
});

describe('placement des qualifiés au fil des poules', () => {
  it('une poule terminée place ses deux qualifiés, les autres attendent', () => {
    const { ctx, poules, matches } = concoursPoules(12);
    let all = [...matches, ...buildTableauVide('c1', poules.length * 2, ctx)];
    all = jouerPoule(poules[0]!, all);

    const manquants: Qualifie[] = qualifiesManquants(poules, all);
    expect(manquants).toHaveLength(2);
    expect(manquants.every((q) => q.pouleId === poules[0]!.id)).toBe(true);

    for (const q of manquants) all = placerQualifie(all, q, ctx);
    all = applyChanges(all, propagate(all));

    // Les deux qualifiés sont entrés au tableau, et plus personne n'attend.
    // On compte les entrées du 1er tour : une équipe placée sur une case
    // exempte avance aussitôt et apparaîtrait deux fois.
    const entrees = all
      .filter((m) => m.stage === 'principal' && m.round === 0)
      .flatMap((m) => [m.teamAId, m.teamBId])
      .filter(Boolean);
    expect(new Set(entrees).size).toBe(2);
    expect(qualifiesManquants(poules, all)).toHaveLength(0);
  });

  it('une partie devient jouable dès que les deux cases sont remplies', () => {
    const { ctx, poules, matches } = concoursPoules(8);
    let all = [...matches, ...buildTableauVide('c1', poules.length * 2, ctx)];
    for (const poule of poules) all = jouerPoule(poule, all);
    for (const q of qualifiesManquants(poules, all)) all = placerQualifie(all, q, ctx);
    all = applyChanges(all, propagate(all));

    const jouables = all.filter(
      (m) => m.stage === 'principal' && m.round === 0 && m.teamAId && m.teamBId && !m.done,
    );
    expect(jouables.length).toBeGreaterThan(0);
  });

  it('évite de faire rejouer deux qualifiés de la même poule', () => {
    const { ctx, poules, matches } = concoursPoules(16);
    let all = [...matches, ...buildTableauVide('c1', poules.length * 2, ctx)];
    for (const poule of poules) all = jouerPoule(poule, all);
    for (const q of qualifiesManquants(poules, all)) all = placerQualifie(all, q, ctx);
    all = applyChanges(all, propagate(all));

    const pouleDe = new Map<string, string>();
    for (const p of poules) for (const id of p.teamIds) pouleDe.set(id, p.id);
    for (const m of all.filter((x) => x.stage === 'principal' && x.round === 0)) {
      if (!m.teamAId || !m.teamBId) continue;
      expect(
        pouleDe.get(m.teamAId),
        `${m.teamAId} et ${m.teamBId} viennent de la même poule`,
      ).not.toBe(pouleDe.get(m.teamBId));
    }
  });

  it('corriger une poule change le qualifié dans le tableau', () => {
    const { ctx, poules, matches } = concoursPoules(8);
    let all = [...matches, ...buildTableauVide('c1', poules.length * 2, ctx)];
    all = jouerPoule(poules[0]!, all);
    for (const q of qualifiesManquants(poules, all)) all = placerQualifie(all, q, ctx);
    all = applyChanges(all, propagate(all));

    const premier = winnerOf(
      all.find((m) => m.pouleId === poules[0]!.id && m.pouleSlot === 'GAGNANTS'),
    );
    expect(
      all.some((m) => m.stage === 'principal' && (m.teamAId === premier || m.teamBId === premier)),
    ).toBe(true);

    // On inverse la partie des gagnants : le 1er de poule change.
    all = playPouleSlot(poules[0]!, all, 'GAGNANTS', 7, 13);
    all = applyChanges(all, propagate(all));
    const nouveauPremier = winnerOf(
      all.find((m) => m.pouleId === poules[0]!.id && m.pouleSlot === 'GAGNANTS'),
    );
    expect(nouveauPremier).not.toBe(premier);

    // Le tableau suit : l'ancien n'y est plus, le nouveau y est.
    const dansLeTableau = all
      .filter((m) => m.stage === 'principal')
      .flatMap((m) => [m.teamAId, m.teamBId]);
    expect(dansLeTableau).not.toContain(premier);
    expect(dansLeTableau).toContain(nouveauPremier);
  });

  it('un qualifié déjà placé n est pas placé deux fois', () => {
    const { ctx, poules, matches } = concoursPoules(8);
    let all = [...matches, ...buildTableauVide('c1', poules.length * 2, ctx)];
    all = jouerPoule(poules[0]!, all);
    for (const q of qualifiesManquants(poules, all)) all = placerQualifie(all, q, ctx);
    expect(qualifiesManquants(poules, all)).toHaveLength(0);
    // Rejouer le placement ne doit rien ajouter.
    for (const q of qualifiesManquants(poules, all)) all = placerQualifie(all, q, ctx);
    const places = all
      .filter((m) => m.stage === 'principal')
      .flatMap((m) => [m.qualifFromA, m.qualifFromB])
      .filter(Boolean);
    expect(places).toHaveLength(2);
  });
});
