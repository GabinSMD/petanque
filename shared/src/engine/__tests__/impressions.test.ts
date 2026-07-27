import { describe, expect, it } from 'vitest';
import { drawElimination } from '../bracket';
import { presseSections, trierEquipes } from '../impressions';
import { makeTeam, makeTeams, playStageRound, testCtx } from './helpers';
import type { Match, Team } from '../../types';

function playAll(all: Match[], stage = 'principal'): Match[] {
  const rounds = Math.max(...all.filter((m) => m.stage === stage).map((m) => m.round));
  let out = all;
  for (let r = 0; r <= rounds; r++) out = playStageRound(out, stage, r);
  return out;
}

describe('résultats pour la presse', () => {
  it('groupe les parties jouées par tour, du premier à la finale', () => {
    const teams = makeTeams(8);
    const matches = playAll(drawElimination('c1', 'principal', teams, testCtx()));
    const sections = presseSections(teams, matches, 'principal');

    expect(sections.map((s) => s.label)).toEqual([
      'Quarts de finale',
      'Demi-finales',
      'Finale',
    ]);
    expect(sections.map((s) => s.matches.length)).toEqual([4, 2, 1]);
  });

  it('désigne le gagnant de chaque partie', () => {
    const teams = makeTeams(4);
    const matches = playAll(drawElimination('c1', 'principal', teams, testCtx()));
    const finale = presseSections(teams, matches, 'principal').at(-1)!.matches[0]!;
    expect(finale.gagnant).toBe('A'); // le côté A gagne 13-7 dans l'aide de test
    expect(finale.scoreA).toBe(13);
    expect(finale.scoreB).toBe(7);
    expect(finale.teamA).toBeTruthy();
    expect(finale.teamB).toBeTruthy();
  });

  it('ignore les parties non jouées et les exempts', () => {
    const teams = makeTeams(6); // 8 places → 2 exempts
    let matches = drawElimination('c1', 'principal', teams, testCtx());
    matches = playStageRound(matches, 'principal', 0);
    const sections = presseSections(teams, matches, 'principal');
    // Seules les 2 vraies parties du 1er tour sont sorties : pas d'exempt,
    // et les tours suivants ne sont pas encore joués.
    expect(sections).toHaveLength(1);
    expect(sections[0]!.matches).toHaveLength(2);
  });

  it('ne mélange pas les tableaux', () => {
    const teams = makeTeams(4);
    const matches = playAll(drawElimination('c1', 'principal', teams, testCtx()));
    expect(presseSections(teams, matches, 'consolante')).toEqual([]);
  });
});

describe('tri des listes imprimées', () => {
  const equipes: Team[] = [
    { ...makeTeam(3, 'Zèbre Club'), players: [{ name: 'Ötz Ariane' }] },
    { ...makeTeam(1, 'amicale des platanes'), players: [{ name: 'Émile Brun' }] },
    { ...makeTeam(2, 'Boule Joyeuse'), players: [{ name: 'Estelle Aubert' }] },
  ];

  it('par numéro de dossard', () => {
    expect(trierEquipes(equipes, 'numero').map((t) => t.number)).toEqual([1, 2, 3]);
  });

  it('par nom, en ignorant les accents et la casse', () => {
    expect(trierEquipes(equipes, 'nom').map((t) => t.players[0]!.name)).toEqual([
      'Émile Brun',
      'Estelle Aubert',
      'Ötz Ariane',
    ]);
  });

  it('par club, en ignorant la casse', () => {
    expect(trierEquipes(equipes, 'club').map((t) => t.club)).toEqual([
      'amicale des platanes',
      'Boule Joyeuse',
      'Zèbre Club',
    ]);
  });

  it('ne modifie pas le tableau d origine', () => {
    const avant = equipes.map((t) => t.number);
    trierEquipes(equipes, 'nom');
    expect(equipes.map((t) => t.number)).toEqual(avant);
  });
});
