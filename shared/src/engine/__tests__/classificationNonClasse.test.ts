import { describe, expect, it } from 'vitest';
import { controlerEquipe, type CriteresLicence } from '../licences';
import { jeuDuConcours, segmentCategorie } from '../championnatCDF';
import type { Classification, Licencie } from '../../types';

/**
 * Cinquième position de classification (planche p.13, confirmée p.14) :
 * `Tous / Elite / Honneur / Promotion/NC / Non Classé`.
 *
 * La prose du manuel (« Zone 4 ») n'en cite que quatre, mais elle sous-compte
 * partout : elle écrit « tous – homme – femme » pour le Genre là où le même
 * panneau montre quatre positions dont `Mixte`, que nous portons déjà. Les
 * copies d'écran font foi.
 */
const BASE: CriteresLicence = { annee: 2026 };

function fiche(licence: string, classification?: Classification): Licencie {
  return {
    id: licence,
    name: `Joueur ${licence}`,
    licence,
    anneeReprise: 2026,
    ...(classification ? { classification } : {}),
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/** Anomalies du seul joueur de l'équipe, sous un critère de classification. */
function anomalies(
  classificationJoueur: Classification | undefined,
  critere: CriteresLicence['classification'],
): string[] {
  const f = fiche('1', classificationJoueur);
  const r = controlerEquipe([{ name: 'X', licence: '1' }], new Map([['1', f]]), {
    ...BASE,
    classification: critere,
  });
  return r.joueurs[0]!.anomalies;
}

describe('critère « Non Classé »', () => {
  it('refuse un joueur Promotion', () => {
    // L'enjeu du lot : un concours réservé aux non-classés n'était pas
    // exprimable — `promotion` laissait entrer les Promotion.
    expect(anomalies('P', 'nonClasse')).toContain('classification');
  });

  it('refuse aussi Élite et Honneur', () => {
    expect(anomalies('E', 'nonClasse')).toContain('classification');
    expect(anomalies('H', 'nonClasse')).toContain('classification');
  });

  it('accepte une fiche sans classification', () => {
    expect(anomalies(undefined, 'nonClasse')).not.toContain('classification');
  });
});

describe('critère « Promotion/NC »', () => {
  it('accepte un non-classé — c est ce que « /NC » dit', () => {
    // Le libellé fédéral est `Promotion/NC`, pas `Promotion`. Nous refusions
    // toute fiche sans classification : un non-classé était rejeté d'un
    // concours qui lui est justement ouvert.
    expect(anomalies(undefined, 'promotion')).not.toContain('classification');
  });

  it('accepte un joueur Promotion', () => {
    expect(anomalies('P', 'promotion')).not.toContain('classification');
  });

  it('refuse Élite et Honneur', () => {
    expect(anomalies('E', 'promotion')).toContain('classification');
    expect(anomalies('H', 'promotion')).toContain('classification');
  });
});

describe('critères Élite et Honneur : la preuve doit être positive', () => {
  it('refusent une fiche sans classification', () => {
    // Asymétrie voulue, et c'est la même règle : ces deux critères n'acceptent
    // pas les non-classés. Une fiche muette est soit un non-classé — qui n'y a
    // pas droit — soit un inconnu ; dans les deux lectures le joueur n'est pas
    // *établi* Élite. Un concours réservé à l'élite exige la preuve.
    expect(anomalies(undefined, 'elite')).toContain('classification');
    expect(anomalies(undefined, 'honneur')).toContain('classification');
  });

  it('acceptent la bonne lettre et refusent les autres', () => {
    expect(anomalies('E', 'elite')).not.toContain('classification');
    expect(anomalies('H', 'elite')).toContain('classification');
    expect(anomalies('P', 'elite')).toContain('classification');
    expect(anomalies('H', 'honneur')).not.toContain('classification');
    expect(anomalies('E', 'honneur')).toContain('classification');
  });
});

/*
 * Les deux blocs qui suivent passent **sans modification du code** : ils
 * exercent un chemin nouveau (`nonClasse` n'était pas une valeur possible) que
 * le code traitait déjà bien. Ils verrouillent donc une décision plutôt qu'ils
 * ne pilotent une écriture — c'est dit ici pour ne pas laisser croire à un
 * cycle rouge-vert qui n'a pas eu lieu.
 */

describe('« Non Classé » et le numéro fédéral', () => {
  it('n a pas d abréviation attestée : le segment reste à saisir', () => {
    // Aucune copie d'écran ne montre le numéro d'un concours non classé.
    // Inventer `NC` serait l'erreur qui nous a fait écrire `_JP_` pour `_PROV_`.
    expect(segmentCategorie({ format: 'triplette', critereClassification: 'nonClasse' })).toBeUndefined();
    // Le cas attesté, pour montrer que le test n'est pas vide de sens.
    expect(segmentCategorie({ format: 'triplette', critereClassification: 'promotion' })).toBe(
      'TPromo',
    );
  });
});

describe('« Non Classé » n est pas le Championnat Promotion', () => {
  it('reste un concours de pétanque', () => {
    // `Promotion` est un jeu fédéral (le Championnat Promotion) ; un concours
    // réservé aux non-classés n'est pas ce championnat.
    expect(jeuDuConcours({ critereClassification: 'nonClasse' })).toBe('petanque');
    expect(jeuDuConcours({ critereClassification: 'promotion' })).toBe('promotion');
  });
});

describe('« Tous » n impose rien', () => {
  it('accepte les quatre niveaux, non-classé compris', () => {
    for (const c of ['E', 'H', 'P', undefined] as (Classification | undefined)[]) {
      expect(anomalies(c, 'tous')).not.toContain('classification');
      expect(anomalies(c, undefined)).not.toContain('classification');
    }
  });
});
