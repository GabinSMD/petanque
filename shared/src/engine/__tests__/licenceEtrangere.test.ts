import { describe, expect, it } from 'vitest';
import { controlerEquipe } from '../licences';
import { estHorsUE } from '../championnat';
import {
  PAYS_LICENCE_ETRANGERE,
  chercherEtrangers,
  joueurDepuisFicheEtrangere,
  normaliserFicheEtrangere,
} from '../licenceEtrangere';
import type { Licencie, LicencieEtranger, Player } from '../../types';

const CRITERES = { annee: 2026, homogene: false as const };

const fiches = new Map<string, Licencie>();

describe('licence étrangère (§3.B.1, zone 21)', () => {
  it('un joueur licencié à l\'étranger n\'est pas « sans licence »', () => {
    // « permet d'inscrire un joueur étranger affilié à la fédération de son
    // pays » : il a une licence, elle n'est simplement pas française. Le
    // signaler comme manquante ferait chercher un numéro qui n'existe pas.
    const joueurs: Player[] = [
      { name: 'DUPOND Jean', licence: '02600100' },
      { name: 'VAN DAMME Luc', licenceEtrangere: 'BE' },
    ];
    const controle = controlerEquipe(joueurs, fiches, CRITERES);
    expect(controle.joueurs[1]!.anomalies).toEqual([]);
  });

  it('un joueur sans licence du tout reste en anomalie', () => {
    const controle = controlerEquipe([{ name: 'SANS Rien' }], fiches, CRITERES);
    expect(controle.joueurs[0]!.anomalies).toContain('licence');
  });

  it('compte dans le contingent hors UE quand le pays y est', () => {
    // §3.C : « 1 seul joueur étranger Hors UE par équipe ». Une licence suisse
    // est étrangère et hors UE ; une licence belge est étrangère mais dans l'UE.
    const deuxSuisses: Player[] = [
      { name: 'MEIER Hans', licenceEtrangere: 'CH' },
      { name: 'MULLER Fritz', licenceEtrangere: 'CH' },
    ];
    const controle = controlerEquipe(deuxSuisses, fiches, { ...CRITERES, maxHorsUE: 1 });
    expect(controle.anomaliesEquipe).toContain('horsUE');

    const deuxBelges: Player[] = [
      { name: 'VAN DAMME Luc', licenceEtrangere: 'BE' },
      { name: 'PEETERS Jan', licenceEtrangere: 'BE' },
    ];
    expect(
      controlerEquipe(deuxBelges, fiches, { ...CRITERES, maxHorsUE: 1 }).anomaliesEquipe,
    ).not.toContain('horsUE');
  });

  it('un pays qu\'on ne sait pas lire ne disqualifie personne', () => {
    // Même prudence qu'ailleurs : l'incertitude se signale, elle ne tranche pas.
    const joueurs: Player[] = [
      { name: 'X Untel', licenceEtrangere: 'Zzzz' },
      { name: 'Y Untel', licenceEtrangere: 'Zzzz' },
    ];
    expect(
      controlerEquipe(joueurs, fiches, { ...CRITERES, maxHorsUE: 1 }).anomaliesEquipe,
    ).not.toContain('horsUE');
  });

  it('s\'ajoute au contingent des fiches fédérales, sans doubler', () => {
    // Un hors-UE du fichier fédéral et un licencié hors UE à l'étranger font
    // deux : le contingent est bien dépassé.
    const avecFiche = new Map<string, Licencie>([
      [
        '02600200',
        { id: 'l1', name: 'BEN ALI Karim', licence: '02600200', nationalite: 'MA', updatedAt: '' },
      ],
    ]);
    const joueurs: Player[] = [
      { name: 'BEN ALI Karim', licence: '02600200' },
      { name: 'MEIER Hans', licenceEtrangere: 'CH' },
    ];
    const controle = controlerEquipe(joueurs, avecFiche, { ...CRITERES, maxHorsUE: 1 });
    expect(controle.anomaliesEquipe).toContain('horsUE');
  });

  it('ne touche pas au contrôle d\'homogénéité', () => {
    // Le club d'un joueur étranger est ce qu'on a saisi : il compte comme les
    // autres pour l'homogénéité.
    const joueurs: Player[] = [
      { name: 'DUPOND Jean', licence: '02600100', club: 'Crest' },
      { name: 'VAN DAMME Luc', licenceEtrangere: 'BE', club: 'Bruxelles PC' },
    ];
    const controle = controlerEquipe(joueurs, fiches, { ...CRITERES, homogene: true });
    expect(controle.anomaliesEquipe).toContain('homogeneite');
  });
});

