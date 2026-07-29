import { describe, expect, it } from 'vitest';
import {
  SEUIL_EGARE_MS,
  ciblesParcours,
  etapeApres,
  etapeFaite,
  parcoursApplicable,
  phaseEtape,
  premiereEtapeUtile,
  type EtapeParcours,
  type EtatParcours,
  type Parcours,
} from '../parcours';
import type { Concours } from '../../types';

const VIDE: EtatParcours = { concours: null, teams: [], poules: [], matches: [] };

/** Un concours réduit à ce que les parcours regardent. */
const concours = (over: Partial<Concours> = {}): Concours =>
  ({ id: 'c1', status: 'inscriptions', ...over }) as Concours;

const lecture = (titre: string): EtapeParcours => ({
  cible: null,
  titre,
  texte: 'Texte.',
  declencheur: { type: 'lecture' },
});

const clic = (titre: string, cible: string): EtapeParcours => ({
  cible,
  titre,
  texte: 'Texte.',
  declencheur: { type: 'clic' },
});

const jalon = (titre: string, atteint: (e: EtatParcours) => boolean): EtapeParcours => ({
  cible: '[data-tour="x"]',
  titre,
  texte: 'Texte.',
  declencheur: { type: 'jalon', atteint },
});

const parcours = (etapes: EtapeParcours[], over: Partial<Parcours> = {}): Parcours => ({
  id: 'p',
  titre: 'Parcours',
  retour: '/',
  etapes,
  ...over,
});

describe('étape déjà faite', () => {
  it('un jalon vrai clôt l\'étape d\'avance', () => {
    expect(etapeFaite(jalon('poules', (e) => e.poules.length > 0), VIDE)).toBe(false);
    expect(
      etapeFaite(jalon('poules', (e) => e.poules.length > 0), {
        ...VIDE,
        poules: [{ id: 'p1' }] as never,
      }),
    ).toBe(true);
  });

  it('lire et cliquer sont des gestes : jamais « déjà faits »', () => {
    // Sinon un parcours démarrerait en sautant ses explications.
    expect(etapeFaite(lecture('intro'), VIDE)).toBe(false);
    expect(etapeFaite(clic('onglet', '[data-tour="tab"]'), VIDE)).toBe(false);
  });
});

describe('reprise au premier geste qui reste à faire', () => {
  const p = parcours([
    jalon('inscrire', (e) => e.teams.length >= 2),
    jalon('tirer', (e) => e.poules.length > 0),
    lecture('bravo'),
  ]);

  it('part du début quand rien n\'est fait', () => {
    expect(premiereEtapeUtile(p, VIDE)).toBe(0);
  });

  it('saute ce qui est déjà acquis', () => {
    const avecEquipes = { ...VIDE, teams: [{ id: 't1' }, { id: 't2' }] as never };
    expect(premiereEtapeUtile(p, avecEquipes)).toBe(1);
  });

  it('saute plusieurs jalons d\'affilée', () => {
    const avance = {
      ...VIDE,
      teams: [{ id: 't1' }, { id: 't2' }] as never,
      poules: [{ id: 'p1' }] as never,
    };
    // On tombe sur la carte de fin, qui reste à lire.
    expect(premiereEtapeUtile(p, avance)).toBe(2);
  });

  it('signale un parcours entièrement acquis par un indice hors bornes', () => {
    const tout = parcours([jalon('a', () => true), jalon('b', () => true)]);
    expect(premiereEtapeUtile(tout, VIDE)).toBe(2);
    expect(premiereEtapeUtile(tout, VIDE)).toBe(tout.etapes.length);
  });

  it('un parcours sans étape est acquis d\'emblée', () => {
    expect(premiereEtapeUtile(parcours([]), VIDE)).toBe(0);
  });

  it('ne rejoue pas la navigation qui ouvre le parcours', () => {
    // Cas réel : « ouvrez l'onglet Équipes » puis deux jalons d'inscription.
    // Quelqu'un qui a déjà ses deux équipes ne doit pas se voir redemander
    // d'ouvrir l'onglet — sinon la reprise ne sert à rien.
    const p = parcours([
      clic('onglet', '[data-tour="tab-equipes"]'),
      jalon('une équipe', (e) => e.teams.length >= 1),
      jalon('deux équipes', (e) => e.teams.length >= 2),
      lecture('bravo'),
    ]);
    expect(premiereEtapeUtile(p, VIDE)).toBe(0);
    expect(premiereEtapeUtile(p, { ...VIDE, teams: [{ id: 't1' }] as never })).toBe(2);
    expect(
      premiereEtapeUtile(p, { ...VIDE, teams: [{ id: 't1' }, { id: 't2' }] as never }),
    ).toBe(3);
  });

  it('un fait tardif fait sauter les gestes qui le précèdent', () => {
    // Le barrage est saisi : inutile de guider vers l'onglet des poules.
    const p = parcours([
      lecture('explication'),
      clic('onglet', '[data-tour="tab-poules"]'),
      jalon('barrage saisi', (e) => e.matches.length > 0),
      lecture('fin'),
    ]);
    expect(premiereEtapeUtile(p, { ...VIDE, matches: [{ id: 'm' }] as never })).toBe(3);
  });
});

