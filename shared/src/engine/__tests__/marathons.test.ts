import { describe, expect, it } from 'vitest';
import { BYE_SCORE, buildChampionnat, drawSwissRonde } from '../rondes';
import { makeTeams, testCtx } from './helpers';
import type { Match } from '../../types';

/** Toutes les paires jouées, sous forme comparable. */
const paires = (matches: Match[]): string[] =>
  matches
    .filter((m) => m.teamAId && m.teamBId)
    .map((m) => [m.teamAId!, m.teamBId!].sort().join('|'));

/** Nombre de parties jouées par équipe. */
function comptesParEquipe(matches: Match[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of matches) {
    for (const id of [m.teamAId, m.teamBId]) {
      if (id) out.set(id, (out.get(id) ?? 0) + 1);
    }
  }
  return out;
}

describe('marathon par rotation circulaire — graphique (16)', () => {
  it('s\'arrête au nombre de rondes demandé', () => {
    // 8 équipes : le calendrier complet ferait 7 rondes, on en veut 3.
    const matches = buildChampionnat('c1', makeTeams(8), testCtx(), 3);
    expect(new Set(matches.map((m) => m.round)).size).toBe(3);
    expect(matches).toHaveLength(3 * 4);
  });

  it('chacun joue le même nombre de parties, sans jamais se répéter', () => {
    const matches = buildChampionnat('c1', makeTeams(8), testCtx(), 3);
    const comptes = [...comptesParEquipe(matches).values()];
    expect(comptes).toHaveLength(8);
    expect(new Set(comptes)).toEqual(new Set([3]));
    expect(new Set(paires(matches)).size).toBe(paires(matches).length);
  });

  it('sans limite, le calendrier complet est inchangé', () => {
    const complet = buildChampionnat('c1', makeTeams(6), testCtx());
    const limiteHaute = buildChampionnat('c1', makeTeams(6), testCtx(), 99);
    expect(complet).toHaveLength(limiteHaute.length);
    expect(new Set(complet.map((m) => m.round)).size).toBe(5);
  });

  it('effectif impair : une ronde de repos par tour, et personne deux fois', () => {
    // 7 équipes sur 3 rondes : 3 parties par ronde, une équipe au repos.
    const matches = buildChampionnat('c1', makeTeams(7), testCtx(), 3);
    expect(matches).toHaveLength(9);
    const comptes = comptesParEquipe(matches);
    expect([...comptes.values()].every((n) => n <= 3)).toBe(true);
    expect(new Set(paires(matches)).size).toBe(9);
  });

  it('refuse une limite absurde', () => {
    expect(() => buildChampionnat('c1', makeTeams(8), testCtx(), 0)).toThrow(/ronde/i);
  });
});

describe('marathon gagnant contre gagnant strict — graphique (17)', () => {
  /** Joue une ronde : le camp A gagne toujours. */
  const jouer = (matches: Match[]): Match[] =>
    matches.map((m) =>
      m.done ? m : { ...m, scoreA: 13, scoreB: 7, done: true },
    );

  it('n\'apparie que des équipes à égalité de victoires', () => {
    const teams = makeTeams(8);
    const r1 = jouer(drawSwissRonde('c1', teams, [], 0, testCtx(), { strict: true }));
    const r2 = drawSwissRonde('c1', teams, r1, 1, testCtx(), { strict: true });

    const victoires = new Map<string, number>();
    for (const m of r1) {
      if (m.teamAId) victoires.set(m.teamAId, 1);
      if (m.teamBId) victoires.set(m.teamBId, 0);
    }
    for (const m of r2) {
      if (!m.teamAId || !m.teamBId) continue;
      expect(victoires.get(m.teamAId)).toBe(victoires.get(m.teamBId));
    }
  });

  it('groupes impairs : des exempts apparaissent, crédités comme un forfait', () => {
    // 6 équipes : 3 gagnants et 3 perdants au 2e tour, donc un exempt de chaque
    // côté — c'est ce que le manuel annonce.
    const teams = makeTeams(6);
    const r1 = jouer(drawSwissRonde('c1', teams, [], 0, testCtx(), { strict: true }));
    const r2 = drawSwissRonde('c1', teams, r1, 1, testCtx(), { strict: true });
    const exempts = r2.filter((m) => m.byeB);
    expect(exempts).toHaveLength(2);
    for (const e of exempts) {
      expect(e.done).toBe(true);
      expect([e.scoreA, e.scoreB]).toEqual([BYE_SCORE[0], BYE_SCORE[1]]);
    }
    // Tout le monde est placé : 2 parties + 2 exempts = 6 équipes.
    expect(r2.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean)).toHaveLength(4 + 2);
  });

  it('évite les revanches à l\'intérieur d\'un groupe', () => {
    const teams = makeTeams(8);
    let matches: Match[] = [];
    for (let r = 0; r < 3; r += 1) {
      matches = [
        ...matches,
        ...jouer(drawSwissRonde('c1', teams, matches, r, testCtx(r + 1), { strict: true })),
      ];
    }
    const toutes = paires(matches);
    expect(new Set(toutes).size).toBe(toutes.length);
  });

  it('personne n\'est exempt deux fois avant que tout le monde l\'ait été', () => {
    // L'exempt encaisse un 13-7 gratuit : le laisser toujours au même camp
    // truquerait le marathon. Sur 6 équipes, chaque ronde produit 2 exempts.
    const teams = makeTeams(6);
    let matches: Match[] = [];
    for (let r = 0; r < 3; r += 1) {
      matches = [
        ...matches,
        ...jouer(drawSwissRonde('c1', teams, matches, r, testCtx(r + 1), { strict: true })),
      ];
    }
    const exempts = new Map(teams.map((t) => [t.id, 0]));
    for (const m of matches.filter((x) => x.byeB && x.teamAId)) {
      exempts.set(m.teamAId!, (exempts.get(m.teamAId!) ?? 0) + 1);
    }
    const comptes = [...exempts.values()];
    expect(Math.max(...comptes) - Math.min(...comptes)).toBeLessThanOrEqual(1);
  });

  it('sans l\'option, l\'appariement suisse ordinaire est inchangé', () => {
    // Le graphique (15) tolère qu'un gagnant rencontre un perdant.
    const teams = makeTeams(6);
    const r1 = jouer(drawSwissRonde('c1', teams, [], 0, testCtx()));
    const r2 = drawSwissRonde('c1', teams, r1, 1, testCtx());
    expect(r2.filter((m) => m.byeB)).toHaveLength(0);
    expect(r2).toHaveLength(3);
  });
});