/* ------------------------------------------------------------------ */
/* Base personnelle (§3.B.1, zone 21)                                  */
/* ------------------------------------------------------------------ */

const ficheEtr = (over: Partial<LicencieEtranger> = {}): LicencieEtranger => ({
  id: 'e1',
  nom: 'MÜLLER',
  prenom: 'Hans',
  pays: 'DE',
  updatedAt: '2026-07-31T10:00:00.000Z',
  ...over,
});

describe('pays de la fiche « Création Licence Etrangère »', () => {
  it('porte les sept pays de la copie d\'écran, dans son ordre', () => {
    expect(PAYS_LICENCE_ETRANGERE.map((p) => p.nom)).toEqual([
      'Allemagne',
      'Belgique',
      'Espagne',
      'Italie',
      'Luxembourg',
      'Pays-Bas',
      'Suisse',
    ]);
  });

  it('donne des codes que le contingent hors UE sait lire', () => {
    // Sans ça, une fiche enregistrée ne compterait pas dans le contingent des
    // compétitions de clubs : `estHorsUE` rendrait `null` sur chaque pays.
    for (const pays of PAYS_LICENCE_ETRANGERE) {
      expect(estHorsUE(pays.code), pays.nom).not.toBeNull();
    }
  });

  it('la Suisse est le seul pays hors UE de la liste', () => {
    const horsUE = PAYS_LICENCE_ETRANGERE.filter((p) => estHorsUE(p.code) === true);
    expect(horsUE.map((p) => p.nom)).toEqual(['Suisse']);
  });
});

