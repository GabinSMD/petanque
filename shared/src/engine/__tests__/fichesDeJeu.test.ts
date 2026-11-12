import { describe, expect, it } from 'vitest';
import { drawElimination } from '../bracket';
import { fichesDeJeu, lireSelection } from '../fichesDeJeu';
import { drawPoules } from '../poules';
import { makeTeams, playBracketMatch, playPouleSlot, testCtx } from './helpers';
import type { Match, Team } from '../../types';

/**
 * Fiches de jeu (manuel §3.D.1.B.4.2, planche p.51) : une fiche par équipe,
 * triée par équipe ou par poule, avec la poule, les terrains connus et une
 * ligne par tour pour noter les scores à la main.
 */
const concoursPoules = { name: 'Doublette du 14', mode: 'poules' as const };
const concoursED = { name: 'Coupe du club', mode: 'elimination_directe' as const };

function tirage(n: number) {
  const teams = makeTeams(n);
  const draw = drawPoules('c1', teams, testCtx());
  if (!draw) throw new Error('tirage impossible');
  return { teams, ...draw };
}

describe('lireSelection', () => {
  it('lit le format de l’écran fédéral « 1-10;15;25 »', () => {
    expect([...lireSelection('1-3;15;25')!]).toEqual([1, 2, 3, 15, 25]);
  });

  it('accepte « 1 à 8 », les virgules et les bornes inversées', () => {
    expect([...lireSelection('1 à 3, 7')!]).toEqual([1, 2, 3, 7]);
    expect([...lireSelection('5-3')!]).toEqual([3, 4, 5]);
  });

  it('vide ou illisible : null, c’est-à-dire toutes les fiches', () => {
    expect(lireSelection('')).toBeNull();
    expect(lireSelection('  ')).toBeNull();
    expect(lireSelection('abc')).toBeNull();
  });
});

