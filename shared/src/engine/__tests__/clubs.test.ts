import { describe, expect, it } from 'vitest';
import { clubsEquipe, estHomogene, libelleClubs } from '../clubs';
import type { Player } from '../../types';

const j = (name: string, club?: string): Player => ({ name, club });

describe('clubs d une équipe', () => {
  it('liste les clubs distincts, dans l ordre des joueurs', () => {
    expect(clubsEquipe([j('A', 'Boule Joyeuse'), j('B', 'Pétanque du Port')])).toEqual([
      'Boule Joyeuse',
      'Pétanque du Port',
    ]);
  });

  it('ne répète pas un club partagé', () => {
    expect(clubsEquipe([j('A', 'Boule Joyeuse'), j('B', 'Boule Joyeuse')])).toEqual([
      'Boule Joyeuse',
    ]);
  });

  it('ignore la casse et les espaces pour dédoublonner', () => {
    expect(clubsEquipe([j('A', 'Boule Joyeuse'), j('B', ' boule joyeuse ')])).toHaveLength(1);
  });

  it('ignore les joueurs sans club', () => {
    expect(clubsEquipe([j('A', 'Boule Joyeuse'), j('B')])).toEqual(['Boule Joyeuse']);
    expect(clubsEquipe([j('A'), j('B')])).toEqual([]);
  });

  it('complète avec le club de l équipe quand un joueur n en a pas', () => {
    expect(clubsEquipe([j('A'), j('B')], 'Amicale des Platanes')).toEqual([
      'Amicale des Platanes',
    ]);
    // Le club d'équipe ne s'ajoute pas s'il est déjà représenté.
    expect(clubsEquipe([j('A', 'Amicale des Platanes'), j('B')], 'Amicale des Platanes')).toEqual([
      'Amicale des Platanes',
    ]);
  });
});

describe('homogénéité', () => {
  it('un seul club : homogène', () => {
    expect(estHomogene([j('A', 'X'), j('B', 'X')])).toBe(true);
  });

  it('deux clubs : non homogène', () => {
    expect(estHomogene([j('A', 'X'), j('B', 'Y')])).toBe(false);
  });

  it('sans club connu, on ne conclut pas à la non-homogénéité', () => {
    expect(estHomogene([j('A'), j('B')])).toBe(true);
  });
});

describe('libellé des clubs', () => {
  it('un club : son nom', () => {
    expect(libelleClubs([j('A', 'Boule Joyeuse'), j('B', 'Boule Joyeuse')])).toBe('Boule Joyeuse');
  });

  it('plusieurs clubs : les noms séparés, comme sur la feuille fédérale', () => {
    expect(libelleClubs([j('A', 'Boule Joyeuse'), j('B', 'Pétanque du Port')])).toBe(
      'Boule Joyeuse / Pétanque du Port',
    );
  });

  it('aucun club : chaîne vide', () => {
    expect(libelleClubs([j('A'), j('B')])).toBe('');
  });
});
