import { describe, expect, it } from 'vitest';
import {
  LETTRES_EQUIPE,
  BAREME_CDC,
  feuilleVierge,
  libelleEquipeClub,
  reinitialiserFiche,
} from '../feuilleMatch';
import type { FeuilleMatch } from '../feuilleMatch';

/**
 * Les huit fiches d'équipe A à H d'un même club (manuel §3.E, planche p.114).
 *
 * Le panneau « Choix Equipe » porte exactement huit boutons — `Equipe A` à
 * `Equipe H` — et le bouton de remise à zéro porte la lettre **courante** :
 * « Réinitialiser Fiche A ». La feuille imprimée confronte `Equipe A:PET CLUB DU
 * VERCORS` à `Equipe B:PETANQUE ILE VERTE`, donc les deux camps portent leur
 * lettre.
 */
const remplie = (over: Partial<FeuilleMatch> = {}): FeuilleMatch => ({
  ...feuilleVierge('f1', '2026-08-06', 'cnc_open'),
  equipe: 'A',
  equipeAdverse: 'B',
  club: 'PET CLUB DU VERCORS',
  adversaire: 'PETANQUE ILE VERTE',
  division: '2',
  poule: 'C',
  capitaineNom: 'EVRARD RENE',
  capitaineLicence: '03807307',
  licences: ['03834419', '03835291', '03800699'],
  remarques: 'à revoir',
  ...over,
});

describe('les huit lettres', () => {
  it('en compte huit, de A à H, sans neuvième', () => {
    // Le panneau n'a que huit boutons et aucune capture n'en montre plus.
    // Inventer un `I` serait exactement le genre d'extrapolation que la lecture
    // du manuel interdit.
    expect(LETTRES_EQUIPE).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });
});

describe('libellé d une équipe de club', () => {
  it('rend « Equipe A:NOM DU CLUB », comme la feuille imprimée', () => {
    expect(libelleEquipeClub('A', 'PET CLUB DU VERCORS')).toBe('Equipe A:PET CLUB DU VERCORS');
    expect(libelleEquipeClub('B', 'PETANQUE ILE VERTE')).toBe('Equipe B:PETANQUE ILE VERTE');
  });

  it('sans lettre, rend le seul nom du club', () => {
    // Un club qui n'engage qu'une équipe n'a pas à porter une lettre qu'il n'a
    // pas choisie.
    expect(libelleEquipeClub(undefined, 'BOULE JOYEUSE')).toBe('BOULE JOYEUSE');
  });

  it('sans nom de club, rend la seule lettre', () => {
    expect(libelleEquipeClub('C', '')).toBe('Equipe C');
    expect(libelleEquipeClub('C', '   ')).toBe('Equipe C');
  });

  it('ne rend rien quand on ne sait rien', () => {
    expect(libelleEquipeClub(undefined, '')).toBe('');
  });
});

describe('l empreinte des feuilles déjà signées', () => {
  /**
   * L'écran fait passer le nom du club par `libelleEquipeClub` avant de le mettre
   * dans l'en-tête signé. Or `contenuSigne` parcourt **toutes** les clés de
   * l'en-tête : si ce passage changeait la valeur d'une feuille sans lettre,
   * l'empreinte réimprimée ne correspondrait plus à celle figurant sur
   * l'exemplaire signé — la feuille paraîtrait falsifiée.
   *
   * C'est ce qui interdisait d'ajouter une clé `equipeA` à l'en-tête, et ce qui
   * rend le cas `undefined` de `libelleEquipeClub` indispensable, pas décoratif.
   */
  it('reste inchangée quand la feuille n a pas de lettre', () => {
    for (const club of ['PET CLUB DU VERCORS', 'Boule Joyeuse', '', '  espaces  ']) {
      expect(libelleEquipeClub(undefined, club)).toBe(club.trim());
    }
  });

  it('change dès qu une lettre est adoptée — et c est voulu', () => {
    // Une feuille qui adopte une lettre est une feuille modifiée : son empreinte
    // doit bouger, sinon la signature ne certifierait plus son contenu.
    expect(libelleEquipeClub('A', 'PET CLUB DU VERCORS')).not.toBe('PET CLUB DU VERCORS');
  });
});

