import { describe, expect, it } from 'vitest';
import { categorieAgeDe, controlerEquipe, type CriteresLicence } from '../licences';
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

  it('directive fédérale : hors strict, une catégorie inférieure est admise', () => {
    const r = controlerEquipe([joueur('c')], base(cadet), {
      ...BASE,
      categorieAge: 'seniors',
      strict: false,
    });
    expect(r.joueurs[0]!.anomalies).not.toContain('dateNaissance');
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
