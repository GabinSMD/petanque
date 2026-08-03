import { describe, expect, it } from 'vitest';
import {
  CATEGORIES_AGE_CONCOURS,
  categorieAgeDe,
  categorieDuDessous,
  controlerEquipe,
  type CriteresLicence,
} from '../licences';
import type { Licencie } from '../../types';

const BASE: CriteresLicence = { annee: 2026 };

function fiche(over: Partial<Licencie> & { licence: string }): Licencie {
  return {
    id: over.licence,
    name: over.name ?? 'Joueur ' + over.licence,
    club: 'La Boule Joyeuse',
    anneeReprise: 2026,
    sexe: 'M',
    classification: 'P',
    dateNaissance: '1980-05-04',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function base(...fiches: Licencie[]): Map<string, Licencie> {
  return new Map(fiches.map((f) => [f.licence!, f]));
}

const joueur = (licence: string, name = 'X') => ({ name, licence });

describe('catégorie d âge fédérale', () => {
  it('applique les bornes du manuel (année en cours)', () => {
    expect(categorieAgeDe('1960-01-01', 2026)).toBe('veterans'); // 66 ans
    expect(categorieAgeDe('1966-12-31', 2026)).toBe('veterans'); // 60 ans
    expect(categorieAgeDe('1967-01-01', 2026)).toBe('seniors'); // 59 ans
    expect(categorieAgeDe('2008-01-01', 2026)).toBe('seniors'); // 18 ans
    expect(categorieAgeDe('2009-01-01', 2026)).toBe('juniors'); // 17 ans
    expect(categorieAgeDe('2011-01-01', 2026)).toBe('juniors'); // 15 ans
    expect(categorieAgeDe('2012-01-01', 2026)).toBe('cadets'); // 14 ans
    expect(categorieAgeDe('2014-01-01', 2026)).toBe('cadets'); // 12 ans
    expect(categorieAgeDe('2015-01-01', 2026)).toBe('minimes'); // 11 ans
    expect(categorieAgeDe('2017-01-01', 2026)).toBe('minimes'); // 9 ans
    expect(categorieAgeDe('2018-01-01', 2026)).toBe('benjamins'); // 8 ans
  });

  it('sans date de naissance, la catégorie est inconnue', () => {
    expect(categorieAgeDe(undefined, 2026)).toBeUndefined();
  });
});

describe('contrôle : licence et année de reprise', () => {
  it('accepte l année en cours et la suivante', () => {
    const b = base(fiche({ licence: '1', anneeReprise: 2026 }), fiche({ licence: '2', anneeReprise: 2027 }));
    const r = controlerEquipe([joueur('1'), joueur('2')], b, BASE);
    expect(r.conforme).toBe(true);
    expect(r.joueurs.every((j) => j.anomalies.length === 0)).toBe(true);
  });

  it('refuse une licence non renouvelée', () => {
    const b = base(fiche({ licence: '1', anneeReprise: 2025 }));
    const r = controlerEquipe([joueur('1')], b, BASE);
    expect(r.conforme).toBe(false);
    expect(r.joueurs[0]!.anomalies).toContain('anneeReprise');
  });

  it('signale un joueur absent du fichier fédéral', () => {
    const r = controlerEquipe([joueur('999')], base(), BASE);
    expect(r.joueurs[0]!.inconnu).toBe(true);
    expect(r.conforme).toBe(false);
  });

  it('signale un joueur sans n° de licence', () => {
    const r = controlerEquipe([{ name: 'Sans licence' }], base(), BASE);
    expect(r.joueurs[0]!.anomalies).toContain('licence');
    expect(r.conforme).toBe(false);
  });
});

describe('contrôle : catégorie d âge', () => {
  const cadet = fiche({ licence: 'c', dateNaissance: '2013-06-01' }); // 13 ans
  const senior = fiche({ licence: 's', dateNaissance: '1990-06-01' });
  const veteran = fiche({ licence: 'v', dateNaissance: '1960-06-01' });

  it('un cadet ne joue pas un concours séniors strict', () => {
    const r = controlerEquipe([joueur('c')], base(cadet), {
      ...BASE,
      categorieAge: 'seniors',
      strict: true,
    });
    expect(r.joueurs[0]!.anomalies).toContain('dateNaissance');
  });

  it('hors strict, une seule catégorie s\'ouvre en dessous', () => {
    // La fenêtre de création, Strict **décoché**, réécrit ses propres étiquettes :
    // « Sénior (Junior) », « Junior (Cadet) », « Cadet (Min.) », « Minime (Benj.) ».
    // Un concours sénior non strict admet donc les juniors, et eux seuls.
    const junior = fiche({ licence: 'j', dateNaissance: '2010-06-01' }); // 16 ans
    const criteres: CriteresLicence = { ...BASE, categorieAge: 'seniors', strict: false };
    expect(
      controlerEquipe([joueur('j')], base(junior), criteres).joueurs[0]!.anomalies,
    ).not.toContain('dateNaissance');
    // Le cadet est deux crans plus bas : la parenthèse ne dit pas « et tout ce
    // qui est plus jeune ».
    expect(
      controlerEquipe([joueur('c')], base(cadet), criteres).joueurs[0]!.anomalies,
    ).toContain('dateNaissance');
  });

  it('un sénior ne joue jamais un concours vétérans, même hors strict', () => {
    const r = controlerEquipe([joueur('s')], base(senior), {
      ...BASE,
      categorieAge: 'veterans',
      strict: false,
    });
    expect(r.joueurs[0]!.anomalies).toContain('dateNaissance');
  });

  it('un vétéran joue un concours séniors', () => {
    const r = controlerEquipe([joueur('v')], base(veteran), {
      ...BASE,
      categorieAge: 'seniors',
      strict: true,
    });
    expect(r.joueurs[0]!.anomalies).not.toContain('dateNaissance');
  });
});

describe('contrôle : la catégorie « et celle du dessous » (§3.E)', () => {
  // Le panneau « Critères Personnels » des compétitions de clubs (copie d'écran
  // p.116) écrit ses catégories avec une parenthèse : « Seniors (Junior) »,
  // « Juniors (Cadet) », « Cadets (Minime) », « Minimes (Ben.) ». Une seule
  // catégorie s'ouvre en dessous, pas toutes les plus jeunes.
  const junior = fiche({ licence: 'j', dateNaissance: '2010-06-01' }); // 16 ans
  const cadet = fiche({ licence: 'c', dateNaissance: '2013-06-01' }); // 13 ans
  const minime = fiche({ licence: 'm', dateNaissance: '2016-06-01' }); // 10 ans

  it('« Seniors (Junior) » admet un junior', () => {
    const r = controlerEquipe([joueur('j')], base(junior), {
      ...BASE,
      categorieAge: 'seniors',
    });
    expect(r.joueurs[0]!.anomalies).not.toContain('dateNaissance');
  });

  it('« Seniors (Junior) » refuse un cadet : deux catégories plus bas', () => {
    const r = controlerEquipe([joueur('c')], base(cadet), {
      ...BASE,
      categorieAge: 'seniors',
    });
    expect(r.joueurs[0]!.anomalies).toContain('dateNaissance');
  });

  it('« Juniors (Cadet) » admet un cadet et refuse un minime', () => {
    const criteres: CriteresLicence = {
      ...BASE,
      categorieAge: 'juniors',
    };
    expect(
      controlerEquipe([joueur('c')], base(cadet), criteres).joueurs[0]!.anomalies,
    ).not.toContain('dateNaissance');
    expect(
      controlerEquipe([joueur('m')], base(minime), criteres).joueurs[0]!.anomalies,
    ).toContain('dateNaissance');
  });

  it('la tolérance ouvre le plancher, jamais le plafond', () => {
    // Un sénior reste hors d'un championnat junior : la parenthèse descend, elle
    // ne monte pas.
    const senior = fiche({ licence: 's', dateNaissance: '1990-06-01' });
    const r = controlerEquipe([joueur('s')], base(senior), {
      ...BASE,
      categorieAge: 'juniors',
    });
    expect(r.joueurs[0]!.anomalies).toContain('dateNaissance');
  });

  it('la règle vaut pour tout concours, pas seulement les compétitions de clubs', () => {
    // C'est la correction du lot #109 : j'avais réservé « une seule en dessous »
    // aux compétitions de clubs et gardé « toutes les catégories inférieures »
    // pour les concours, sur la foi d'un test dont le titre disait déjà l'inverse
    // de ce qu'il vérifiait. La fenêtre de création tranche : les parenthèses y
    // sont, donc la règle y est.
    const r = controlerEquipe([joueur('m')], base(minime), {
      ...BASE,
      categorieAge: 'seniors',
      strict: false,
    });
    expect(r.joueurs[0]!.anomalies).toContain('dateNaissance');
  });
});

describe('contrôle : la catégorie « +55 » (§3.E)', () => {
  // La liste des catégories du panneau fédéral porte un « +55 » entre
  // « Vétérans » et « Seniors (Junior) » : un plancher d'âge, comme les
  // vétérans, mais cinq ans plus bas.
  it('admet un joueur de 55 ans et plus', () => {
    const b = base(
      fiche({ licence: '55', dateNaissance: '1971-06-01' }), // 55 ans
      fiche({ licence: '66', dateNaissance: '1960-06-01' }), // 66 ans
    );
    const criteres: CriteresLicence = { ...BASE, categorieAge: 'plus55' };
    expect(controlerEquipe([joueur('55')], b, criteres).joueurs[0]!.anomalies).not.toContain(
      'dateNaissance',
    );
    expect(controlerEquipe([joueur('66')], b, criteres).joueurs[0]!.anomalies).not.toContain(
      'dateNaissance',
    );
  });

  it('refuse un joueur de 54 ans', () => {
    const b = base(fiche({ licence: '54', dateNaissance: '1972-06-01' }));
    const r = controlerEquipe([joueur('54')], b, { ...BASE, categorieAge: 'plus55' });
    expect(r.joueurs[0]!.anomalies).toContain('dateNaissance');
  });

  it('un plancher n a pas de « catégorie du dessous » : 50 ans reste refusé', () => {
    const b = base(fiche({ licence: '50', dateNaissance: '1976-06-01' }));
    const r = controlerEquipe([joueur('50')], b, {
      ...BASE,
      categorieAge: 'plus55',
    });
    expect(r.joueurs[0]!.anomalies).toContain('dateNaissance');
  });
});

describe('contrôle : sexe', () => {
  const h = fiche({ licence: 'h', sexe: 'M' });
  const f = fiche({ licence: 'f', sexe: 'F' });

  it('concours féminin : un homme est en anomalie', () => {
    const r = controlerEquipe([joueur('h'), joueur('f')], base(h, f), { ...BASE, sexe: 'feminin' });
    expect(r.joueurs.find((j) => j.licence === 'h')!.anomalies).toContain('sexe');
    expect(r.joueurs.find((j) => j.licence === 'f')!.anomalies).not.toContain('sexe');
  });

  it('mixte : il faut au moins un homme et une femme, sinon toute l équipe est en anomalie', () => {
    const ok = controlerEquipe([joueur('h'), joueur('f')], base(h, f), { ...BASE, sexe: 'mixte' });
    expect(ok.conforme).toBe(true);

    const ko = controlerEquipe([joueur('h'), joueur('h')], base(h), { ...BASE, sexe: 'mixte' });
    expect(ko.conforme).toBe(false);
    expect(ko.anomaliesEquipe).toContain('mixte');
    expect(ko.joueurs.every((j) => j.anomalies.includes('sexe'))).toBe(true);
  });
});

describe('contrôle : classification', () => {
  it('un concours promotion refuse un joueur élite', () => {
    const b = base(fiche({ licence: 'e', classification: 'E' }));
    const r = controlerEquipe([joueur('e')], b, { ...BASE, classification: 'promotion' });
    expect(r.joueurs[0]!.anomalies).toContain('classification');
  });

  it('« tous » n impose rien', () => {
    const b = base(fiche({ licence: 'e', classification: 'E' }));
    const r = controlerEquipe([joueur('e')], b, { ...BASE, classification: 'tous' });
    expect(r.conforme).toBe(true);
  });
});

describe('contrôle : homogénéité de club', () => {
  const a1 = fiche({ licence: 'a1', club: 'Boule Joyeuse' });
  const a2 = fiche({ licence: 'a2', club: 'Boule Joyeuse' });
  const b1 = fiche({ licence: 'b1', club: 'Pétanque du Port' });

  it('équipe homogène exigée : deux clubs différents mettent l équipe en anomalie', () => {
    const r = controlerEquipe([joueur('a1'), joueur('b1')], base(a1, b1), {
      ...BASE,
      homogene: true,
    });
    expect(r.conforme).toBe(false);
    expect(r.anomaliesEquipe).toContain('homogeneite');
    expect(r.joueurs.every((j) => j.anomalies.includes('club'))).toBe(true);
  });

  it('même club : conforme', () => {
    const r = controlerEquipe([joueur('a1'), joueur('a2')], base(a1, a2), {
      ...BASE,
      homogene: true,
    });
    expect(r.conforme).toBe(true);
  });

  it('sans exigence d homogénéité, deux clubs passent', () => {
    const r = controlerEquipe([joueur('a1'), joueur('b1')], base(a1, b1), BASE);
    expect(r.conforme).toBe(true);
  });
});

describe('contrôle : certificat médical des jeunes', () => {
  const jeune = (over: Partial<Licencie> = {}) =>
    fiche({ licence: 'j', dateNaissance: '2013-06-01', ...over });

  it('exigé pour un jeune, et valide s il couvre la date du concours', () => {
    const ko = controlerEquipe([joueur('j')], base(jeune()), {
      ...BASE,
      dateConcours: '2026-07-27',
    });
    expect(ko.joueurs[0]!.anomalies).toContain('certificatMedical');

    const ok = controlerEquipe([joueur('j')], base(jeune({ certificatMedical: '2026-12-31' })), {
      ...BASE,
      dateConcours: '2026-07-27',
    });
    expect(ok.joueurs[0]!.anomalies).not.toContain('certificatMedical');
  });

  it('périmé : en anomalie', () => {
    const r = controlerEquipe([joueur('j')], base(jeune({ certificatMedical: '2026-01-01' })), {
      ...BASE,
      dateConcours: '2026-07-27',
    });
    expect(r.joueurs[0]!.anomalies).toContain('certificatMedical');
  });

  it('validé à la main sur présentation du papier : conforme', () => {
    const r = controlerEquipe([joueur('j')], base(jeune()), {
      ...BASE,
      dateConcours: '2026-07-27',
      certificatsValides: new Set(['j']),
    });
    expect(r.joueurs[0]!.anomalies).not.toContain('certificatMedical');
    expect(r.conforme).toBe(true);
  });

  it('pas exigé pour un adulte', () => {
    const r = controlerEquipe([joueur('1')], base(fiche({ licence: '1' })), {
      ...BASE,
      dateConcours: '2026-07-27',
    });
    expect(r.joueurs[0]!.anomalies).not.toContain('certificatMedical');
  });
});

describe('contrôle : sans critère ni fichier', () => {
  it('une équipe sans licence renseignée et sans critère reste signalée mais non bloquante', () => {
    const r = controlerEquipe([{ name: 'Marius' }, { name: 'Fernand' }], base(), {
      annee: 2026,
      ignorerLicencesManquantes: true,
    });
    expect(r.conforme).toBe(true);
    expect(r.joueurs.every((j) => j.anomalies.length === 0)).toBe(true);
  });
});

describe('homogénéité avec des clubs saisis à la main', () => {
  it('un joueur hors fichier compte avec le club saisi', () => {
    const b = base(fiche({ licence: '1', club: 'Boule Joyeuse' }));
    const r = controlerEquipe(
      [joueur('1'), { name: 'Sans fiche', licence: '9', club: 'Pétanque du Port' }],
      b,
      { ...BASE, homogene: true, ignorerLicencesManquantes: true },
    );
    expect(r.anomaliesEquipe).toContain('homogeneite');
  });

  it('même club saisi et fiché : homogène', () => {
    const b = base(fiche({ licence: '1', club: 'Boule Joyeuse' }));
    const r = controlerEquipe(
      [joueur('1'), { name: 'Sans fiche', licence: '9', club: 'Boule Joyeuse' }],
      b,
      { ...BASE, homogene: true, ignorerLicencesManquantes: true },
    );
    expect(r.anomaliesEquipe).not.toContain('homogeneite');
  });

  it('la casse et les espaces ne créent pas de fausse anomalie', () => {
    const b = base(fiche({ licence: '1', club: 'Boule Joyeuse' }));
    const r = controlerEquipe(
      [joueur('1'), { name: 'X', licence: '9', club: ' boule joyeuse ' }],
      b,
      { ...BASE, homogene: true, ignorerLicencesManquantes: true },
    );
    expect(r.anomaliesEquipe).not.toContain('homogeneite');
  });
});

describe('catégories proposées à un concours (§3.A)', () => {
  it('sont les sept de la fenêtre fédérale, sans le +55', () => {
    // La fenêtre « Création Nouveau Concours » liste Tous / Vétéran / Sénior /
    // Junior / Cadet / Minime / Benjamin. Le « +55 » n'y est pas : il n'existe
    // que sur le panneau des compétitions de clubs, et le proposer ici écrirait
    // en base une catégorie que `Concours.categorieAge` ne connaît pas.
    expect(CATEGORIES_AGE_CONCOURS).toEqual([
      'veterans',
      'seniors',
      'juniors',
      'cadets',
      'minimes',
      'benjamins',
    ]);
    expect(CATEGORIES_AGE_CONCOURS).not.toContain('plus55');
  });
});

describe('quelle catégorie s\'ouvre en dessous', () => {
  // Sert aux écrans : la fenêtre fédérale renomme ses étiquettes en
  // « Sénior (Junior) » quand Strict est décoché. Nos étiquettes portent déjà
  // les bornes d'âge, donc on l'écrit en clair sous la case plutôt que
  // d'empiler deux parenthèses.
  it('descend d\'un cran', () => {
    expect(categorieDuDessous('seniors')).toBe('juniors');
    expect(categorieDuDessous('juniors')).toBe('cadets');
    expect(categorieDuDessous('cadets')).toBe('minimes');
    expect(categorieDuDessous('minimes')).toBe('benjamins');
  });

  it('rien sous la plus jeune', () => {
    expect(categorieDuDessous('benjamins')).toBeUndefined();
  });

  it('rien sous un plancher : vétérans et +55 n\'ouvrent rien', () => {
    // Ces deux-là n'ont pas de plafond ; le manuel ne leur met pas de
    // parenthèse, et un sénior n'entre pas dans un concours vétérans.
    expect(categorieDuDessous('veterans')).toBeUndefined();
    expect(categorieDuDessous('plus55')).toBeUndefined();
  });
});
