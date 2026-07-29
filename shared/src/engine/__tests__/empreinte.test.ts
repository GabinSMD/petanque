import { describe, expect, it } from 'vitest';
import { contenuSigne, empreinteFeuille, type ContenuFeuille } from '../feuilleMatch';

const BASE: ContenuFeuille = {
  entete: {
    competition: 'CNC / CRC / CDC — Open',
    date: '2026-07-28',
    division: 'D1',
    poule: 'A',
    clubA: 'Boule de l\'Avenir',
    numeroClubA: '6032',
    clubB: 'PC Romans',
    numeroClubB: '6047',
    heureDebut: '14:00',
    heureFin: '18:30',
  },
  compositionA: ['JOUEUR 1', 'JOUEUR 2', 'JOUEUR 3'],
  compositionB: ['ADVERSE 1', 'ADVERSE 2', 'ADVERSE 3'],
  parties: [
    { type: 'tete_a_tete', scoreA: 13, scoreB: 7, jeu: '1', placesA: ['JOUEUR 1'], placesB: ['ADVERSE 1'] },
    { type: 'doublette', scoreA: 6, scoreB: 13, jeu: '2', placesA: ['JOUEUR 1', 'JOUEUR 2'], placesB: ['ADVERSE 1', 'ADVERSE 2'] },
  ],
  remplacements: [{ bloc: 'doublette', cote: 'a', remplace: 'JOUEUR 1', remplacant: 'JOUEUR 3' }],
  remarques: '',
  totalA: 2,
  totalB: 4,
};

describe('empreinte du contenu signé', () => {
  it('même contenu, même empreinte', () => {
    expect(empreinteFeuille(BASE)).toBe(empreinteFeuille(structuredClone(BASE)));
  });

  it('huit caractères hexadécimaux, lisibles et comparables à l\'œil', () => {
    expect(empreinteFeuille(BASE)).toMatch(/^[0-9A-F]{8}$/);
  });

  it('un score modifié change l\'empreinte', () => {
    const change = structuredClone(BASE);
    change.parties[0]!.scoreB = 8;
    expect(empreinteFeuille(change)).not.toBe(empreinteFeuille(BASE));
  });

  it('un joueur modifié change l\'empreinte', () => {
    const change = structuredClone(BASE);
    change.parties[0]!.placesA = ['JOUEUR 2'];
    expect(empreinteFeuille(change)).not.toBe(empreinteFeuille(BASE));
  });

  it('un total modifié change l\'empreinte', () => {
    // Le total est calculé, mais il figure sur la feuille : il est signé aussi.
    const change = structuredClone(BASE);
    change.totalA = 36;
    expect(empreinteFeuille(change)).not.toBe(empreinteFeuille(BASE));
  });

  it('un remplacement, une remarque, un en-tête : tout ce qui est écrit compte', () => {
    for (const modifier of [
      (c: ContenuFeuille) => (c.remplacements[0]!.remplacant = 'JOUEUR 2'),
      (c: ContenuFeuille) => (c.remarques = 'Incident au 3e tour'),
      (c: ContenuFeuille) => (c.entete.poule = 'B'),
      (c: ContenuFeuille) => (c.compositionB[2] = 'ADVERSE 4'),
      (c: ContenuFeuille) => (c.parties[1]!.jeu = '9'),
    ]) {
      const change = structuredClone(BASE);
      modifier(change);
      expect(empreinteFeuille(change)).not.toBe(empreinteFeuille(BASE));
    }
  });

  it('les espaces superflus ne changent rien : ce serait un faux positif', () => {
    const espaces = structuredClone(BASE);
    espaces.compositionA[0] = '  JOUEUR 1  ';
    espaces.entete.division = ' D1 ';
    expect(empreinteFeuille(espaces)).toBe(empreinteFeuille(BASE));
  });

  it('le contenu signé se relit : on peut montrer ce qui a été signé', () => {
    const texte = contenuSigne(BASE);
    expect(texte).toContain('D1');
    expect(texte).toContain('JOUEUR 1');
    expect(texte).toContain('13-7');
    // Une signature ne fait pas partie de ce qu'elle signe.
    expect(texte).not.toContain('data:image');
  });
});
