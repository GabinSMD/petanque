import { describe, expect, it } from 'vitest';
import { buildConsolanteFromSources, drawElimination, firstRoundSources } from '../bracket';
import { drawPoules } from '../poules';
import { parcoursEquipe, resultatsClub } from '../resultatsClub';
import { at, makeTeams, playBracketMatch, playPouleSlot, testCtx } from './helpers';
import type { Match, Team } from '../../types';

/** Huit équipes, deux par club ; l'équipe 8 est mixte (Romans + Crest). */
function equipes(): Team[] {
  const clubs = ['PC Romans', 'Crest', 'Boule Joyeuse', 'Pétanque du Port'];
  return makeTeams(8).map((t, i) => ({ ...t, club: clubs[i % 4] }));
}

describe('« Recherche Résultats Club » (§3.D.1.D)', () => {
  it('rend le parcours des équipes du club dans les concours A et B', () => {
    const ctx = testCtx();
    const teams = equipes();
    let matches: Match[] = drawElimination('c1', 'principal', teams, ctx, { protections: [] });
    matches = [
      ...matches,
      ...buildConsolanteFromSources('c1', firstRoundSources(matches, 'principal'), ctx),
    ];
    // Premier tour du A : le côté A gagne partout.
    for (let p = 0; p < 4; p++) {
      matches = playBracketMatch(matches, at(matches, 'principal', 0, p).id, 13, 5);
    }
    // Une demi-finale du A jouée, l'autre pas encore.
    matches = playBracketMatch(matches, at(matches, 'principal', 1, 0).id, 13, 9);

    const demi = at(matches, 'principal', 1, 0);
    const perdantDemi = demi.teamBId!;
    const gagnantDemi = demi.teamAId!;
    const enAttente = at(matches, 'principal', 1, 1).teamAId!;
    const perdantPremierTour = at(matches, 'principal', 0, 0).teamBId!;

    const byId = new Map(teams.map((t) => [t.id, t]));
    const p = (id: string) => parcoursEquipe(byId.get(id)!, [], matches);

    expect(p(perdantDemi)).toMatchObject({
      concours: 'A',
      etat: 'eliminee',
      libelle: 'Demi-finalistes',
      place: 3,
    });
    // L'autre demi-finale n'est pas jouée : la finale attend son adversaire.
    expect(p(gagnantDemi)).toMatchObject({
      concours: 'A',
      etat: 'en_jeu',
      libelle: 'Qualifiée pour : Finale',
    });
    expect(p(enAttente)).toMatchObject({ concours: 'A', etat: 'en_jeu', libelle: 'En jeu : Demi-finales' });
    // Battue au premier tour du A, elle est descendue dans le B : c'est là
    // qu'elle se trouve, plus dans le A.
    expect(p(perdantPremierTour)).toMatchObject({ concours: 'B', etat: 'en_jeu' });
  });

  it("qualifiée, mais l'adversaire n'est pas encore connu", () => {
    const ctx = testCtx();
    const teams = equipes().slice(0, 4);
    let matches = drawElimination('c1', 'principal', teams, ctx, { protections: [] });
    const premiere = at(matches, 'principal', 0, 0);
    matches = playBracketMatch(matches, premiere.id, 13, 4);
    const qualifiee = teams.find((t) => t.id === premiere.teamAId)!;
    expect(parcoursEquipe(qualifiee, [], matches)).toMatchObject({
      concours: 'A',
      etat: 'en_jeu',
      libelle: 'Qualifiée pour : Finale',
    });
  });

  it('dit le vainqueur, avec sa place', () => {
    const ctx = testCtx();
    const teams = equipes().slice(0, 2);
    let matches = drawElimination('c1', 'principal', teams, ctx, { protections: [] });
    const finale = at(matches, 'principal', 0, 0);
    matches = playBracketMatch(matches, finale.id, 13, 2);
    const vainqueur = teams.find((t) => t.id === finale.teamAId)!;
    expect(parcoursEquipe(vainqueur, [], matches)).toMatchObject({
      concours: 'A',
      etat: 'vainqueur',
      place: 1,
    });
  });

  it('suit les équipes encore en poule, qualifiées ou éliminées', () => {
    const ctx = testCtx();
    const teams = makeTeams(8).map((t) => ({ ...t, club: 'Crest' }));
    const draw = drawPoules('c1', teams, ctx)!;
    const poule = draw.poules[0]!;
    let matches = draw.matches;
    for (const slot of ['M1', 'M2', 'GAGNANTS', 'PERDANTS', 'BARRAGE']) {
      matches = playPouleSlot(poule, matches, slot, 13, 7);
    }
    const res = resultatsClub(teams, draw.poules, matches, 'crest');
    const libelles = res.equipes
      .filter((e) => poule.teamIds.includes(e.team.id))
      .map((e) => e.libelle)
      .sort();
    expect(libelles).toEqual([
      `Qualifiée 1re de la poule ${poule.index}`,
      `Qualifiée 2e de la poule ${poule.index}`,
      `Éliminée en poule ${poule.index}`,
      `Éliminée en poule ${poule.index}`,
    ]);
    const autre = draw.poules[1]!;
    const enCours = res.equipes.find((e) => e.team.id === autre.teamIds[0])!;
    expect(enCours).toMatchObject({ etat: 'en_jeu', libelle: `En poule ${autre.index}` });
  });

  it('cherche le club sans accents ni casse, et signale les équipes mixtes', () => {
    const teams = equipes();
    teams[7] = {
      ...teams[7]!,
      club: undefined,
      players: [
        { name: 'A', club: 'PC Romans' },
        { name: 'B', club: 'Crest' },
      ],
    };
    const res = resultatsClub(teams, [], [], 'ROMANS');
    expect(res.clubs).toEqual(['PC Romans']);
    expect(res.equipes.map((e) => [e.team.number, e.homogene])).toEqual([
      [1, true],
      [5, true],
      [8, false],
    ]);
    expect(res.equipes[0]).toMatchObject({ etat: 'non_tiree', libelle: 'Pas encore tirée' });

    expect(resultatsClub(teams, [], [], 'petanque').clubs).toEqual(['Pétanque du Port']);
  });

  it('ne cherche rien sur moins de deux lettres, et dit les forfaits', () => {
    const teams = equipes();
    expect(resultatsClub(teams, [], [], 'r').equipes).toEqual([]);
    teams[0] = { ...teams[0]!, forfait: true };
    expect(resultatsClub(teams, [], [], 'romans').equipes[0]).toMatchObject({
      etat: 'forfait',
      libelle: 'Forfait',
    });
  });
});