describe('réinitialiser une fiche', () => {
  it('vide la composition et le capitaine', () => {
    const f = reinitialiserFiche(remplie());
    expect(f.licences).toEqual([]);
    expect(f.capitaineNom).toBe('');
    expect(f.capitaineLicence).toBe('');
  });

  it('garde l identité de la fiche : sa lettre, son club, sa compétition', () => {
    // « Réinitialiser Fiche A » remet **la fiche** à zéro, pas la rencontre :
    // c'est la composition qu'on refait, pas la feuille qu'on jette.
    const f = reinitialiserFiche(remplie());
    expect(f.equipe).toBe('A');
    expect(f.equipeAdverse).toBe('B');
    expect(f.club).toBe('PET CLUB DU VERCORS');
    expect(f.adversaire).toBe('PETANQUE ILE VERTE');
    expect(f.competition).toBe('cnc_open');
    expect(f.division).toBe('2');
    expect(f.poule).toBe('C');
    expect(f.id).toBe('f1');
    expect(f.date).toBe('2026-08-06');
  });

  it('vide les places, qui nomment les joueurs qu on vient d effacer', () => {
    // Sans cela la feuille garderait des noms sans composition : des places
    // renseignées pour des joueurs qui n'y sont plus.
    const avec = remplie({
      places: [
        { a: ['MALDERA'], b: ['DURAND'] },
        { a: ['ANTONA', 'PICHIOTTINO'], b: ['X', 'Y'] },
      ],
    });
    const f = reinitialiserFiche(avec);
    expect(f.places).toEqual(placesAttenduesDuBareme());
    expect(f.places.every((p) => p.a.every((s) => s === '') && p.b.every((s) => s === ''))).toBe(
      true,
    );
  });

  it('reconstruit les places d après les parties de **cette** feuille', () => {
    // Le barème « varie d'un comité et d'un championnat à l'autre » — c'est le
    // commentaire de ce module. Reconstruire depuis `BAREME_CDC` en dur rendrait
    // onze places à une feuille qui n'en a que deux.
    const autre = remplie({
      parties: [
        { type: 'triplette', scoreA: null, scoreB: null },
        { type: 'doublette', scoreA: null, scoreB: null },
      ],
      places: [
        { a: ['X', 'Y', 'Z'], b: ['1', '2', '3'] },
        { a: ['X', 'Y'], b: ['1', '2'] },
      ],
    });
    const f = reinitialiserFiche(autre);
    expect(f.places).toEqual([
      { a: ['', '', ''], b: ['', '', ''] },
      { a: ['', ''], b: ['', ''] },
    ]);
  });

  it('garde les scores déjà enregistrés', () => {
    // Les scores appartiennent à la rencontre, pas à la fiche. Une composition
    // mal saisie se refait sans perdre les résultats du jour.
    const avec = remplie();
    avec.parties[0]!.scoreA = 13;
    avec.parties[0]!.scoreB = 7;
    const f = reinitialiserFiche(avec);
    expect(f.parties[0]!.scoreA).toBe(13);
    expect(f.parties[0]!.scoreB).toBe(7);
  });

  it('ne touche pas à la fiche qu on lui donne', () => {
    // Le moteur ne mute rien : la réplication compare des objets.
    const avant = remplie();
    const copie = JSON.parse(JSON.stringify(avant));
    reinitialiserFiche(avant);
    expect(JSON.parse(JSON.stringify(avant))).toEqual(copie);
  });

  it('vide les remplacements et les signatures', () => {
    // Une signature vaut pour une composition : celle-ci effacée, elle ne
    // certifie plus rien.
    const avec = remplie({
      remplacements: { a: { tete_a_tete: [{ remplace: 'MALDERA', remplacant: 'FIGUS' }] }, b: {} },
      signatures: {
        a: { image: 'data:,', quand: '2026-08-06T10:00:00.000Z', empreinte: 'abc' },
        b: null,
      },
    });
    const f = reinitialiserFiche(avec);
    expect(f.remplacements).toEqual({ a: {}, b: {} });
    expect(f.signatures).toEqual({ a: null, b: null });
  });
});

/** Les places d'un barème neuf : 6 tête-à-têtes, 3 doublettes, 2 triplettes. */
function placesAttenduesDuBareme() {
  return feuilleVierge('x', '2026-08-06', 'cnc_open').places;
}

describe('le barème reste celui de la p.116', () => {
  it('11 parties : 6 × 2 pts, 3 × 4 pts, 2 × 6 pts', () => {
    // Garde-fou : la réinitialisation ne doit pas reconstruire un barème
    // différent de celui d'une feuille neuve.
    expect(BAREME_CDC.blocs).toEqual([
      { type: 'tete_a_tete', nb: 6, points: 2 },
      { type: 'doublette', nb: 3, points: 4 },
      { type: 'triplette', nb: 2, points: 6 },
    ]);
  });
});
