import { describe, expect, it } from 'vitest';
import { remplacerJoueur } from '../depot';
import type { Licencie, Team } from '../../types';

const AU = '2026-08-04T08:30:00.000Z';

function equipe(): Team {
  return {
    id: 't2',
    concoursId: 'c1',
    number: 2,
    players: [
      { name: 'CAVALLI YVES', licence: '03801221', club: 'ST MARCELLIN', comite: '038' },
      { name: 'DI FAZIO PATRICK', licence: '03801220', club: 'ST MARCELLIN', comite: '038' },
      { name: 'BARBET JEAN', licence: '03800764', club: 'THONON', comite: '074', role: 'tireur' },
    ],
    forfait: false,
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}

const evrard: Licencie = {
  id: 'l9',
  name: 'EVRARD RENE',
  licence: '03807307',
  club: 'P C PIERRE SEMARD',
  comite: '038',
  updatedAt: AU,
};

describe('remplacement d un joueur au dépôt', () => {
  it('installe le remplaçant avec sa fiche', () => {
    const apres = remplacerJoueur(equipe(), 2, evrard, AU);
    expect(apres.players[2]).toEqual({
      name: 'EVRARD RENE',
      licence: '03807307',
      club: 'P C PIERRE SEMARD',
      comite: '038',
    });
  });

  it('n hérite de rien du joueur remplacé : c est une autre personne', () => {
    // BARBET était tireur et du club de THONON. Garder son rôle ou son club sur
    // EVRARD ferait mentir la fiche — et la colonne CD avec elle.
    const ficheNue: Licencie = { id: 'l8', name: 'MARTIN PAUL', licence: '03899999', updatedAt: AU };
    const apres = remplacerJoueur(equipe(), 2, ficheNue, AU);
    expect(apres.players[2]).toEqual({ name: 'MARTIN PAUL', licence: '03899999' });
  });

  it('un champ vide de la fiche ne devient pas un champ vide du joueur', () => {
    // Un import CSV rend des chaînes vides pour les colonnes absentes. Les
    // recopier telles quelles donnerait un club « » qui a l'air renseigné.
    const ficheVide: Licencie = {
      id: 'l6',
      name: 'BLANC ANNE',
      licence: '03888888',
      club: '',
      comite: '',
      updatedAt: AU,
    };
    expect(remplacerJoueur(equipe(), 1, ficheVide, AU).players[1]).toEqual({
      name: 'BLANC ANNE',
      licence: '03888888',
    });
  });

  it('laisse les autres joueurs intacts', () => {
    const avant = equipe();
    const apres = remplacerJoueur(avant, 2, evrard, AU);
    expect(apres.players[0]).toEqual(avant.players[0]);
    expect(apres.players[1]).toEqual(avant.players[1]);
    expect(apres.players).toHaveLength(3);
  });

  it('garde la trace de qui a cédé sa place', () => {
    // « Personne ne pourra dire le lendemain qui a joué » : c'est la raison
    // d'être de cette trace, pas un journal de confort.
    const apres = remplacerJoueur(equipe(), 2, evrard, AU);
    expect(apres.remplacements).toEqual([
      {
        index: 2,
        avant: { name: 'BARBET JEAN', licence: '03800764' },
        apres: { name: 'EVRARD RENE', licence: '03807307' },
        at: AU,
      },
    ]);
  });

  it('empile les remplacements successifs sans effacer les précédents', () => {
    const un = remplacerJoueur(equipe(), 2, evrard, AU);
    const deux = remplacerJoueur(un, 0, { ...evrard, id: 'l7', name: 'DUPONT LEA', licence: '03811111' }, AU);
    expect(deux.remplacements).toHaveLength(2);
    expect(deux.remplacements!.map((r) => r.index)).toEqual([2, 0]);
  });

  it('un rang hors de l équipe rend l équipe elle-même, sans copie', () => {
    // `toBe` et non `toEqual`, et le sabotage a montré pourquoi : l'appelant
    // (`remplacerJoueurAuDepot`) compare par identité pour ne rien écrire en
    // base. Une copie à contenu égal passerait le test tout en produisant une
    // écriture inutile — et une entrée de synchronisation avec elle.
    const avant = equipe();
    expect(remplacerJoueur(avant, 7, evrard, AU)).toBe(avant);
    expect(remplacerJoueur(avant, -1, evrard, AU)).toBe(avant);
    expect(remplacerJoueur(avant, 0.5, evrard, AU)).toBe(avant);
  });

  it('remplace aussi un joueur inscrit sans licence', () => {
    // Une équipe inscrite au nom seul, ce qui est le cas courant en club.
    const parNom: Team = {
      ...equipe(),
      players: [{ name: 'Un tel' }, { name: 'Un autre' }, { name: 'Un troisième' }],
    };
    const apres = remplacerJoueur(parNom, 1, evrard, AU);
    expect(apres.players[1]!.name).toBe('EVRARD RENE');
    expect(apres.remplacements![0]!.avant).toEqual({ name: 'Un autre', licence: undefined });
  });
});
