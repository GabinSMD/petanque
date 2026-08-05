import { describe, expect, it } from 'vitest';
import { TAILLE_FORMATION, bilanMises, miseEquipe } from '../mises';
import type { Concours, Team } from '../../types';

/**
 * La mise fédérale est **par joueur** : le champ de la fenêtre de création
 * s'appelle `Mise/Joueur` et vaut `4.00 €` (planche p.12). Notre champ
 * `miseParEquipe` demandait un total d'équipe — un organisateur qui recopiait le
 * barème fédéral sous-estimait la recette d'un facteur 2 ou 3.
 */
const concours = (over: Partial<Concours>): Concours =>
  ({
    id: 'c',
    name: 'C',
    date: '2026-01-25',
    format: 'triplette',
    mode: 'poules',
    ...over,
  }) as Concours;

const equipe = (n: number, over: Partial<Team> = {}): Team =>
  ({ id: `t${n}`, concoursId: 'c', number: n, players: [], ...over }) as Team;

describe('mise par joueur → total d équipe', () => {
  it('multiplie par la formation', () => {
    expect(miseEquipe(concours({ format: 'triplette', miseParJoueur: 4 }))).toBe(12);
    expect(miseEquipe(concours({ format: 'doublette', miseParJoueur: 4 }))).toBe(8);
    expect(miseEquipe(concours({ format: 'tete_a_tete', miseParJoueur: 4 }))).toBe(4);
  });

  it('multiplie par la **formation**, pas par les joueurs présents', () => {
    // La planche écrit `Nbre Equipe : 16 = 192 €` — un prix unitaire constant,
    // que le logiciel ne pourrait pas afficher comme un produit s'il comptait
    // les joueurs équipe par équipe. Un engagement ne baisse pas parce qu'un
    // joueur manque à l'appel.
    expect(TAILLE_FORMATION).toEqual({ tete_a_tete: 1, doublette: 2, triplette: 3 });
  });

  it('accepte les centimes', () => {
    expect(miseEquipe(concours({ format: 'triplette', miseParJoueur: 4.5 }))).toBe(13.5);
  });
});

describe('compatibilité : les concours déjà enregistrés', () => {
  it('relit un ancien total d équipe **sans** le multiplier', () => {
    // `miseParEquipe: 12` voulait dire 12 € pour l'équipe. Le multiplier par 3
    // ferait payer 36 € à des équipes déjà inscrites — c'est exactement la
    // réinterprétation silencieuse que l'issue interdit.
    expect(miseEquipe(concours({ format: 'triplette', miseParEquipe: 12 }))).toBe(12);
  });

  it('la nouvelle valeur prime quand les deux existent', () => {
    // Même précédent que `mise` face à `paid` : sinon un concours repassé en
    // mise par joueur retomberait sur son ancien total à la relecture.
    expect(
      miseEquipe(concours({ format: 'triplette', miseParJoueur: 4, miseParEquipe: 99 })),
    ).toBe(12);
  });

  it('une mise par joueur à zéro reste zéro', () => {
    // Le piège du `||` : un concours gratuit ne doit pas retomber sur l'ancien
    // champ. C'est `!== undefined` qui protège, et rien d'autre.
    expect(miseEquipe(concours({ format: 'triplette', miseParJoueur: 0, miseParEquipe: 12 }))).toBe(0);
  });

  it('rend undefined quand rien n est saisi', () => {
    // Chaque écran garde ainsi son propre défaut — l'onglet Résultats calcule
    // les indemnités sur 10 € par équipe faute de mieux, et ce lot ne doit pas
    // le transformer en 10 € par joueur.
    expect(miseEquipe(concours({ format: 'triplette' }))).toBeUndefined();
  });
});

describe('le bilan des paiements de la planche p.33', () => {
  // 16 équipes en triplette à 4 €/joueur : `Nbre Equipe : 16 = 192 €`,
  // `Non Payés = 48 €`, `Chèque/Espèces = 144 €`, et 48 + 144 = 192.
  const c = concours({ format: 'triplette', miseParJoueur: 4 });
  const teams = [
    ...Array.from({ length: 4 }, (_, i) => equipe(i + 1, { mise: 'non_paye' as const })),
    ...Array.from({ length: 12 }, (_, i) => equipe(i + 5, { mise: 'paye' as const })),
  ];

  it('reproduit les trois montants imprimés', () => {
    const b = bilanMises(teams, miseEquipe(c) ?? 0);
    expect(b.restantDu).toBe(48);
    expect(b.encaisse).toBe(144);
    expect(b.aFacturer).toBe(0);
    expect(b.restantDu + b.encaisse).toBe(192);
    expect(b.parEtat).toEqual({ non_paye: 4, paye: 12, facturation: 0 });
  });
});
