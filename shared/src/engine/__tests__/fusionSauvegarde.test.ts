import { describe, expect, it } from 'vitest';
import {
  cumulerFusions,
  fusionnerResultats,
  fusionTerminee,
  type FusionResultats,
} from '../fusionSauvegarde';
import { applyChanges, propagate } from '../bracket';
import { winnerOf } from '../match';
import { createPouleMatches, drawPoules, recomputePoule } from '../poules';
import { buildTableauVide, placerQualifie, qualifiesManquants } from '../progressif';
import { at, bySlot, makeTeams, playPouleSlot, testCtx } from './helpers';
import type { Match, Poule } from '../../types';

const TOT = '2026-07-28T09:00:00.000Z';
const TARD = '2026-07-28T10:00:00.000Z';

function partie(id: string, over: Partial<Match> = {}): Match {
  return {
    id,
    concoursId: 'c1',
    stage: 'poule',
    pouleId: 'p1',
    pouleSlot: 'M1',
    round: 0,
    position: 0,
    teamAId: 't1',
    teamBId: 't2',
    scoreA: null,
    scoreB: null,
    done: false,
    terrain: null,
    updatedAt: TOT,
    ...over,
  };
}

describe('fusion d une partie', () => {
  it('reprend une partie saisie seulement à distance', () => {
    const local = [partie('m1')];
    const distant = [partie('m1', { scoreA: 13, scoreB: 8, done: true, updatedAt: TOT })];
    const f = fusionnerResultats(local, distant);
    expect(f.reprises).toEqual(['m1']);
    expect(f.conflits).toHaveLength(0);
    expect(f.aEcrire).toHaveLength(1);
    expect(f.aEcrire[0]).toMatchObject({ id: 'm1', scoreA: 13, scoreB: 8, done: true });
  });

  it('garde une partie saisie seulement en local', () => {
    const local = [partie('m1', { scoreA: 13, scoreB: 2, done: true })];
    const distant = [partie('m1', { updatedAt: TARD })];
    const f = fusionnerResultats(local, distant);
    expect(f.aEcrire).toHaveLength(0);
    expect(f.reprises).toHaveLength(0);
    expect(f.conflits).toHaveLength(0);
  });

  it('ne compte rien quand les deux côtés ont saisi le même score', () => {
    const local = [partie('m1', { scoreA: 13, scoreB: 2, done: true })];
    const distant = [partie('m1', { scoreA: 13, scoreB: 2, done: true, updatedAt: TARD })];
    const f = fusionnerResultats(local, distant);
    expect(f.aEcrire).toHaveLength(0);
    expect(f.conflits).toHaveLength(0);
  });

  it('résout un conflit en faveur de la saisie la plus récente', () => {
    // Distant plus récent : il l'emporte, et le conflit est signalé.
    const local = [partie('m1', { scoreA: 13, scoreB: 2, done: true, updatedAt: TOT })];
    const distant = [partie('m1', { scoreA: 5, scoreB: 13, done: true, updatedAt: TARD })];
    const f = fusionnerResultats(local, distant);
    expect(f.conflits).toEqual([
      {
        matchId: 'm1',
        local: { scoreA: 13, scoreB: 2, vainqueur: undefined },
        distant: { scoreA: 5, scoreB: 13, vainqueur: undefined },
        retenu: 'distant',
      },
    ]);
    expect(f.aEcrire[0]).toMatchObject({ scoreA: 5, scoreB: 13 });
    expect(f.reprises).toHaveLength(0);

    // Local plus récent : il reste, mais le conflit est signalé quand même.
    const g = fusionnerResultats(
      [partie('m1', { scoreA: 13, scoreB: 2, done: true, updatedAt: TARD })],
      [partie('m1', { scoreA: 5, scoreB: 13, done: true, updatedAt: TOT })],
    );
    expect(g.conflits).toHaveLength(1);
    expect(g.conflits[0]!.retenu).toBe('local');
    expect(g.aEcrire).toHaveLength(0);
  });

  it('juge le conflit sur l heure de la saisie, pas sur une réécriture de propagation', () => {
    // Entre deux passes, la propagation a réécrit la partie sans toucher au
    // score : son updatedAt a rajeuni. La saisie locale reste la plus ancienne.
    const avant = [partie('m1', { scoreA: 13, scoreB: 2, done: true, updatedAt: TOT })];
    const apresPropagation = [{ ...avant[0]!, updatedAt: '2026-07-28T11:00:00.000Z' }];
    const distant = [partie('m1', { scoreA: 5, scoreB: 13, done: true, updatedAt: TARD })];
    const f = fusionnerResultats(apresPropagation, distant, avant);
    expect(f.conflits[0]!.retenu).toBe('distant');
  });

  it('reprend un vainqueur désigné sans score', () => {
    const f = fusionnerResultats(
      [partie('m1')],
      [partie('m1', { vainqueur: 'B', done: true })],
    );
    expect(f.aEcrire[0]).toMatchObject({ vainqueur: 'B', scoreA: null, scoreB: null, done: true });
  });

  it('écarte ce qui ne se rapproche pas d une partie locale', () => {
    const local = [partie('m1'), partie('m2', { teamAId: 't3', teamBId: 't4' })];
    const distant = [
      partie('m9', { scoreA: 13, scoreB: 0, done: true }),
      partie('m2', { teamAId: 't3', teamBId: 't1', scoreA: 13, scoreB: 0, done: true }),
      partie('m1', { scoreA: 'treize' as unknown as number, scoreB: 0, done: true }),
    ];
    const f = fusionnerResultats(local, distant);
    expect(f.aEcrire).toHaveLength(0);
    expect(f.ecartes).toEqual([
      { matchId: 'm9', raison: 'absente' },
      { matchId: 'm2', raison: 'equipes' },
      { matchId: 'm1', raison: 'illisible' },
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* Poules puis tableau : la fusion passe par la propagation habituelle  */
/* ------------------------------------------------------------------ */

/**
 * Ce que fait l'écran après chaque écriture : recalcul des poules, entrée des
 * qualifiés au tableau, propagation. Mêmes fonctions du moteur que
 * `recomputeAfter` et `placerQualifiesAction` côté client.
 */
function propager(poules: Poule[], matches: Match[]): Match[] {
  let out = matches;
  for (const p of poules) {
    out = applyChanges(out, recomputePoule(p, out.filter((m) => m.pouleId === p.id)));
  }
  for (const q of qualifiesManquants(poules, out)) out = placerQualifie(out, q, testCtx(7));
  return applyChanges(out, propagate(out));
}

/** Boucle de fusion telle que la mène le client : passe, écriture, propagation. */
function fusionComplete(
  poules: Poule[],
  local: Match[],
  distant: Match[],
): { matches: Match[]; bilan: FusionResultats } {
  const reference = local;
  let cur = local;
  const passes: FusionResultats[] = [];
  for (let i = 0; i < 20; i++) {
    const f = fusionnerResultats(cur, distant, reference);
    passes.push(f);
    if (fusionTerminee(f)) break;
    cur = propager(poules, applyChanges(cur, f.aEcrire));
  }
  return { matches: cur, bilan: cumulerFusions(passes) };
}

function jouerPoule(poule: Poule, matches: Match[]): Match[] {
  let out = matches;
  for (const slot of ['M1', 'M2', 'GAGNANTS', 'PERDANTS', 'BARRAGE']) {
    out = playPouleSlot(poule, out, slot, 13, 7);
  }
  return out;
}

describe('fusion de poules suivies d un tour de tableau', () => {
  function depart() {
    const ctx = testCtx();
    const draw = drawPoules('c1', makeTeams(8), ctx, { sansProtection: true })!;
    const matches = [...draw.matches, ...buildTableauVide('c1', draw.poules.length * 2, ctx)];
    return { poules: draw.poules, matches };
  }

  it('les poules jouées sur l autre poste font entrer leurs qualifiés au tableau', () => {
    const { poules, matches } = depart();
    const [p1, p2] = poules as [Poule, Poule];
    // Poste annexe : la poule 1. Poste principal : la poule 2.
    const distant = jouerPoule(p1, matches);
    const local = propager(poules, jouerPoule(p2, matches));
    const entreesAvant = local
      .filter((m) => m.stage === 'principal' && m.round === 0)
      .flatMap((m) => [m.teamAId, m.teamBId]);
    expect(entreesAvant.filter(Boolean)).toHaveLength(2);

    const { matches: fusion, bilan } = fusionComplete(poules, local, distant);

    // Les cinq parties de la poule 1 sont reprises, y compris celles dont les
    // équipes n'étaient connues ici qu'après propagation des premières.
    expect(bilan.reprises.sort()).toEqual(
      ['M1', 'M2', 'GAGNANTS', 'PERDANTS', 'BARRAGE'].map((s) => bySlot(distant, p1.id, s).id).sort(),
    );
    expect(bilan.conflits).toHaveLength(0);
    expect(bilan.ecartes).toHaveLength(0);

    // Les deux qualifiés de la poule 1 sont entrés au tableau.
    const q1 = winnerOf(bySlot(fusion, p1.id, 'GAGNANTS'));
    const q2 = winnerOf(bySlot(fusion, p1.id, 'BARRAGE'));
    const entrees = fusion
      .filter((m) => m.stage === 'principal' && m.round === 0)
      .flatMap((m) => [m.teamAId, m.teamBId]);
    expect(entrees).toContain(q1);
    expect(entrees).toContain(q2);
    expect(entrees.filter(Boolean)).toHaveLength(4);
  });

  it('un score de tableau fusionné fait avancer son vainqueur au tour suivant', () => {
    const { poules, matches } = depart();
    // État commun : les poules sont jouées et le tableau rempli sur les deux
    // postes (la sauvegarde a circulé une première fois).
    let commun = matches;
    for (const p of poules) commun = jouerPoule(p, commun);
    commun = propager(poules, commun);
    const r0 = at(commun, 'principal', 0, 0);
    expect(r0.teamAId).not.toBeNull();
    expect(r0.teamBId).not.toBeNull();

    // L'autre poste saisit la première partie du tableau.
    const distant = commun.map((m) =>
      m.id === r0.id ? { ...m, scoreA: 4, scoreB: 13, done: true, updatedAt: TARD } : m,
    );
    const { matches: fusion, bilan } = fusionComplete(poules, commun, distant);

    expect(bilan.reprises).toEqual([r0.id]);
    const finale = at(fusion, 'principal', 1, 0);
    expect([finale.teamAId, finale.teamBId]).toContain(r0.teamBId);
    expect([finale.teamAId, finale.teamBId]).not.toContain(r0.teamAId);
  });

  it('un conflit en poule gagné par l autre poste corrige l aval', () => {
    const { poules, matches } = depart();
    const p1 = poules[0]!;
    const m1 = bySlot(matches, p1.id, 'M1');
    // Ici, A gagne M1 ; là-bas, plus tard, B l'a gagnée.
    const local = propager(poules, playPouleSlot(p1, matches, 'M1', 13, 7).map((m) =>
      m.id === m1.id ? { ...m, updatedAt: TOT } : m));
    const distant = playPouleSlot(p1, matches, 'M1', 7, 13).map((m) =>
      m.id === m1.id ? { ...m, updatedAt: TARD } : m);

    const { matches: fusion, bilan } = fusionComplete(poules, local, distant);
    expect(bilan.conflits.map((c) => c.retenu)).toEqual(['distant']);
    // La partie des gagnants a suivi la correction, comme après une ressaisie.
    expect(bySlot(fusion, p1.id, 'GAGNANTS').teamAId).toBe(m1.teamBId);
  });

  it('ne recopie pas les parties de poule créées seulement ailleurs', () => {
    const ctx = testCtx();
    const poule: Poule = { id: 'px', concoursId: 'c1', index: 9, teamIds: ['t1', 't2', 't3', 't4'], terrain: null, updatedAt: TOT };
    const ailleurs = createPouleMatches('c1', poule, ctx).map((m) => ({ ...m, scoreA: 13, scoreB: 1, done: true }));
    const f = fusionnerResultats([], ailleurs);
    expect(f.aEcrire).toHaveLength(0);
    expect(f.ecartes.every((e) => e.raison === 'absente')).toBe(true);
  });
});