describe('étape suivante', () => {
  it('avance d\'un cran', () => {
    const p = parcours([lecture('a'), lecture('b'), lecture('c')]);
    expect(etapeApres(p, 0, VIDE)).toBe(1);
    expect(etapeApres(p, 1, VIDE)).toBe(2);
  });

  it('termine à la dernière étape', () => {
    const p = parcours([lecture('a'), lecture('b')]);
    expect(etapeApres(p, 1, VIDE)).toBeNull();
  });

  it('saute les jalons obtenus au passage', () => {
    // L'utilisateur a saisi les trois scores d'un coup : on ne lui redemande
    // pas le deuxième.
    const p = parcours([
      lecture('intro'),
      jalon('score 1', (e) => e.matches.length >= 1),
      jalon('score 2', (e) => e.matches.length >= 1),
      lecture('fin'),
    ]);
    expect(etapeApres(p, 0, { ...VIDE, matches: [{ id: 'm' }] as never })).toBe(3);
  });

  it('termine quand tout ce qui suit est déjà acquis', () => {
    const p = parcours([lecture('intro'), jalon('fait', () => true)]);
    expect(etapeApres(p, 0, VIDE)).toBeNull();
  });
});

describe('phase de l\'étape', () => {
  it('une étape sans cible n\'attend rien', () => {
    expect(phaseEtape({ aUneCible: false, ciblePresente: false, attenteMs: 99999 })).toEqual({
      phase: 'guide',
    });
  });

  it('cible affichée : on guide', () => {
    expect(phaseEtape({ aUneCible: true, ciblePresente: true, attenteMs: 0 })).toEqual({
      phase: 'guide',
    });
  });

  it('cible pas encore là : on patiente au lieu de sauter l\'étape', () => {
    // Les poules n'existent pas avant le tirage : c'est le cas normal.
    expect(phaseEtape({ aUneCible: true, ciblePresente: false, attenteMs: 500 })).toEqual({
      phase: 'attente',
    });
  });

  it('au bout du délai, on admet que l\'utilisateur est ailleurs', () => {
    expect(
      phaseEtape({ aUneCible: true, ciblePresente: false, attenteMs: SEUIL_EGARE_MS }),
    ).toEqual({ phase: 'egare' });
  });

  it('le seuil est réglable', () => {
    expect(
      phaseEtape({ aUneCible: true, ciblePresente: false, attenteMs: 200, seuilMs: 100 }),
    ).toEqual({ phase: 'egare' });
  });
});

describe('parcours applicable', () => {
  it('un parcours de concours réclame un concours ouvert', () => {
    const p = parcours([lecture('a')], { besoinConcours: true });
    expect(parcoursApplicable(p, VIDE)).toBe(false);
    expect(parcoursApplicable(p, { ...VIDE, concours: concours() })).toBe(true);
  });

  it('un parcours général s\'ouvre partout', () => {
    expect(parcoursApplicable(parcours([lecture('a')]), VIDE)).toBe(true);
  });
});

describe('cibles d\'un parcours', () => {
  it('liste les sélecteurs, sans doublon ni null', () => {
    const p = parcours([
      lecture('a'),
      clic('b', '[data-tour="tab-poules"]'),
      clic('c', '[data-tour="tab-poules"]'),
      clic('d', '[data-tour="tirer-poules"]'),
    ]);
    expect(ciblesParcours(p).sort()).toEqual([
      '[data-tour="tab-poules"]',
      '[data-tour="tirer-poules"]',
    ]);
  });
});
