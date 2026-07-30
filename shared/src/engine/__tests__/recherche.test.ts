import { describe, expect, it } from 'vitest';
import { chercherEquipes } from '../recherche';
import type { Team } from '../../types';

const T = '2026-07-30T10:00:00.000Z';

const equipe = (number: number, joueurs: [string, string?][], club?: string): Team => ({
  id: `t${number}`,
  concoursId: 'c1',
  number,
  players: joueurs.map(([name, licence]) => ({ name, licence })),
  club,
  forfait: false,
  updatedAt: T,
});

const TEAMS: Team[] = [
  equipe(1, [['DUPOND Jean', '02600100'], ['MARTIN Lina', '02600101']], 'Boule de l\'Avenir'),
  equipe(2, [['BLANC Odette'], ['NOIR Paul']], 'PC Romans'),
  equipe(3, [['DUPONT Gérard', '02600103']], 'Crest'),
  equipe(12, [['MARTINEZ Hugo'], ['PETIT Léa']], 'Crest'),
];

describe('retrouver une équipe (§3.D.1.D, la loupe)', () => {
  it('par nom de joueur, sans se soucier des accents ni de la casse', () => {
    // « je suis dans quelle poule ? » — on tape ce qu'on entend.
    expect(chercherEquipes(TEAMS, 'gerard').map((r) => r.team.number)).toEqual([3]);
    expect(chercherEquipes(TEAMS, 'GÉRARD').map((r) => r.team.number)).toEqual([3]);
    expect(chercherEquipes(TEAMS, 'lea').map((r) => r.team.number)).toEqual([12]);
  });

  it('sur un début de nom, comme au micro', () => {
    // « DUP » doit rendre DUPOND et DUPONT : c'est à l'organisateur de trancher.
    expect(chercherEquipes(TEAMS, 'dup').map((r) => r.team.number)).toEqual([1, 3]);
  });

  it('dit quel joueur a fait mouche', () => {
    const [trouvaille] = chercherEquipes(TEAMS, 'martinez');
    expect(trouvaille!.motif).toBe('joueur');
    expect(trouvaille!.joueur).toBe('MARTINEZ Hugo');
  });

  it('par dossard, et exactement', () => {
    // Taper « 1 » ne doit pas rendre l'équipe 12 : au micro on appelle un
    // numéro précis.
    expect(chercherEquipes(TEAMS, '1').map((r) => r.team.number)).toEqual([1]);
    expect(chercherEquipes(TEAMS, '12').map((r) => r.team.number)).toEqual([12]);
    expect(chercherEquipes(TEAMS, '99')).toEqual([]);
  });

  it('par numéro de licence', () => {
    const [trouvaille] = chercherEquipes(TEAMS, '02600101');
    expect(trouvaille!.team.number).toBe(1);
    expect(trouvaille!.motif).toBe('licence');
    // Un début de licence suffit, dès qu'il est assez long pour être une
    // intention.
    expect(chercherEquipes(TEAMS, '026001').map((r) => r.team.number)).toEqual([1, 3]);
  });

  it('un chiffre isolé ne fouille pas les licences', () => {
    // « 1 » cherche le dossard 1, pas les licences qui contiennent un 1 :
    // sinon la moitié du concours ressortirait.
    expect(chercherEquipes(TEAMS, '1').map((r) => r.team.number)).toEqual([1]);
    expect(chercherEquipes(TEAMS, '3').map((r) => r.team.number)).toEqual([3]);
  });

  it('par club', () => {
    expect(chercherEquipes(TEAMS, 'crest').map((r) => r.team.number)).toEqual([3, 12]);
    expect(chercherEquipes(TEAMS, 'crest')[0]!.motif).toBe('club');
  });

  it('ne rend chaque équipe qu\'une fois, sur le motif le plus parlant', () => {
    // « Crest » est le club de l'équipe 3, dont un joueur ne s'appelle pas
    // Crest : un seul résultat, motif « club ».
    const resultats = chercherEquipes(TEAMS, 'crest');
    expect(resultats).toHaveLength(2);
    // Un nom de joueur prime sur le club quand les deux collent.
    const teams = [equipe(5, [['CREST Marc']], 'Crest')];
    expect(chercherEquipes(teams, 'crest')[0]!.motif).toBe('joueur');
  });

  it('range par dossard', () => {
    expect(chercherEquipes(TEAMS, 'a').map((r) => r.team.number)).toEqual([1, 2, 3, 12]);
  });

  it('ne cherche rien sur une requête vide', () => {
    expect(chercherEquipes(TEAMS, '')).toEqual([]);
    expect(chercherEquipes(TEAMS, '   ')).toEqual([]);
  });

  it('ne trouve rien plutôt que tout', () => {
    expect(chercherEquipes(TEAMS, 'zzz')).toEqual([]);
  });
});
