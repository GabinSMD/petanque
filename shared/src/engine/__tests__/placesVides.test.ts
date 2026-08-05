import { describe, expect, it } from 'vitest';
import { BAREME_CDC, placesVides, partiesVides } from '../feuilleMatch';

/**
 * Test de caractérisation écrit **avant** la consolidation de la table
 * joueurs-par-formation, qui existait en cinq copies. `placesVides` en était le
 * seul consommateur non couvert : sans ce fichier, se tromper de table sur la
 * feuille de match ne faisait tomber aucun test.
 */
describe('places vides de la feuille de match', () => {
  it('dimensionne chaque partie selon sa formation', () => {
    const places = placesVides(BAREME_CDC);
    // Le barème CD26 : 6 têtes-à-têtes, 3 doublettes, 2 triplettes.
    expect(places).toHaveLength(11);
    const tailles = places.map((p) => p.a.length);
    expect(tailles).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3]);
    // Les deux camps sont dimensionnés pareil, partie par partie.
    expect(places.map((p) => p.b.length)).toEqual(tailles);
  });

  it('rend des places vraiment vides, et non partagées', () => {
    const places = placesVides(BAREME_CDC);
    expect(places.every((p) => p.a.every((s) => s === ''))).toBe(true);
    // Deux `Array().fill('')` distincts : écrire dans un camp ne doit pas
    // écrire dans l'autre.
    places[0]!.a[0] = 'DUPONT';
    expect(places[0]!.b[0]).toBe('');
    expect(places[1]!.a[0]).toBe('');
  });

  it('suit le barème qu on lui donne', () => {
    const bareme = { id: 'x', label: 'x', blocs: [{ type: 'triplette' as const, nb: 1, points: 6 }] };
    expect(placesVides(bareme).map((p) => p.a.length)).toEqual([3]);
    expect(partiesVides(bareme)).toHaveLength(1);
  });
});