describe('fiche étrangère : ce qu\'on accepte d\'enregistrer', () => {
  it('accepte nom, prénom et pays, et les met en capitales', () => {
    // Les fiches licence et les feuilles de match du manuel écrivent tout en
    // capitales — « BARBET JEAN », « GRIECO ANDRE » — et le document du délégué
    // le demande explicitement : « Nom, Prénom (en lettre majuscule) ».
    const r = normaliserFicheEtrangere({ nom: 'müller', prenom: 'hans', pays: 'DE' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fiche.nom).toBe('MÜLLER');
      expect(r.fiche.prenom).toBe('HANS');
    }
  });

  it('refuse une fiche sans nom, sans prénom ou sans pays', () => {
    expect(normaliserFicheEtrangere({ nom: '', prenom: 'Hans', pays: 'DE' }).ok).toBe(false);
    expect(normaliserFicheEtrangere({ nom: 'MÜLLER', prenom: ' ', pays: 'DE' }).ok).toBe(false);
    expect(normaliserFicheEtrangere({ nom: 'MÜLLER', prenom: 'Hans', pays: '' }).ok).toBe(false);
  });

  it('refuse un pays absent de la liste plutôt que de l\'inventer', () => {
    // Le contingent hors UE se calcule sur ce code : un pays inconnu rendrait le
    // contrôle muet sans le dire.
    const r = normaliserFicheEtrangere({ nom: 'DOE', prenom: 'John', pays: 'US' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/pays/i);
  });

  it('lit la date au format de la fiche, JJ/MM/AAAA', () => {
    const r = normaliserFicheEtrangere({
      nom: 'MÜLLER',
      prenom: 'Hans',
      pays: 'DE',
      dateNaissance: '17/12/1980',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fiche.dateNaissance).toBe('1980-12-17');
  });

  it('refuse une date illisible : une date fausse fausserait la catégorie d\'âge', () => {
    for (const mauvaise of ['32/13/1980', 'hier', '1980']) {
      expect(normaliserFicheEtrangere({
        nom: 'MÜLLER',
        prenom: 'Hans',
        pays: 'DE',
        dateNaissance: mauvaise,
      }).ok, mauvaise).toBe(false);
    }
  });

  it('accepte une fiche sans date ni numéro : sur le terrain, on ne les a pas toujours', () => {
    const r = normaliserFicheEtrangere({ nom: 'MÜLLER', prenom: 'Hans', pays: 'DE' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fiche.dateNaissance).toBeUndefined();
      expect(r.fiche.licence).toBeUndefined();
    }
  });

  it('garde le numéro de licence de sa fédération', () => {
    const r = normaliserFicheEtrangere({
      nom: 'MÜLLER',
      prenom: 'Hans',
      pays: 'DE',
      licence: ' 12345-CH ',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fiche.licence).toBe('12345-CH');
  });
});

describe('inscrire un joueur depuis sa fiche', () => {
  it('porte le nom complet et le pays', () => {
    const j = joueurDepuisFicheEtrangere(ficheEtr());
    expect(j.name).toBe('MÜLLER Hans');
    expect(j.licenceEtrangere).toBe('DE');
  });

  it('ne met jamais le numéro étranger dans le champ de la licence française', () => {
    // Le numéro d'une fédération étrangère n'est pas un numéro fédéral : posé
    // là, `controlerEquipe` le chercherait dans le fichier des licenciés, ne le
    // trouverait pas, et marquerait le joueur « inconnu » — donc l'équipe non
    // conforme, alors qu'elle l'est.
    const j = joueurDepuisFicheEtrangere(ficheEtr({ licence: '4711' }));
    expect(j.licence).toBeUndefined();
    expect(j.licenceEtrangere).toBe('DE');
  });

  it('un joueur suisse compte dans le contingent hors UE', () => {
    // C'est tout l'intérêt de garder le code pays : le contrôle des équipes de
    // clubs le relit tel quel, sans rien savoir de la base personnelle.
    const j = joueurDepuisFicheEtrangere(ficheEtr({ pays: 'CH' }));
    expect(estHorsUE(j.licenceEtrangere)).toBe(true);
  });
});

describe('retrouver une fiche dans la base personnelle', () => {
  const base: LicencieEtranger[] = [
    ficheEtr({ id: '1', nom: 'MÜLLER', prenom: 'Hans', licence: '4711', pays: 'DE' }),
    ficheEtr({ id: '2', nom: 'DUPOND', prenom: 'Marc', licence: '9002', pays: 'BE' }),
    ficheEtr({ id: '3', nom: 'DUPONT', prenom: 'Luc', pays: 'CH' }),
    // Contient « DUP » sans commencer par : le manuel dit « commence par ».
    ficheEtr({ id: '4', nom: 'VANDUPRE', prenom: 'Jos', pays: 'NL' }),
  ];

  it('retrouve par début de nom, comme le manuel le décrit', () => {
    // §3.B.1 : « Tapez juste DUP et <<ENTRER>> vous obtiendrez la liste des
    // licenciés de votre base de données qui commence par DUP. »
    expect(chercherEtrangers(base, 'DUP').map((f) => f.id)).toEqual(['2', '3']);
  });

  it('ne remonte pas une fiche qui contient la requête ailleurs qu\'au début', () => {
    // « VANDUPRE » contient DUP : le manuel ne le proposerait pas, et noyer la
    // liste de correspondances lointaines ferait perdre le temps qu'on cherche à
    // gagner à la table de marque.
    expect(chercherEtrangers(base, 'DUP').map((f) => f.id)).not.toContain('4');
  });

  it('ignore la casse et les espaces autour', () => {
    expect(chercherEtrangers(base, '  dup ').map((f) => f.id)).toEqual(['2', '3']);
  });

  it('retrouve par numéro de licence', () => {
    expect(chercherEtrangers(base, '4711').map((f) => f.id)).toEqual(['1']);
  });

  it('retrouve par prénom', () => {
    expect(chercherEtrangers(base, 'Luc').map((f) => f.id)).toEqual(['3']);
  });

  it('ne rend rien sur une recherche vide : on ne déverse pas la base', () => {
    expect(chercherEtrangers(base, '')).toEqual([]);
    expect(chercherEtrangers(base, '   ')).toEqual([]);
  });
});
