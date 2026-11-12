import { describe, expect, it } from 'vitest';
import {
  DEFAUTS_ORIGINE,
  defautsPersonnalises,
  lireDefautsConcours,
} from '../defautsConcours';

describe('lireDefautsConcours', () => {
  it("rend l'origine sans enregistrement ou sur un contenu illisible", () => {
    for (const brut of [null, undefined, '', '{', 'null', '[]', '42']) {
      expect(lireDefautsConcours(brut)).toEqual(DEFAUTS_ORIGINE);
    }
  });

  it('reprend les valeurs enregistrées', () => {
    const d = lireDefautsConcours(
      JSON.stringify({
        nbTerrains: 12,
        scoreMax: 11,
        consolante: false,
        planTerrains: false,
        lieu: ' Boulodrome municipal ',
        miseParJoueur: 5,
      }),
    );
    expect(d).toEqual({
      nbTerrains: 12,
      scoreMax: 11,
      consolante: false,
      planTerrains: false,
      lieu: 'Boulodrome municipal',
      miseParJoueur: 5,
    });
    expect(defautsPersonnalises(d)).toBe(true);
  });

  it('écarte champ par champ ce qui est mal typé ou hors bornes', () => {
    const d = lireDefautsConcours(
      JSON.stringify({
        nbTerrains: 0,
        scoreMax: '13',
        consolante: 'oui',
        lieu: '   ',
        miseParJoueur: -2,
      }),
    );
    expect(d).toEqual(DEFAUTS_ORIGINE);
    expect(defautsPersonnalises(d)).toBe(false);
  });

  it('garde un champ valide même si son voisin ne l’est pas', () => {
    const d = lireDefautsConcours(JSON.stringify({ nbTerrains: 2.5, scoreMax: 11 }));
    expect(d.nbTerrains).toBe(DEFAUTS_ORIGINE.nbTerrains);
    expect(d.scoreMax).toBe(11);
  });
});
