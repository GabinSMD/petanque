import { describe, expect, it } from 'vitest';
import {
  ajouterMene,
  ajouterMeneBornee,
  evolutionEnTexte,
  menesDepuisTexte,
  menesPourScore,
  retirerDerniereMene,
  scoreDepuisMenes,
  validerMenes,
  validerScoreEnCours,
  type Mene,
} from '../evolutionScore';

describe('score déduit des mènes', () => {
  it('additionne les points de chaque camp', () => {
    const menes: Mene[] = [
      { camp: 'b', points: 3 },
      { camp: 'a', points: 2 },
      { camp: 'a', points: 1 },
    ];
    expect(scoreDepuisMenes(menes)).toEqual({ a: 3, b: 3 });
  });

  it('sans mène, le score est nul', () => {
    expect(scoreDepuisMenes([])).toEqual({ a: 0, b: 0 });
  });
});

describe('ajouter et retirer une mène', () => {
  it('ajoute au camp qui a marqué', () => {
    const menes = ajouterMene([], 'a', 3);
    expect(menes).toEqual([{ camp: 'a', points: 3 }]);
    expect(scoreDepuisMenes(menes)).toEqual({ a: 3, b: 0 });
  });

  it('refuse une mène sans point : une mène a un gagnant', () => {
    // À la pétanque, toute mène est remportée par un camp — un 0 ne se saisit
    // pas, il n'existe pas.
    expect(() => ajouterMene([], 'a', 0)).toThrow();
    expect(() => ajouterMene([], 'a', -1)).toThrow();
  });

  it('refuse plus de six points : un camp n\'a pas plus de six boules', () => {
    // Borne de bon sens, pas une règle du manuel : six boules par équipe en
    // triplette comme en doublette.
    expect(() => ajouterMene([], 'a', 7)).toThrow();
    expect(ajouterMene([], 'a', 6)).toHaveLength(1);
  });

  it('retire la dernière mène, et rien de plus', () => {
    const menes = ajouterMene(ajouterMene([], 'a', 3), 'b', 2);
    const apres = retirerDerniereMene(menes);
    expect(apres).toEqual([{ camp: 'a', points: 3 }]);
    // L'original n'est pas touché : la correction reste une opération explicite.
    expect(menes).toHaveLength(2);
  });

  it('retirer sur une liste vide ne casse rien', () => {
    expect(retirerDerniereMene([])).toEqual([]);
  });
});

describe('« Evolution du Score » : le rendu du manuel', () => {
  it('une partie non commencée s\'écrit « 0-0/ »', () => {
    // C'est la seule valeur que montre le manuel (copie d'écran p.60, écran
    // « Voir Scores » et page HTML publiée).
    expect(evolutionEnTexte([])).toBe('0-0/');
  });

  it('chaque mène ajoute l\'état du score, séparé par « / »', () => {
    const menes: Mene[] = [
      { camp: 'b', points: 3 },
      { camp: 'a', points: 2 },
    ];
    expect(evolutionEnTexte(menes)).toBe('0-0/0-3/2-3/');
  });

  it('se relit : le texte publié redonne les mènes', () => {
    const menes: Mene[] = [
      { camp: 'b', points: 3 },
      { camp: 'a', points: 2 },
      { camp: 'a', points: 4 },
    ];
    expect(menesDepuisTexte(evolutionEnTexte(menes))).toEqual(menes);
  });

  it('relit « 0-0/ » comme une partie non commencée', () => {
    expect(menesDepuisTexte('0-0/')).toEqual([]);
    expect(menesDepuisTexte('')).toEqual([]);
    expect(menesDepuisTexte(undefined)).toEqual([]);
  });

  it('ne rend rien d\'un texte incohérent plutôt que d\'inventer', () => {
    // Un état qui recule, ou où les deux camps marquent dans la même mène, n'est
    // pas une évolution : mieux vaut ne rien reconstituer.
    expect(menesDepuisTexte('0-0/3-0/1-0/')).toEqual([]);
    expect(menesDepuisTexte('0-0/2-2/')).toEqual([]);
    expect(menesDepuisTexte('n importe quoi')).toEqual([]);
  });

  it('refuse un camp qui recule pendant que l\'autre marque', () => {
    // Le cas que le sabotage a mis au jour : « 3-0 » puis « 1-2 » a bien un camp
    // qui gagne deux points, ce qui suffisait à passer les autres contrôles — mais
    // A y perd deux points, et ça n'arrive pas à la pétanque.
    expect(menesDepuisTexte('0-0/3-0/1-2/')).toEqual([]);
  });

  it('refuse une suite qui ne part pas de 0-0', () => {
    // La seule valeur que montre le manuel commence à « 0-0 » : une suite qui
    // démarre ailleurs est tronquée, et une partie tronquée ne se devine pas.
    expect(menesDepuisTexte('2-0/3-0/')).toEqual([]);
    expect(menesDepuisTexte('1-1/')).toEqual([]);
  });
});

