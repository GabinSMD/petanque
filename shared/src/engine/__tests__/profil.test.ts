import { describe, expect, it } from 'vitest';
import { domaineEnUsage, montrer, type DomaineInterface, type ParamsUsage } from '../profil';

/** Les quatre domaines que le niveau « amical » masque. */
const DOMAINES_CLUB: DomaineInterface[] = [
  'argent',
  'formulesAvancees',
  'protections',
  'multisite',
];

/** Les quatre domaines que seul le niveau « federal » montre. */
const DOMAINES_FEDERAL: DomaineInterface[] = [
  'licencies',
  'championnatClubs',
  'criteresOfficiels',
  'documentsComite',
];

/** Un concours vierge : aucune trace d'usage d'aucun domaine. */
const VIERGE: ParamsUsage = {};

describe('montrer — le niveau minimum de chaque domaine', () => {
  it('en amical, masque les huit domaines conditionnels', () => {
    for (const d of [...DOMAINES_CLUB, ...DOMAINES_FEDERAL]) {
      expect(montrer(d, { niveau: 'amical' })).toBe(false);
    }
  });

  it('en club, montre les quatre domaines de club et masque les quatre fédéraux', () => {
    for (const d of DOMAINES_CLUB) expect(montrer(d, { niveau: 'club' })).toBe(true);
    for (const d of DOMAINES_FEDERAL) expect(montrer(d, { niveau: 'club' })).toBe(false);
  });

  it('en federal, montre les huit', () => {
    for (const d of [...DOMAINES_CLUB, ...DOMAINES_FEDERAL]) {
      expect(montrer(d, { niveau: 'federal' })).toBe(true);
    }
  });

  it('sans concours en contexte, un concours vierge ne change rien', () => {
    for (const d of DOMAINES_CLUB) {
      expect(montrer(d, { niveau: 'amical', concours: VIERGE })).toBe(false);
    }
  });
});

describe('montrer — la clause de sûreté : jamais masquer ce qui est utilisé', () => {
  it('argent : une mise, des frais ou un rang limite forcent l\'affichage', () => {
    for (const c of [
      { miseParEquipe: 5 },
      { fraisPct: 20 },
      { indemnitesJusquAuRang: 8 },
    ] satisfies ParamsUsage[]) {
      expect(montrer('argent', { niveau: 'amical', concours: c })).toBe(true);
    }
  });

  it('argent : une mise à zéro n\'est pas un usage', () => {
    expect(montrer('argent', { niveau: 'amical', concours: { miseParEquipe: 0 } })).toBe(false);
  });

  it('formulesAvancees : chacune des six options force l\'affichage', () => {
    for (const c of [
      { retirageParTour: true },
      { tirageDiffere: true },
      { ggStrict: true },
      { parGroupes: true },
      { recupCadrage: true },
      { complementaire: true },
    ] satisfies ParamsUsage[]) {
      expect(montrer('formulesAvancees', { niveau: 'amical', concours: c })).toBe(true);
    }
  });

  it('formulesAvancees : une option à false n\'est pas un usage', () => {
    expect(
      montrer('formulesAvancees', { niveau: 'amical', concours: { parGroupes: false } }),
    ).toBe(false);
  });

  it('protections : un groupe non vide force l\'affichage, une liste vide non', () => {
    expect(
      montrer('protections', { niveau: 'amical', concours: { protections: [['A', 'B']] } }),
    ).toBe(true);
    expect(montrer('protections', { niveau: 'amical', concours: { protections: [] } })).toBe(
      false,
    );
  });

  it('multisite : une origine ou un décalage force l\'affichage', () => {
    for (const c of [
      { issuDeConcours: 'c1' },
      { decalageEquipe: 100 },
      { decalageTerrain: 50 },
    ] satisfies ParamsUsage[]) {
      expect(montrer('multisite', { niveau: 'amical', concours: c })).toBe(true);
    }
  });

  it('multisite : un décalage à zéro n\'est pas un usage', () => {
    expect(montrer('multisite', { niveau: 'amical', concours: { decalageEquipe: 0 } })).toBe(
      false,
    );
  });

  it('domaines fédéraux : un concours officiel force l\'affichage même en amical', () => {
    // `niveau` déclenche estConcoursOfficiel — comportement inchangé.
    for (const d of DOMAINES_FEDERAL) {
      expect(montrer(d, { niveau: 'amical', concours: { niveau: 'departemental' } })).toBe(true);
    }
  });

  it('domaines fédéraux : le club d\'une équipe n\'est pas un concours officiel', () => {
    // Piège : `clubOrganisateur` est fédéral, `team.club` non — et il n'entre
    // pas dans ParamsUsage. Un concours vierge reste vierge.
    for (const d of DOMAINES_FEDERAL) {
      expect(montrer(d, { niveau: 'amical', concours: VIERGE })).toBe(false);
    }
  });
});

describe('domaineEnUsage', () => {
  it('rend false sur tous les domaines pour un concours vierge', () => {
    for (const d of [...DOMAINES_CLUB, ...DOMAINES_FEDERAL]) {
      expect(domaineEnUsage(d, VIERGE)).toBe(false);
    }
  });
});
