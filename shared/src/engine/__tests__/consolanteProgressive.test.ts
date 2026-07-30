import { describe, expect, it } from 'vitest';
import { createPouleMatches, drawPoules, recomputePoule } from '../poules';
import { applyChanges, propagate } from '../bracket';
import { buildTableauVide, eliminesManquants, placerQualifie } from '../progressif';
import { makeTeams, testCtx } from './helpers';
import type { Match, Poule } from '../../types';

/** Tire des poules et joue les créneaux demandés (le camp A gagne). */
function jouer(nbEquipes: number, slots: string[]): { poules: Poule[]; matches: Match[] } {
  const ctx = testCtx();
  const tirage = drawPoules('c1', makeTeams(nbEquipes), ctx);
  if (!tirage) throw new Error('effectif incompatible');
  const { poules } = tirage;
  let matches: Match[] = poules.flatMap((p) => createPouleMatches('c1', p, ctx));
  for (const slot of slots) {
    for (const poule of poules) {
      const m = matches.find((x) => x.pouleId === poule.id && x.pouleSlot === slot);
      if (!m || !m.teamAId || !m.teamBId) continue;
      matches = matches.map((x) => (x.id === m.id ? { ...x, scoreA: 13, scoreB: 6, done: true } : x));
      matches = applyChanges(
        matches,
        recomputePoule(poule, matches.filter((x) => x.pouleId === poule.id)),
      );
    }
  }
  return { poules, matches };
}

describe('les éliminés entrent en consolante au fil des poules (§3.D.3)', () => {
  it('personne n\'est éliminé avant que les parties le disent', () => {
    // Après la seule première partie, aucune équipe n'est encore sortie.
    const { poules, matches } = jouer(8, ['M1']);
    expect(eliminesManquants(poules, matches)).toEqual([]);
  });

  it('le perdant de la partie des perdants sort dès qu\'elle est jouée', () => {
    // Il est éliminé sans attendre le barrage : c'est le 4e de poule.
    const { poules, matches } = jouer(8, ['M1', 'M2', 'PERDANTS']);
    const sortis = eliminesManquants(poules, matches);
    expect(sortis).toHaveLength(2); // un par poule de 4
    expect(sortis.every((e) => e.ref.endsWith(':3'))).toBe(true);
  });

  it('le perdant du barrage sort ensuite, séparément', () => {
    const { poules, matches } = jouer(8, ['M1', 'M2', 'GAGNANTS', 'PERDANTS', 'BARRAGE']);
    const sortis = eliminesManquants(poules, matches);
    expect(sortis).toHaveLength(4); // 2 par poule de 4
    expect(sortis.filter((e) => e.ref.endsWith(':4'))).toHaveLength(2);
  });

  it('une poule de 3 ne sort qu\'une équipe', () => {
    // 7 équipes : une poule de 4 et une de 3. La poule de 3 n'a pas de partie
    // des perdants, donc pas de 4e.
    const { poules, matches } = jouer(7, ['M1', 'M2', 'GAGNANTS', 'PERDANTS', 'BARRAGE']);
    const parPoule = new Map<string, number>();
    for (const e of eliminesManquants(poules, matches)) {
      parPoule.set(e.pouleId, (parPoule.get(e.pouleId) ?? 0) + 1);
    }
    const comptes = [...parPoule.values()].sort();
    expect(comptes).toEqual([1, 2]);
  });

  it('ne rend pas deux fois un éliminé déjà placé', () => {
    const { poules, matches } = jouer(8, ['M1', 'M2', 'PERDANTS']);
    const conso = buildTableauVide('c1', 4, testCtx(), 'consolante');
    let tout = [...matches, ...conso];
    for (const e of eliminesManquants(poules, tout)) {
      tout = placerQualifie(tout, e, testCtx(), 'consolante');
    }
    expect(eliminesManquants(poules, tout)).toEqual([]);
  });

  it('la place retenue suit une correction de poule', () => {
    // La case mémorise d'où vient l'équipe, pas laquelle : corriger la partie
    // des perdants change l'équipe en consolante sans intervention.
    const { poules, matches } = jouer(8, ['M1', 'M2', 'PERDANTS']);
    const conso = buildTableauVide('c1', 4, testCtx(), 'consolante');
    let tout = [...matches, ...conso];
    for (const e of eliminesManquants(poules, tout)) {
      tout = placerQualifie(tout, e, testCtx(), 'consolante');
    }
    tout = applyChanges(tout, propagate(tout));
    const placeAvant = tout.find((m) => m.stage === 'consolante' && m.teamAId)!;
    const equipeAvant = placeAvant.teamAId;

    // On inverse le résultat de la partie des perdants de la première poule.
    const perdants = tout.find(
      (m) => m.pouleId === poules[0]!.id && m.pouleSlot === 'PERDANTS',
    )!;
    tout = tout.map((m) => (m.id === perdants.id ? { ...m, scoreA: 6, scoreB: 13 } : m));
    tout = applyChanges(
      tout,
      recomputePoule(poules[0]!, tout.filter((x) => x.pouleId === poules[0]!.id)),
    );
    tout = applyChanges(tout, propagate(tout));

    const equipesEnConso = tout
      .filter((m) => m.stage === 'consolante')
      .flatMap((m) => [m.teamAId, m.teamBId])
      .filter(Boolean);
    // L'équipe qui gagne maintenant n'est plus en consolante ; l'autre y est.
    expect(equipesEnConso).toContain(perdants.teamAId);
    expect(equipesEnConso).not.toContain(equipeAvant === perdants.teamBId ? perdants.teamBId : null);
  });

  it('le tableau vide se construit aussi pour la consolante', () => {
    const conso = buildTableauVide('c1', 4, testCtx(), 'consolante');
    expect(conso.every((m) => m.stage === 'consolante')).toBe(true);
    expect(conso.filter((m) => m.round === 0)).toHaveLength(2);
  });
});
