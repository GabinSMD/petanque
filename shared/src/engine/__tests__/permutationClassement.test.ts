import { describe, expect, it } from 'vitest';
import {
  ajouterPermutation,
  appliquerPermutations,
  permutationsActives,
  classementRondes,
  estPermutee,
  permutationDepuisRangs,
  retirerPermutation,
  type PermutationClassement,
} from '../permutationClassement';
import type { Match } from '../../types';
import type { Standing } from '../rondes';

const st = (id: string, wins: number, diff = 0): Standing => ({
  id,
  played: 3,
  wins,
  diff,
  pointsFor: 20,
});

/**
 * Cinq équipes, avec **deux paires** à égalité stricte : a/b aux places 1-2 et
 * c/d aux places 3-4. Une permutation ne s'appliquant qu'entre équipes à égalité,
 * les données doivent en offrir.
 */
const classement: Standing[] = [
  st('a', 3, 10),
  st('b', 3, 10),
  st('c', 1, 2),
  st('d', 1, 2),
  st('e', 0, -8),
];

describe('appliquer une permutation au classement', () => {
  it('échange les deux équipes désignées', () => {
    const p: PermutationClassement[] = [{ a: 'c', b: 'd' }];
    expect(appliquerPermutations(classement, p).map((s) => s.id)).toEqual([
      'a',
      'b',
      'd',
      'c',
      'e',
    ]);
  });

  it('sans permutation, le classement calculé passe tel quel', () => {
    expect(appliquerPermutations(classement, []).map((s) => s.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(appliquerPermutations(classement, undefined).map((s) => s.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('ne touche pas au classement d\'origine', () => {
    appliquerPermutations(classement, [{ a: 'c', b: 'd' }]);
    expect(classement.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('applique plusieurs permutations dans l\'ordre', () => {
    const p: PermutationClassement[] = [
      { a: 'a', b: 'b' },
      { a: 'c', b: 'd' },
    ];
    expect(appliquerPermutations(classement, p).map((s) => s.id)).toEqual([
      'b',
      'a',
      'd',
      'c',
      'e',
    ]);
  });

  it('ignore une permutation invalide sans perdre les suivantes', () => {
    // Le cas que le sabotage a mis au jour : s'arrêter à la première permutation
    // devenue caduque — équipe déclarée forfait, concours redécoupé — ferait
    // perdre celles que l'organisateur a demandées ensuite.
    const p: PermutationClassement[] = [
      { a: 'c', b: 'disparue' },
      { a: 'a', b: 'b' },
    ];
    expect(appliquerPermutations(classement, p).map((s) => s.id)).toEqual([
      'b',
      'a',
      'c',
      'd',
      'e',
    ]);
  });

  it('ignore une permutation dont une équipe a disparu', () => {
    // Une équipe déclarée forfait sort du classement : la permutation qui la
    // désignait ne veut plus rien dire, mais elle ne doit pas casser le reste.
    const p: PermutationClassement[] = [{ a: 'c', b: 'zzz' }];
    expect(appliquerPermutations(classement, p).map((s) => s.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });
});

describe('une permutation ne vaut que tant que l\'égalité dure', () => {
  // Trouvé en vérifiant dans l'application : après une ronde de plus, les deux
  // équipes interverties n'étaient plus à égalité — l'une avait deux victoires,
  // l'autre une — et la permutation les maintenait inversées. Ce n'était plus un
  // départage mais une distorsion.
  //
  // Le bouton fédéral dit « suite à une égalité » : quand l'égalité disparaît, la
  // raison de l'interversion disparaît avec elle.
  it('s\'applique entre deux équipes à égalité', () => {
    const p: PermutationClassement[] = [{ a: 'c', b: 'd' }];
    expect(appliquerPermutations(classement, p).map((s) => s.id)).toEqual([
      'a',
      'b',
      'd',
      'c',
      'e',
    ]);
  });

  it('cesse de s\'appliquer quand les critères séparent les deux équipes', () => {
    const separees: Standing[] = [st('a', 3, 10), st('b', 2, 5), st('c', 2, 9), st('d', 1, 2)];
    const p: PermutationClassement[] = [{ a: 'b', b: 'd' }];
    expect(appliquerPermutations(separees, p).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('dit lesquelles s\'appliquent, pour que l\'écran l\'explique', () => {
    const separees: Standing[] = [st('a', 3, 10), st('b', 2, 5), st('c', 1, 2), st('d', 1, 2)];
    const p: PermutationClassement[] = [
      { a: 'c', b: 'd' },
      { a: 'a', b: 'b' },
    ];
    expect(permutationsActives(separees, p)).toEqual([{ a: 'c', b: 'd' }]);
  });
});

describe('désigner deux équipes par leur rang, comme le manuel', () => {
  it('lit les rangs affichés, à partir de 1', () => {
    // La macro demande « le classement du premier joueur à intervertir (chiffre
    // à gauche du Nom du joueur) » : c'est le rang affiché, pas un indice.
    expect(permutationDepuisRangs(classement, 3, 4)).toEqual({ a: 'c', b: 'd' });
  });

  it('rend `undefined` sur un rang hors du classement', () => {
    expect(permutationDepuisRangs(classement, 0, 4)).toBeUndefined();
    expect(permutationDepuisRangs(classement, 3, 99)).toBeUndefined();
    expect(permutationDepuisRangs(classement, 1.5, 2)).toBeUndefined();
  });

  it('refuse d\'intervertir une place avec elle-même', () => {
    expect(permutationDepuisRangs(classement, 3, 3)).toBeUndefined();
  });
});

describe('tenir la liste des permutations', () => {
  it('ajoute une permutation', () => {
    expect(ajouterPermutation([], { a: 'c', b: 'd' })).toEqual([{ a: 'c', b: 'd' }]);
  });

  it('ne garde pas deux fois la même paire, même inversée', () => {
    // Réappliquer la même interversion la défait : mieux vaut une liste sans
    // doublon qu'un classement qui dépend du nombre de clics.
    const une = ajouterPermutation([], { a: 'c', b: 'd' });
    expect(ajouterPermutation(une, { a: 'c', b: 'd' })).toHaveLength(1);
    expect(ajouterPermutation(une, { a: 'd', b: 'c' })).toHaveLength(1);
  });

  it('retire une permutation par son rang dans la liste', () => {
    const deux: PermutationClassement[] = [
      { a: 'a', b: 'b' },
      { a: 'c', b: 'd' },
    ];
    expect(retirerPermutation(deux, 0)).toEqual([{ a: 'c', b: 'd' }]);
    expect(retirerPermutation(deux, 9)).toEqual(deux);
  });

  it('dit quelles équipes sont permutées à la main', () => {
    // L'écran doit pouvoir marquer ces lignes : un classement modifié à la main
    // ne doit pas passer pour un classement calculé.
    const p: PermutationClassement[] = [{ a: 'c', b: 'd' }];
    expect(estPermutee(p, 'c')).toBe(true);
    expect(estPermutee(p, 'd')).toBe(true);
    expect(estPermutee(p, 'a')).toBe(false);
    expect(estPermutee(undefined, 'c')).toBe(false);
  });
});

describe('une seule porte d\'entrée pour le classement des rondes', () => {
  // Cinq écrans affichent ce classement — onglet des rondes, résultats, page
  // publique, affichage TV, export. Si chacun composait le calcul et les
  // permutations à sa façon, il suffirait d'en oublier un pour que deux écrans
  // se contredisent.
  const teams = ['a', 'b', 'c'].map((id) => ({
    id,
    concoursId: 'c1',
    number: 1,
    players: [{ name: id }],
    forfait: false,
    updatedAt: '',
  }));
  /**
   * Aucune partie jouée : les trois équipes sont à égalité parfaite, donc
   * permutables. C'est le classement d'avant la première ronde, et il suffit à
   * vérifier que la composition passe bien par les permutations.
   */
  const matches: Match[] = [];

  it('rend le classement calculé quand il n\'y a pas de permutation', () => {
    const sans = classementRondes({ permutationsClassement: undefined }, teams, matches);
    expect(sans[0]!.id).toBe('a');
  });

  it('applique les permutations du concours', () => {
    const calcule = classementRondes({ permutationsClassement: undefined }, teams, matches);
    const permute = classementRondes(
      { permutationsClassement: [{ a: calcule[0]!.id, b: calcule[1]!.id }] },
      teams,
      matches,
    );
    expect(permute[0]!.id).toBe(calcule[1]!.id);
    expect(permute[1]!.id).toBe(calcule[0]!.id);
  });
});