describe('fichesDeJeu — concours en poules', () => {
  it('une fiche par équipe, avec le nom du concours, le dossard et les joueurs', () => {
    const { teams, poules, matches } = tirage(8);
    const fiches = fichesDeJeu(concoursPoules, teams, poules, matches, { tri: 'equipe' });
    expect(fiches).toHaveLength(8);
    expect(fiches.map((f) => f.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(fiches[0]!.concours).toBe('Doublette du 14');
    expect(fiches[0]!.joueurs).toEqual(['Joueur 1']);
  });

  it('porte la poule et les trois adversaires de poule', () => {
    const { teams, poules, matches } = tirage(8);
    const fiches = fichesDeJeu(concoursPoules, teams, poules, matches, { tri: 'equipe' });
    for (const f of fiches) {
      const poule = poules.find((p) => p.teamIds.includes(f.teamId))!;
      expect(f.poule?.index).toBe(poule.index);
      expect(f.poule?.adversaires).toHaveLength(3);
      expect(f.poule?.adversaires.map((a) => a.numero)).not.toContain(f.numero);
    }
  });

  it('trois lignes de poule, puis les tours du tableau jusqu’à la finale', () => {
    const { teams, poules, matches } = tirage(8);
    const [f] = fichesDeJeu(concoursPoules, teams, poules, matches, { tri: 'equipe' });
    // 2 poules → 4 qualifiés : demi-finales et finale.
    expect(f!.lignes.map((l) => l.libelle)).toEqual([
      '1ère partie',
      '2e partie',
      '3e partie',
      'Demi-finales',
      'Finale',
    ]);
  });

  it('la première partie connaît son adversaire et son terrain, les scores sont vides', () => {
    const { teams, poules, matches } = tirage(8);
    const poule = poules[0]!;
    const avecTerrain = matches.map((m) =>
      m.pouleId === poule.id && m.pouleSlot === 'M1' ? { ...m, terrain: 13 } : m,
    );
    const [a, b] = poule.teamIds;
    const fiches = fichesDeJeu(concoursPoules, teams, poules, avecTerrain, { tri: 'equipe' });
    const fa = fiches.find((f) => f.teamId === a)!;
    const numeroB = teams.find((t) => t.id === b)!.number;
    expect(fa.lignes[0]).toMatchObject({ terrain: 13, adversaire: numeroB, pour: null, contre: null });
    // Deuxième partie : adversaire inconnu tant que la première n'est pas jouée.
    expect(fa.lignes[1]).toMatchObject({ adversaire: null, terrain: null });
  });

  it('reporte les scores déjà joués et l’adversaire de la partie suivante', () => {
    const { teams, poules, matches } = tirage(8);
    const poule = poules[0]!;
    let ms = playPouleSlot(poule, matches, 'M1', 13, 5);
    ms = playPouleSlot(poule, ms, 'M2', 13, 9);
    const [a, , c] = poule.teamIds;
    const fa = fichesDeJeu(concoursPoules, teams, poules, ms, { tri: 'equipe' }).find(
      (f) => f.teamId === a,
    )!;
    expect(fa.lignes[0]).toMatchObject({ pour: 13, contre: 5 });
    // Gagnants : les deux vainqueurs se retrouvent.
    expect(fa.lignes[1]!.adversaire).toBe(teams.find((t) => t.id === c)!.number);
    expect(fa.lignes[1]!.pour).toBeNull();
  });

  it('tri par poule : les fiches d’une poule se suivent, dans l’ordre du tirage', () => {
    const { teams, poules, matches } = tirage(8);
    const fiches = fichesDeJeu(concoursPoules, teams, poules, matches, { tri: 'poule' });
    const attendu = [...poules]
      .sort((x, y) => x.index - y.index)
      .flatMap((p) => p.teamIds.map((id) => teams.find((t) => t.id === id)!.number));
    expect(fiches.map((f) => f.numero)).toEqual(attendu);
  });

  it('la sélection vise les dossards en tri par équipe, les poules en tri par poule', () => {
    const { teams, poules, matches } = tirage(12);
    const parEquipe = fichesDeJeu(concoursPoules, teams, poules, matches, {
      tri: 'equipe',
      selection: '2-4;9',
    });
    expect(parEquipe.map((f) => f.numero)).toEqual([2, 3, 4, 9]);
    const parPoule = fichesDeJeu(concoursPoules, teams, poules, matches, {
      tri: 'poule',
      selection: '2',
    });
    expect(parPoule).toHaveLength(4);
    expect(parPoule.every((f) => f.poule?.index === 2)).toBe(true);
  });

  it('écarte les équipes forfait', () => {
    const { teams, poules, matches } = tirage(8);
    const avecForfait: Team[] = teams.map((t) => (t.number === 3 ? { ...t, forfait: true } : t));
    const fiches = fichesDeJeu(concoursPoules, avecForfait, poules, matches, { tri: 'equipe' });
    expect(fiches.map((f) => f.numero)).not.toContain(3);
  });

  it('poule de trois : le barrage reste la 3e ligne possible', () => {
    const { teams, poules, matches } = tirage(7); // une poule de 4, une de 3
    const p3 = poules.find((p) => p.teamIds.length === 3)!;
    const troisieme = p3.teamIds[2]!;
    const f = fichesDeJeu(concoursPoules, teams, poules, matches, { tri: 'equipe' }).find(
      (x) => x.teamId === troisieme,
    )!;
    expect(f.poule?.adversaires).toHaveLength(2);
    // Exempte de 1ère partie, elle attend le vainqueur : adversaire encore inconnu.
    expect(f.lignes[0]).toMatchObject({ libelle: '1ère partie', adversaire: null });
    expect(f.lignes.slice(0, 3).map((l) => l.libelle)).toEqual([
      '1ère partie',
      '2e partie',
      '3e partie',
    ]);
  });
});

describe('fichesDeJeu — élimination directe', () => {
  it('sans poule, des lignes « Cadrage » puis les tours quand l’effectif l’impose', () => {
    const teams = makeTeams(6);
    const [f] = fichesDeJeu(concoursED, teams, [], [], { tri: 'equipe' });
    expect(f!.poule).toBeNull();
    expect(f!.lignes.map((l) => l.libelle)).toEqual(['Cadrage', 'Demi-finales', 'Finale']);
  });

  it('suit le tableau tiré : adversaire, exempt et score joué', () => {
    const teams = makeTeams(8);
    let matches: Match[] = drawElimination('c1', 'principal', teams, testCtx());
    const premier = matches.find((m) => m.round === 0)!;
    matches = playBracketMatch(matches, premier.id, 13, 11);
    const fiches = fichesDeJeu(concoursED, teams, [], matches, { tri: 'equipe' });
    const fa = fiches.find((f) => f.teamId === premier.teamAId)!;
    const numeroB = teams.find((t) => t.id === premier.teamBId)!.number;
    expect(fa.lignes.map((l) => l.libelle)).toEqual(['Quarts de finale', 'Demi-finales', 'Finale']);
    expect(fa.lignes[0]).toMatchObject({ adversaire: numeroB, pour: 13, contre: 11 });
    const fb = fiches.find((f) => f.teamId === premier.teamBId)!;
    expect(fb.lignes[0]).toMatchObject({ adversaire: fa.numero, pour: 11, contre: 13 });
  });
});

describe('fichesDeJeu — rondes', () => {
  it('une ligne par ronde prévue', () => {
    const teams = makeTeams(4);
    const [f] = fichesDeJeu(
      { name: 'Mêlée', mode: 'suisse', nbRondes: 4 },
      teams,
      [],
      [],
      { tri: 'equipe' },
    );
    expect(f!.lignes.map((l) => l.libelle)).toEqual(['Ronde 1', 'Ronde 2', 'Ronde 3', 'Ronde 4']);
  });
});
