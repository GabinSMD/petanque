import { describe, expect, it } from 'vitest';
import { LETTRES_TERRAIN, libelleTerrain, terrainNumeros } from '../terrains';

/**
 * Terrains désignés par lettre (manuel, fenêtre « Gestion des Terrains », planche
 * p.58-59).
 *
 * La fenêtre fédérale montre deux listes : les terrains **numérotés**, avec leur
 * case à cocher et leur état, et une liste rose `Terrain A` … `Terrain P`.
 *
 * Trois relevés de cette planche ont décidé de la conception :
 *
 *  - la liste rose n'a **aucune case à cocher**, alors que ce sont elles qui
 *    marquent un terrain occupé dans la liste de gauche ;
 *  - `TERRAINS DISPONIBLES : 8` et `DEBUT 1 / FIN 8` ne comptent **que** les
 *    numérotés — s'il y avait 8 + 16 terrains utilisables, le compte dirait 24 ;
 *  - aucune capture ne montre un `Terrain X Occupé`.
 *
 * La liste lettrée n'est donc pas un second jeu de terrains en service. Ce qu'un
 * boulodrome a réellement besoin d'exprimer, c'est que ses jeux **numérotés**
 * portent des lettres peintes au sol. D'où un libellé d'affichage, et non un
 * changement du type de `Match.terrain` — qui aurait touché 73 sites et
 * l'arithmétique de quatre fonctions du moteur.
 */
describe('les seize lettres de terrain', () => {
  it('va de A à P, comme la liste rose', () => {
    expect(LETTRES_TERRAIN.join('')).toBe('ABCDEFGHIJKLMNOP');
    expect(LETTRES_TERRAIN).toHaveLength(16);
  });
});

describe('libellé d un terrain', () => {
  it('rend le numéro quand rien n est demandé', () => {
    // Défaut de tous les concours déjà enregistrés : rien ne change pour eux.
    expect(libelleTerrain(5, undefined)).toBe('5');
    expect(libelleTerrain(5, 'numero')).toBe('5');
  });

  it('rend la lettre correspondante en mode lettre', () => {
    expect(libelleTerrain(1, 'lettre')).toBe('A');
    expect(libelleTerrain(2, 'lettre')).toBe('B');
    expect(libelleTerrain(16, 'lettre')).toBe('P');
  });

  it('compte depuis le premier terrain du concours, décalage compris', () => {
    // `terrainNumeros(8, 8)` rend 9…16 : le premier jeu de ce concours est le 9,
    // et c'est lui qui porte le « A » peint au sol.
    const numeros = terrainNumeros(8, 8);
    expect(numeros[0]).toBe(9);
    expect(libelleTerrain(9, 'lettre', 8)).toBe('A');
    expect(libelleTerrain(16, 'lettre', 8)).toBe('H');
    expect(numeros.map((n) => libelleTerrain(n, 'lettre', 8)).join('')).toBe('ABCDEFGH');
  });

  it('retombe sur le numéro au-delà de P, sans inventer de Q', () => {
    // La liste fédérale s'arrête à P. Un dix-septième jeu n'a pas de lettre : le
    // désigner « Q » serait exactement l'invention que la lecture du manuel
    // interdit, et l'organisateur ne trouverait ce « Q » nulle part au sol.
    expect(libelleTerrain(17, 'lettre')).toBe('17');
    expect(libelleTerrain(24, 'lettre')).toBe('24');
    expect(libelleTerrain(17, 'lettre', 0)).not.toBe('Q');
  });

  it('retombe sur le numéro pour un terrain hors du décalage', () => {
    // Un terrain antérieur au premier du concours — donnée abîmée ou reçue
    // d'ailleurs — n'a pas de lettre. Mieux vaut son numéro qu'une lettre fausse.
    expect(libelleTerrain(8, 'lettre', 8)).toBe('8');
    expect(libelleTerrain(0, 'lettre')).toBe('0');
    expect(libelleTerrain(-3, 'lettre')).toBe('-3');
  });

  it('reste juste sur les seize premiers, un par un', () => {
    // Le test n'est pas vide de sens : les seize libellés sont tous distincts et
    // suivent l'ordre de la liste rose.
    const libelles = terrainNumeros(16, 0).map((n) => libelleTerrain(n, 'lettre'));
    expect(libelles).toEqual([...'ABCDEFGHIJKLMNOP']);
    expect(new Set(libelles).size).toBe(16);
  });
});
