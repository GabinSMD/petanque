import { describe, expect, it } from 'vitest';
import { comptesClassification } from '../bilanArbitrage';
import { bilanAvantTirage } from '../bilanTirage';
import type { Classification, Licencie, Player } from '../../types';

function fiche(licence: string, classification?: Classification): Licencie {
  return {
    id: `l${licence}`,
    name: `Joueur ${licence}`,
    licence,
    classification,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

const joueur = (licence?: string): Player => ({ name: `J${licence ?? '?'}`, licence });

describe('comptes par classification', () => {
  it('compte par lettre fédérale, et rien d autre', () => {
    // Le rapport de la p.28 : « Nombre de Joueurs Elites : 7 / Honneurs : 12 /
    // Promotions : 19 ». Effectifs asymétriques, pour que confondre deux
    // classifications se voie.
    const fiches = new Map([
      ['1', fiche('1', 'E')],
      ['2', fiche('2', 'E')],
      ['3', fiche('3', 'E')],
      ['4', fiche('4', 'H')],
      ['5', fiche('5', 'H')],
      ['6', fiche('6', 'P')],
    ]);
    const players = ['1', '2', '3', '4', '5', '6'].map(joueur);
    expect(comptesClassification(players, fiches)).toEqual({ elite: 3, honneur: 2, promotion: 1 });
  });

  it('un joueur sans fiche ou sans classification ne compte nulle part', () => {
    const fiches = new Map([
      ['1', fiche('1', 'E')],
      ['2', fiche('2')], // fiche présente, classification absente
    ]);
    const players = [joueur('1'), joueur('2'), joueur('99'), joueur(undefined)];
    expect(comptesClassification(players, fiches)).toEqual({ elite: 1, honneur: 0, promotion: 0 });
  });

  it('sans joueur, tout est à zéro', () => {
    expect(comptesClassification([], new Map())).toEqual({ elite: 0, honneur: 0, promotion: 0 });
  });
});

describe('bilan avant tirage : les comptes par classification', () => {
  const conforme = {
    conforme: true,
    joueurs: [],
    anomaliesEquipe: [],
  } as unknown as Parameters<typeof bilanAvantTirage>[0][number]['controle'];

  it('porte les comptes quand on les lui donne', () => {
    const bilan = bilanAvantTirage([{ number: 1, controle: conforme }], undefined, {
      elite: 7,
      honneur: 12,
      promotion: 19,
    });
    expect(bilan.classification).toEqual({ elite: 7, honneur: 12, promotion: 19 });
  });

  it('ne les porte pas quand il n y a pas de fichier des licenciés', () => {
    // L'absence dit « on ne peut pas classer », trois zéros diraient « personne
    // n'est classé ». Ce ne sont pas les mêmes renseignements, et l'écran doit
    // pouvoir les distinguer.
    const bilan = bilanAvantTirage([{ number: 1, controle: conforme }]);
    expect(bilan.classification).toBeUndefined();
  });
});
