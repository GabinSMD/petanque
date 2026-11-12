import { describe, expect, it } from 'vitest';
import { drawElimination } from '../bracket';
import { inverserResultat } from '../match';
import { drawPoules } from '../poules';
import { partiesEffaceesEnAval } from '../effacementsAval';
import type { Match } from '../../types';
import {
  at,
  bySlot,
  makeTeams,
  playBracketMatch,
  playPouleSlot,
  playStageRound,
  testCtx,
} from './helpers';

/**
 * Inverser, gommer ou corriger une partie dont la suite est déjà jouée efface
 * cette suite en silence : la revue de la table de marque a vu disparaître un
 * 13-0 des Gagnants après un seul toucher sur « Inverser ». Avant d'écrire,
 * l'écran demande au moteur ce qui serait perdu, sans rien modifier.
 */

/** Une poule de 4 dont la 1re partie, la 2e et la partie des gagnants sont jouées. */
function pouleJouee() {
  const draw = drawPoules('c1', makeTeams(4), testCtx())!;
  const poule = draw.poules[0]!;
  let matches = draw.matches;
  matches = playPouleSlot(poule, matches, 'M1', 13, 4);
  matches = playPouleSlot(poule, matches, 'M2', 13, 9);
  matches = playPouleSlot(poule, matches, 'GAGNANTS', 13, 0);
  return { poules: draw.poules, poule, matches };
}

describe('parties effacées en aval', () => {
  it("nomme la partie des gagnants qu'une inversion de la 1re partie effacerait", () => {
    const { poules, poule, matches } = pouleJouee();
    const m1 = bySlot(matches, poule.id, 'M1');
    const effacees = partiesEffaceesEnAval(matches, poules, inverserResultat(m1));
    expect(effacees.map((m) => m.pouleSlot)).toEqual(['GAGNANTS']);
    // La partie est rendue telle qu'elle est encore : son score se montre.
    expect(effacees[0]!.scoreA).toBe(13);
    expect(effacees[0]!.scoreB).toBe(0);
  });

  it("n'écrit rien : la liste d'entrée ressort intacte", () => {
    const { poules, poule, matches } = pouleJouee();
    const copie = structuredClone(matches);
    partiesEffaceesEnAval(matches, poules, inverserResultat(bySlot(matches, poule.id, 'M1')));
    expect(matches).toEqual(copie);
  });

  it('ne signale rien quand la correction garde le même gagnant', () => {
    const { poules, poule, matches } = pouleJouee();
    const m1 = bySlot(matches, poule.id, 'M1');
    expect(partiesEffaceesEnAval(matches, poules, { ...m1, scoreA: 13, scoreB: 11 })).toEqual([]);
  });

  it('ne signale rien quand rien en aval n’est joué', () => {
    const draw = drawPoules('c1', makeTeams(4), testCtx())!;
    const poule = draw.poules[0]!;
    const matches = playPouleSlot(poule, draw.matches, 'M1', 13, 4);
    const m1 = bySlot(matches, poule.id, 'M1');
    expect(partiesEffaceesEnAval(matches, draw.poules, inverserResultat(m1))).toEqual([]);
  });

  it('un effacement (gommer) emporte gagnants et perdants déjà joués', () => {
    const jouee = pouleJouee();
    const { poules, poule } = jouee;
    let matches = jouee.matches;
    matches = playPouleSlot(poule, matches, 'PERDANTS', 13, 6);
    const m2 = bySlot(matches, poule.id, 'M2');
    const efface: Match = { ...m2, scoreA: null, scoreB: null, done: false };
    const slots = partiesEffaceesEnAval(matches, poules, efface).map((m) => m.pouleSlot);
    expect(slots.sort()).toEqual(['GAGNANTS', 'PERDANTS']);
  });

  it('passe de la poule au tableau : le 1er de poule change, sa partie de tableau tombe', () => {
    const { poules, poule, matches } = pouleJouee();
    const gagnants = bySlot(matches, poule.id, 'GAGNANTS');
    const premier = gagnants.teamAId; // 13-0 : le camp A est 1er de poule
    const tableau: Match = {
      id: 'tab1',
      concoursId: 'c1',
      stage: 'principal',
      round: 0,
      position: 0,
      teamAId: premier,
      teamBId: 'autre',
      qualifFromA: `${poule.id}:1`,
      scoreA: 13,
      scoreB: 5,
      done: true,
      terrain: null,
      updatedAt: '',
    };
    const toutes = [...matches, tableau];
    const effacees = partiesEffaceesEnAval(toutes, poules, inverserResultat(gagnants));
    expect(effacees.map((m) => m.id)).toEqual(['tab1']);
  });

  it('suit la cascade dans un tableau : un tour, puis le suivant', () => {
    let all = drawElimination('c1', 'principal', makeTeams(8), testCtx());
    all = playStageRound(all, 'principal', 0);
    all = playStageRound(all, 'principal', 1);
    const premier = at(all, 'principal', 0, 0);
    const effacees = partiesEffaceesEnAval(all, [], inverserResultat(premier));
    // La demi-finale qu'avait jouée le vainqueur change d'équipe. La finale
    // n'est pas encore jouée : rien à perdre de ce côté.
    expect(effacees.map((m) => `${m.round}:${m.position}`)).toEqual(['1:0']);
  });

  it('va jusqu’à la finale quand elle est jouée', () => {
    let all = drawElimination('c1', 'principal', makeTeams(4), testCtx());
    all = playStageRound(all, 'principal', 0);
    const finale = at(all, 'principal', 1, 0);
    all = playBracketMatch(all, finale.id, 13, 2);
    const demi = at(all, 'principal', 0, 1);
    const effacees = partiesEffaceesEnAval(all, [], { ...demi, scoreA: 5, scoreB: 13 });
    expect(effacees.map((m) => m.id)).toEqual([finale.id]);
  });

  it('les rondes sont plates : rien ne se propage', () => {
    const ronde: Match = {
      id: 'r1',
      concoursId: 'c1',
      stage: 'ronde',
      round: 0,
      position: 0,
      teamAId: 't1',
      teamBId: 't2',
      scoreA: 13,
      scoreB: 2,
      done: true,
      terrain: null,
      updatedAt: '',
    };
    expect(partiesEffaceesEnAval([ronde], [], inverserResultat(ronde))).toEqual([]);
  });
});
