import { describe, expect, it } from 'vitest';
import {
  besoinNiveau,
  defautsDuProfil,
  domaineEnUsage,
  estNiveauInterface,
  montrer,
  niveauDepuisAncienneCle,
  type DomaineInterface,
  type ParamsUsage,
} from '../profil';

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

describe('besoinNiveau — ce que le contenu du club suggère', () => {
  const RIEN = { concours: [], licencies: 0, clubsSurEquipes: false };

  it('amical quand rien ne réclame plus', () => {
    expect(besoinNiveau(RIEN)).toBe('amical');
    expect(besoinNiveau({ ...RIEN, concours: [{}, {}] })).toBe('amical');
  });

  it('federal dès qu\'un fichier de licenciés est importé', () => {
    expect(besoinNiveau({ ...RIEN, licencies: 1200 })).toBe('federal');
  });

  it('federal dès qu\'un concours est officiel', () => {
    expect(besoinNiveau({ ...RIEN, concours: [{}, { niveau: 'departemental' }] })).toBe('federal');
    expect(besoinNiveau({ ...RIEN, concours: [{ clubOrganisateur: 'Boule du Fort' }] })).toBe(
      'federal',
    );
  });

  it('club dès qu\'une équipe porte un club', () => {
    expect(besoinNiveau({ ...RIEN, clubsSurEquipes: true })).toBe('club');
  });

  it('le club d\'une équipe ne promeut pas en federal', () => {
    // Le piège du dépôt : estConcoursOfficiel teste `clubOrganisateur` — le
    // club organisateur du concours, un champ fédéral — et non `team.club`.
    // Confondre les deux ferait basculer en fédéral un simple club de village.
    expect(besoinNiveau({ ...RIEN, clubsSurEquipes: true })).not.toBe('federal');
  });

  it('club dès qu\'un concours porte l\'un des quatre domaines de club', () => {
    for (const c of [
      { miseParEquipe: 5 },
      { protections: [['A', 'B']] },
      { parGroupes: true },
      { decalageEquipe: 100 },
    ] satisfies ParamsUsage[]) {
      expect(besoinNiveau({ ...RIEN, concours: [c] })).toBe('club');
    }
  });

  it('federal l\'emporte sur club quand les deux sont réunis', () => {
    expect(
      besoinNiveau({ concours: [{ miseParEquipe: 5 }], licencies: 900, clubsSurEquipes: true }),
    ).toBe('federal');
  });
});

describe('defautsDuProfil', () => {
  it('amical part de quatre terrains, les deux autres de huit', () => {
    expect(defautsDuProfil('amical').nbTerrains).toBe(4);
    expect(defautsDuProfil('club').nbTerrains).toBe(8);
    expect(defautsDuProfil('federal').nbTerrains).toBe(8);
  });

  it('les autres valeurs ne dépendent pas du profil', () => {
    for (const n of ['amical', 'club', 'federal'] as const) {
      expect(defautsDuProfil(n)).toMatchObject({
        scoreMax: 13,
        format: 'doublette',
        consolante: true,
      });
    }
  });

  it('la mise n\'est jamais devinée', () => {
    // Proposer un tarif chiffré serait l'inventer. C'est un champ à saisir.
    for (const n of ['amical', 'club', 'federal'] as const) {
      expect(defautsDuProfil(n).miseParEquipe).toBeUndefined();
    }
  });
});

describe('niveauDepuisAncienneCle — migration de petanque.modeFederal', () => {
  it('« 1 » devient federal : l\'utilisateur avait demandé le mode fédéral', () => {
    expect(niveauDepuisAncienneCle('1')).toBe('federal');
  });

  it('« 0 » devient club : il avait refusé le fédéral, pas l\'argent ni les clubs', () => {
    expect(niveauDepuisAncienneCle('0')).toBe('club');
  });

  it('l\'absence de clé ne produit aucune préférence', () => {
    expect(niveauDepuisAncienneCle(null)).toBeNull();
  });

  it('une valeur inattendue ne produit aucune préférence', () => {
    expect(niveauDepuisAncienneCle('')).toBeNull();
    expect(niveauDepuisAncienneCle('oui')).toBeNull();
  });
});

describe('estNiveauInterface', () => {
  it('reconnaît les trois niveaux et rejette le reste', () => {
    expect(estNiveauInterface('amical')).toBe(true);
    expect(estNiveauInterface('club')).toBe(true);
    expect(estNiveauInterface('federal')).toBe(true);
    expect(estNiveauInterface('simple')).toBe(false);
    expect(estNiveauInterface(null)).toBe(false);
    expect(estNiveauInterface(1)).toBe(false);
  });
});
