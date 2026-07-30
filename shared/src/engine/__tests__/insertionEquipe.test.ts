import { describe, expect, it } from 'vitest';
import { placeLibreApres, renumeroterPourInsertion } from '../insertionEquipe';
import type { Team } from '../../types';

const T = '2026-07-30T10:00:00.000Z';

const equipe = (number: number): Team => ({
  id: `t${number}`,
  concoursId: 'c1',
  number,
  players: [{ name: `JOUEUR ${number}` }],
  forfait: false,
  updatedAt: T,
});

const QUATRE = [equipe(1), equipe(2), equipe(3), equipe(4)];

describe('insérer une équipe avant une autre (§3.B.1, zone 24)', () => {
  it('décale les suivantes d\'un cran', () => {
    // Insérer au dossard 2 : l'ancienne 2 devient 3, la 3 devient 4, etc.
    expect(renumeroterPourInsertion(QUATRE, 2)).toEqual([
      { id: 't2', number: 3 },
      { id: 't3', number: 4 },
      { id: 't4', number: 5 },
    ]);
  });

  it('ne touche pas aux dossards précédents', () => {
    const changements = renumeroterPourInsertion(QUATRE, 3);
    expect(changements.map((c) => c.id)).toEqual(['t3', 't4']);
  });

  it('insérer à la suite ne renumérote personne', () => {
    // C'est l'ajout ordinaire : rien à décaler.
    expect(renumeroterPourInsertion(QUATRE, 5)).toEqual([]);
  });

  it('respecte une numérotation décalée (§3.A, zone 6)', () => {
    // Un championnat jeunes qui commence à 101 : insérer à 102 décale 102+.
    const decale = [equipe(101), equipe(102), equipe(103)];
    expect(renumeroterPourInsertion(decale, 102)).toEqual([
      { id: 't102', number: 103 },
      { id: 't103', number: 104 },
    ]);
  });

  it('refuse un dossard hors de la liste', () => {
    // Avant le premier ou plus d'un cran après le dernier : ce serait un trou,
    // et un trou dans les dossards se paie à l'appel au micro.
    expect(() => renumeroterPourInsertion(QUATRE, 0)).toThrow(/dossard/i);
    expect(() => renumeroterPourInsertion(QUATRE, 6)).toThrow(/dossard/i);
  });

  it('sur une liste vide, seul le premier dossard est acceptable', () => {
    expect(renumeroterPourInsertion([], 1)).toEqual([]);
    expect(() => renumeroterPourInsertion([], 7)).toThrow(/dossard/i);
  });

  it('dit le prochain dossard libre', () => {
    expect(placeLibreApres(QUATRE)).toBe(5);
    expect(placeLibreApres([equipe(101), equipe(102)])).toBe(103);
    expect(placeLibreApres([])).toBe(1);
  });

  it('tolère des dossards non contigus sans inventer de trou', () => {
    // Une suppression laisse un trou : insérer à 3 décale 3 et 5, pas 4.
    const troue = [equipe(1), equipe(3), equipe(5)];
    expect(renumeroterPourInsertion(troue, 3)).toEqual([
      { id: 't3', number: 4 },
      { id: 't5', number: 6 },
    ]);
  });
});
