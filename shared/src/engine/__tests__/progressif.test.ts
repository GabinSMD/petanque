import { describe, expect, it } from 'vitest';
import { applyChanges, propagate } from '../bracket';
import { buildTableauVide, placerQualifie, qualifiesManquants } from '../progressif';
import { createPouleMatches, drawPoules } from '../poules';
import { isByeMatch, winnerOf } from '../match';
import { makeTeams, playBracketMatch, playPouleSlot, testCtx } from './helpers';
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

describe('cadrage du tableau après les poules (§3.D.2)', () => {
  /** Joue tout ce qui est jouable dans le tableau, jusqu'à épuisement. */
  function jouerTableau(all: Match[]): Match[] {
    let out = all;
    for (let garde = 0; garde < 200; garde += 1) {
      const jouable = out.find(
        (m) => m.stage === 'principal' && !m.done && !isByeMatch(m) && m.teamAId && m.teamBId,
      );
      if (!jouable) break;
      out = playBracketMatch(out, jouable.id, 13, 7);
    }
    return out;
  }

  it('cadrer au 1er tour : les exempts sont au premier tour (le défaut)', () => {
    // 6 poules → 12 qualifiés → tableau de 16, 4 qualifiés exempts au 1er tour.
    const vide = buildTableauVide('c1', 12, testCtx(), 'principal', 0);
    expect(vide.filter((m) => m.round === 0)).toHaveLength(8);
    expect(vide.filter((m) => m.round === 0 && isByeMatch(m))).toHaveLength(4);
  });

  it('ne pas cadrer au 1er tour : tous les qualifiés jouent, les exempts tombent au 2e', () => {
    const vide = buildTableauVide('c1', 12, testCtx(), 'principal', 1);
    const premier = vide.filter((m) => m.round === 0);
    // 12 qualifiés → 6 vraies parties, aucune place exempte au 1er tour.
    expect(premier).toHaveLength(6);
    expect(premier.some((m) => isByeMatch(m))).toBe(false);
    // 6 vainqueurs ramenés à 4 : 2 parties de cadrage, 2 vainqueurs exemptés.
    const second = vide.filter((m) => m.round === 1);
    expect(second.filter((m) => !isByeMatch(m))).toHaveLength(2);
    expect(second.filter((m) => isByeMatch(m))).toHaveLength(2);
  });

  it('concours complet : chaque qualifié entre au 1er tour, et le tableau va au bout', () => {
    const { ctx, poules, matches } = concoursPoules(24);
    expect(poules).toHaveLength(6);
    let all = [...matches, ...buildTableauVide('c1', poules.length * 2, ctx, 'principal', 1)];
    for (const poule of poules) all = jouerPoule(poule, all);
    for (const q of qualifiesManquants(poules, all)) all = placerQualifie(all, q, ctx);
    all = applyChanges(all, propagate(all));
    expect(qualifiesManquants(poules, all)).toHaveLength(0);

    // Les 12 qualifiés sont au 1er tour, aucun n'est exempté.
    const premier = all.filter((m) => m.stage === 'principal' && m.round === 0);
    const entrants = premier.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean);
    expect(new Set(entrants).size).toBe(12);
    expect(premier.every((m) => m.teamAId && m.teamBId)).toBe(true);

    all = jouerTableau(all);
    const tableau = all.filter((m) => m.stage === 'principal');
    expect(tableau.filter((m) => !m.done).map((m) => `${m.round}:${m.position}`)).toEqual([]);
    const dernierTour = Math.max(...tableau.map((m) => m.round));
    const finale = tableau.filter((m) => m.round === dernierTour);
    expect(finale).toHaveLength(1);
    expect(winnerOf(finale[0])).toBeTruthy();
  });

  it('les moitiés du tableau se comptent sur toute sa largeur, trous compris', () => {
    // 9 poules → 18 qualifiés, cadrage au 2e tour : 9 parties au 1er tour,
    // posées sur 16 unités. La moitié haute couvre les positions 0 à 7, et
    // non les 4 premières parties existantes (9 / 2).
    const { ctx, poules, matches } = concoursPoules(36);
    expect(poules).toHaveLength(9);
    let all = [...matches, ...buildTableauVide('c1', poules.length * 2, ctx, 'principal', 1)];
    for (const poule of poules) all = jouerPoule(poule, all);
    for (const q of qualifiesManquants(poules, all)) all = placerQualifie(all, q, ctx);

    const premier = all.filter((m) => m.stage === 'principal' && m.round === 0);
    const moitieDe = new Map<string, number>();
    for (const m of premier) {
      for (const ref of [m.qualifFromA, m.qualifFromB]) {
        if (ref) moitieDe.set(ref, m.position < 8 ? 0 : 1);
      }
    }
    const separees = poules.filter(
      (p) => moitieDe.get(`${p.id}:1`) !== moitieDe.get(`${p.id}:2`),
    ).length;
    // 10 places en haut, 8 en bas : au mieux 8 poules séparées sur 9.
    expect(separees).toBe(8);
  });
});
