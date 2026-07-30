import { describe, expect, it } from 'vitest';
import { csvInscrits } from '../inscritsExport';
import { lireInscritsCsv } from '../inscritsImport';
import type { Team } from '../../types';

const T = '2026-07-30T10:00:00.000Z';

const equipe = (
  number: number,
  joueurs: [string, string?][],
  extra: Partial<Team> = {},
): Team => ({
  id: `t${number}`,
  concoursId: 'c1',
  number,
  players: joueurs.map(([name, licence]) => ({ name, licence })),
  forfait: false,
  updatedAt: T,
  ...extra,
});

describe('export d\'une liste d\'inscrits (§3.B.10.A)', () => {
  it('porte l\'en-tête que notre import reconnaît', () => {
    const csv = csvInscrits([equipe(1, [['DUPOND Jean', '02600100']])]);
    expect(csv.split('\r\n')[0]).toBe('N°;Joueurs;Licences;Club;Forfait;Réglé');
  });

  it('se relit tel quel : c\'est tout l\'intérêt du fichier', () => {
    // Le manuel en fait la sortie normale d'un qualificatif : on l'exporte pour
    // créer le concours suivant. Un export qu'on ne peut pas réimporter ne sert
    // à rien.
    const teams = [
      equipe(1, [['DUPOND Jean', '02600100'], ['MARTIN Lina', '02600101']], {
        club: 'Boule de l\'Avenir',
        paid: true,
      }),
      equipe(2, [['BLANC Odette'], ['NOIR Paul']], { forfait: true }),
      equipe(3, [['SEUL Gérard', '02600103']], { club: 'Crest' }),
    ];
    const relu = lireInscritsCsv(csvInscrits(teams));
    expect(relu.ok).toBe(true);
    if (!relu.ok) return;
    expect(relu.equipes).toHaveLength(3);
    expect(relu.equipes[0]).toMatchObject({ number: 1, paid: true, forfait: false });
    // Le lecteur rend le club au niveau de l'équipe : le fichier n'a qu'une
    // colonne Club, et c'est l'insertion qui le recopie sur les joueurs.
    expect(relu.equipes[0]!.club).toBe('Boule de l\'Avenir');
    expect(relu.equipes[0]!.players).toEqual([
      { name: 'DUPOND Jean', licence: '02600100' },
      { name: 'MARTIN Lina', licence: '02600101' },
    ]);
    expect(relu.equipes[1]!.forfait).toBe(true);
    expect(relu.equipes[2]!.players).toEqual([{ name: 'SEUL Gérard', licence: '02600103' }]);
  });

  it('une licence manquante au milieu ne décale pas les suivantes', () => {
    // Le piège déjà rencontré à l'import : la place vide doit être écrite, pas
    // omise, sinon le troisième joueur récupère la licence du second.
    const teams = [equipe(9, [['DUPOND Jean', '02600100'], ['SANS Licence'], ['MARTIN Lina', '02600101']])];
    const relu = lireInscritsCsv(csvInscrits(teams));
    expect(relu.ok).toBe(true);
    if (!relu.ok) return;
    expect(relu.equipes[0]!.players.map((p) => [p.name, p.licence])).toEqual([
      ['DUPOND Jean', '02600100'],
      ['SANS Licence', undefined],
      ['MARTIN Lina', '02600101'],
    ]);
  });

  it('échappe ce qui casserait le tableur', () => {
    // Un nom de club avec un point-virgule ne doit pas créer une colonne.
    const teams = [equipe(1, [['DUPOND Jean']], { club: 'Boule; et Cie' })];
    const csv = csvInscrits(teams);
    expect(csv).toContain('"Boule; et Cie"');
    const relu = lireInscritsCsv(csv);
    expect(relu.ok).toBe(true);
    if (relu.ok) expect(relu.equipes[0]!.club).toBe('Boule; et Cie');
  });

  it('range par dossard', () => {
    const csv = csvInscrits([equipe(12, [['B']]), equipe(3, [['A']])]);
    const lignes = csv.split('\r\n');
    expect(lignes[1]!.startsWith('3;')).toBe(true);
    expect(lignes[2]!.startsWith('12;')).toBe(true);
  });

  it('sur une liste vide, ne rend que l\'en-tête', () => {
    expect(csvInscrits([]).split('\r\n')).toHaveLength(1);
  });
});
