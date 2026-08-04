import { describe, expect, it } from 'vitest';
import { autoAssignTerrains, classerTerrainsLibres } from '../terrains';
import type { Match } from '../../types';

/** Une partie prête, sans terrain : elle attend une affectation. */
function enAttente(id: string, a: string, b: string, position = 1): Match {
  return {
    id,
    concoursId: 'c1',
    stage: 'principal',
    round: 1,
    position,
    teamAId: a,
    teamBId: b,
    scoreA: null,
    scoreB: null,
    done: false,
    terrain: null,
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}

/** Une partie terminée, sur un terrain, entre deux équipes. */
function jouee(id: string, terrain: number, a: string, b: string): Match {
  return {
    id,
    concoursId: 'c1',
    stage: 'principal',
    round: 0,
    position: 1,
    teamAId: a,
    teamBId: b,
    scoreA: 13,
    scoreB: 7,
    done: true,
    terrain,
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}

describe('terrains déjà joués par l une des deux équipes', () => {
  it('sépare les terrains neufs de ceux qu une des deux équipes a déjà joués', () => {
    // L'équipe 5 a joué son premier tour sur le terrain 2.
    const histoire = [jouee('m1', 2, 't5', 't9')];
    const classe = classerTerrainsLibres([1, 2, 3], histoire, 't5', 't7');
    expect(classe.neufs).toEqual([1, 3]);
    expect(classe.dejaJoues).toEqual([2]);
  });

  it('ne retient que l historique de ces deux équipes, pas celui du concours', () => {
    // Le cas discriminant, trouvé par sabotage : sans le contrôle d'équipe, la
    // règle se dégrade en « ne jamais réutiliser un terrain que quiconque a
    // joué ». Après un tour, plus un seul terrain ne serait neuf et la règle
    // deviendrait un no-op silencieux.
    const histoire = [
      jouee('m1', 1, 't5', 't9'), // l'équipe 5 : terrain 1
      jouee('m2', 2, 't1', 't2'), // deux autres équipes : terrain 2
    ];
    const classe = classerTerrainsLibres([1, 2], histoire, 't5', 't7');
    expect(classe.neufs).toEqual([2]);
    expect(classe.dejaJoues).toEqual([1]);
  });
});

describe('affectation automatique et terrains déjà joués', () => {
  it('envoie la partie sur un terrain neuf plutôt que sur le plus petit libre', () => {
    // L'équipe 5 a gagné son 1er tour sur le terrain 1. Le terrain 1 est libre à
    // nouveau, mais le 2 aussi : c'est le 2 qu'elle doit avoir.
    const matches = [jouee('m1', 1, 't5', 't9'), enAttente('m2', 't5', 't7')];
    expect(autoAssignTerrains(matches, 2)).toEqual([{ matchId: 'm2', terrain: 2 }]);
  });

  it('se replie sur un terrain déjà joué plutôt que de laisser la partie attendre', () => {
    // Les deux terrains ont été joués par l'équipe 5 : il n'y a pas de choix
    // neuf, et faire attendre la partie serait pire.
    const matches = [
      jouee('m1', 1, 't5', 't9'),
      jouee('m2', 2, 't5', 't8'),
      enAttente('m3', 't5', 't7'),
    ];
    expect(autoAssignTerrains(matches, 2)).toEqual([{ matchId: 'm3', terrain: 1 }]);
  });

  it('le terrain déjà joué par l adversaire compte aussi', () => {
    // « utilisés par l'un des 2 » : c'est l'équipe 7, pas l'équipe 5, qui a joué
    // sur le terrain 1 — le terrain est écarté quand même.
    const matches = [jouee('m1', 1, 't7', 't9'), enAttente('m2', 't5', 't7')];
    expect(autoAssignTerrains(matches, 2)).toEqual([{ matchId: 'm2', terrain: 2 }]);
  });

  it('deux parties en attente ne reçoivent jamais le même terrain', () => {
    const matches = [
      jouee('m1', 1, 't5', 't9'),
      enAttente('m2', 't5', 't7', 1),
      enAttente('m3', 't1', 't2', 2),
    ];
    const terrains = autoAssignTerrains(matches, 2).map((a) => a.terrain);
    expect(new Set(terrains).size).toBe(terrains.length);
    // L'équipe 5 prend le 2, qui lui est neuf ; l'autre partie se replie sur le 1.
    expect(terrains).toEqual([2, 1]);
  });

  it('affecte autant de parties qu avant : le repli ne perd personne', () => {
    // Trois parties, trois terrains, et toutes les équipes ont déjà tout joué.
    const histoire = [1, 2, 3].flatMap((t) => [
      jouee(`h${t}a`, t, 't1', 't2'),
      jouee(`h${t}b`, t, 't3', 't4'),
      jouee(`h${t}c`, t, 't5', 't6'),
    ]);
    const matches = [
      ...histoire,
      enAttente('m1', 't1', 't2', 1),
      enAttente('m2', 't3', 't4', 2),
      enAttente('m3', 't5', 't6', 3),
    ];
    expect(autoAssignTerrains(matches, 3)).toEqual([
      { matchId: 'm1', terrain: 1 },
      { matchId: 'm2', terrain: 2 },
      { matchId: 'm3', terrain: 3 },
    ]);
  });

  it('un terrain neuf mais bloqué reste écarté', () => {
    // Le 2 est neuf pour l'équipe 5, mais il est bloqué : le repli sur le 1,
    // déjà joué, est la seule issue.
    const matches = [jouee('m1', 1, 't5', 't9'), enAttente('m2', 't5', 't7')];
    expect(autoAssignTerrains(matches, 2, 0, [2])).toEqual([{ matchId: 'm2', terrain: 1 }]);
  });

  it('suit le décalage de numérotation', () => {
    const matches = [jouee('m1', 51, 't5', 't9'), enAttente('m2', 't5', 't7')];
    expect(autoAssignTerrains(matches, 2, 50)).toEqual([{ matchId: 'm2', terrain: 52 }]);
  });

  it('sans historique, garde l ordre croissant d avant', () => {
    const matches = [enAttente('m1', 't1', 't2', 1), enAttente('m2', 't3', 't4', 2)];
    expect(autoAssignTerrains(matches, 4).map((a) => a.terrain)).toEqual([1, 2]);
  });

  it('en mêlée, sans équipes enregistrées, tous les terrains sont neufs', () => {
    // Les parties de mêlée portent des joueurs, pas des équipes : il n'y a pas
    // d'historique par équipe à consulter, et rien ne doit être écarté.
    const melee: Match = {
      ...enAttente('m1', '', ''),
      teamAId: null,
      teamBId: null,
      playersA: ['j1', 'j2'],
      playersB: ['j3', 'j4'],
    };
    const jouees: Match = { ...melee, id: 'm0', terrain: 1, done: true };
    expect(classerTerrainsLibres([1, 2], [jouees], null, null)).toEqual({
      neufs: [1, 2],
      dejaJoues: [],
    });
    expect(autoAssignTerrains([jouees, melee], 2)).toEqual([{ matchId: 'm1', terrain: 1 }]);
  });
});