describe('cohérence avec le score enregistré', () => {
  const menes: Mene[] = [
    { camp: 'a', points: 6 },
    { camp: 'b', points: 7 },
  ];

  it('accepte des mènes qui font le score final', () => {
    expect(validerMenes(menes, 6, 7)).toBe(true);
  });

  it('refuse des mènes qui ne font pas le score : l\'historique mentirait', () => {
    // Le score final reste la référence — c'est lui qui décide du vainqueur.
    // Un détail qui le contredit vaut moins que pas de détail du tout.
    expect(validerMenes(menes, 13, 7)).toBe(false);
    expect(validerMenes(menes, 6, 0)).toBe(false);
  });

  it('des mènes vides sont cohérentes avec un score nul seulement', () => {
    expect(validerMenes([], 0, 0)).toBe(true);
    expect(validerMenes([], 13, 7)).toBe(false);
  });
});

describe('mènes à garder ou à écarter quand le score change', () => {
  const menes: Mene[] = [
    { camp: 'a', points: 6 },
    { camp: 'b', points: 7 },
  ];

  it('garde les mènes quand elles font le score saisi', () => {
    expect(menesPourScore(menes, 6, 7)).toEqual(menes);
  });

  it('écarte les mènes quand le score saisi les contredit', () => {
    // La table de marque corrige un score à la main : l'historique d'avant ne
    // décrit plus cette partie. Le garder ferait mentir la page publique.
    expect(menesPourScore(menes, 13, 7)).toBeUndefined();
  });

  it('n\'invente rien quand il n\'y avait pas de mènes', () => {
    expect(menesPourScore(undefined, 13, 7)).toBeUndefined();
    expect(menesPourScore([], 13, 7)).toBeUndefined();
  });

  it('garde une liste vide sur un score nul', () => {
    expect(menesPourScore([], 0, 0)).toEqual([]);
  });
});

describe('une mène s\'arrête au but', () => {
  // Règle de la pétanque : la partie s'arrête dès qu'un camp atteint le but.
  // À 11-5, une mène de six ne rapporte que deux points — la partie est finie
  // avant les quatre autres. Sans ce plafond, le score dépasserait 13 et le
  // contrôle du score final refuserait la partie.
  it('plafonne les points au but restant', () => {
    const menes = ajouterMeneBornee([{ camp: 'a', points: 11 }], 'a', 6, 13);
    expect(menes[1]).toEqual({ camp: 'a', points: 2 });
    expect(scoreDepuisMenes(menes)).toEqual({ a: 13, b: 0 });
  });

  it('ne plafonne pas quand il reste de la place', () => {
    const menes = ajouterMeneBornee([{ camp: 'a', points: 5 }], 'a', 6, 13);
    expect(menes[1]).toEqual({ camp: 'a', points: 6 });
  });

  it('refuse une mène quand la partie est déjà finie', () => {
    // Rien à ajouter à 13 : le camp a gagné, et un point de plus n'existe pas.
    expect(() => ajouterMeneBornee([{ camp: 'a', points: 13 }], 'a', 1, 13)).toThrow();
    expect(() => ajouterMeneBornee([{ camp: 'a', points: 13 }], 'b', 1, 13)).toThrow();
  });
});

describe('score en cours de partie', () => {
  it('accepte un score intermédiaire, que le score final refuserait', () => {
    // C'est le défaut que la vérification en application a trouvé : on
    // appliquait à un score en cours la règle du score final (« le gagnant doit
    // marquer 13 points »), ce qui empêchait toute mène.
    expect(validerScoreEnCours(3, 0, 13)).toBe(true);
    expect(validerScoreEnCours(0, 0, 13)).toBe(true);
    expect(validerScoreEnCours(7, 7, 13)).toBe(true);
  });

  it('accepte un score final', () => {
    expect(validerScoreEnCours(13, 7, 13)).toBe(true);
  });

  it('refuse ce qui ne peut pas arriver', () => {
    expect(validerScoreEnCours(14, 0, 13)).toBe(false);
    expect(validerScoreEnCours(13, 13, 13)).toBe(false);
    expect(validerScoreEnCours(-1, 0, 13)).toBe(false);
    expect(validerScoreEnCours(1.5, 0, 13)).toBe(false);
  });
});
