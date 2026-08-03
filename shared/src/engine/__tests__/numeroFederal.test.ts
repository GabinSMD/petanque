import { describe, expect, it } from 'vitest';
import {
  codeNiveauFederal,
  numeroConcoursFederal,
  nomDepuisNumero,
  segmentCategorie,
} from '../championnatCDF';

describe('segment de catégorie du numéro (§3.A)', () => {
  // Les dix segments lus sur les copies d'écran, chacun avec les critères que la
  // fenêtre affichait au même moment. C'est tout ce qui est attesté ; le reste
  // n'est pas deviné.
  it('formation seule quand rien n\'est demandé', () => {
    expect(segmentCategorie({ format: 'triplette' })).toBe('T');
    expect(segmentCategorie({ format: 'doublette' })).toBe('D');
    expect(segmentCategorie({ format: 'tete_a_tete' })).toBe('I');
  });

  it('vétéran : « TV »', () => {
    expect(segmentCategorie({ format: 'triplette', categorieAge: 'veterans' })).toBe('TV');
  });

  it('sénior mixte : « TSMixte » et « DSMixte »', () => {
    expect(
      segmentCategorie({ format: 'triplette', categorieAge: 'seniors', critereSexe: 'mixte' }),
    ).toBe('TSMixte');
    expect(
      segmentCategorie({ format: 'doublette', categorieAge: 'seniors', critereSexe: 'mixte' }),
    ).toBe('DSMixte');
  });

  it('promotion : « TSPromo » et « TPromo »', () => {
    expect(
      segmentCategorie({
        format: 'triplette',
        categorieAge: 'seniors',
        critereClassification: 'promotion',
      }),
    ).toBe('TSPromo');
    expect(
      segmentCategorie({ format: 'triplette', critereClassification: 'promotion' }),
    ).toBe('TPromo');
  });

  it('individuel masculin : « ISM » et « IJuniorM »', () => {
    expect(
      segmentCategorie({
        format: 'tete_a_tete',
        categorieAge: 'seniors',
        critereSexe: 'masculin',
      }),
    ).toBe('ISM');
    expect(
      segmentCategorie({
        format: 'tete_a_tete',
        categorieAge: 'juniors',
        critereSexe: 'masculin',
      }),
    ).toBe('IJuniorM');
  });

  it('rend `undefined` sur un critère dont l\'abréviation n\'est pas attestée', () => {
    // Aucune capture ne montre un concours féminin, cadet, minime, élite ou
    // honneur avec son numéro. Deviner « F » par symétrie avec « M » serait une
    // invention, et un numéro faux ne sert à personne : l'organisateur le
    // saisira.
    expect(segmentCategorie({ format: 'triplette', critereSexe: 'feminin' })).toBeUndefined();
    expect(segmentCategorie({ format: 'triplette', categorieAge: 'cadets' })).toBeUndefined();
    expect(segmentCategorie({ format: 'triplette', categorieAge: 'minimes' })).toBeUndefined();
    expect(
      segmentCategorie({ format: 'triplette', critereClassification: 'elite' }),
    ).toBeUndefined();
    expect(
      segmentCategorie({ format: 'triplette', critereClassification: 'honneur' }),
    ).toBeUndefined();
  });

  it('« tous » ne compte pas comme un critère', () => {
    expect(
      segmentCategorie({
        format: 'triplette',
        critereSexe: 'tous',
        critereClassification: 'tous',
      }),
    ).toBe('T');
  });
});

describe('code de niveau du numéro', () => {
  it('porte les trois codes attestés', () => {
    // `DEPT` : « Concours Départemental » (p.13). `CD` : « Championnat
    // Départemental » (p.14). `QUALIF_CD` : « Qualificatif Départemental »
    // (p.15).
    expect(codeNiveauFederal('departemental')).toBe('DEPT');
    expect(codeNiveauFederal('championnat')).toBe('CD');
  });

  it('ne rend rien sur un niveau dont le code n\'est pas attesté', () => {
    // Les cinq autres niveaux de la liste fédérale n'apparaissent sur aucune
    // capture avec leur code (voir #114). Un code inventé rendrait le numéro
    // méconnaissable pour le comité.
    expect(codeNiveauFederal('regional')).toBeUndefined();
    expect(codeNiveauFederal('national')).toBeUndefined();
    expect(codeNiveauFederal('international')).toBeUndefined();
    expect(codeNiveauFederal('coupe_de_france')).toBeUndefined();
    // Un concours de club n'est pas fédéral : il n'a pas de numéro.
    expect(codeNiveauFederal('club')).toBeUndefined();
    expect(codeNiveauFederal(undefined)).toBeUndefined();
  });
});

describe('nom du concours : le numéro avec des espaces', () => {
  it('reproduit l\'en-tête du manuel', () => {
    // Bandeau de la fenêtre de préparation : « Nom du Concours : 20260107 DEPT
    // PET 038 T 0423 », pour le numéro `20260107_DEPT_PET_038_T_0423`.
    expect(nomDepuisNumero('20260107_DEPT_PET_038_T_0423')).toBe(
      '20260107 DEPT PET 038 T 0423',
    );
  });

  it('ne rend rien sans numéro', () => {
    expect(nomDepuisNumero(undefined)).toBeUndefined();
    expect(nomDepuisNumero('')).toBeUndefined();
  });
});

describe('numéro complet, de bout en bout', () => {
  const params = {
    date: '2026-01-07',
    codeNiveau: 'DEPT',
    jeu: 'petanque' as const,
    comiteNumero: '038',
    segment: 'D',
    clubNumero: '0380103',
  };

  it('reproduit le bandeau de la fenêtre de préparation', () => {
    // Titre relevé p.19 : `20260107_DEPT_PET_038_D_0103`.
    expect(numeroConcoursFederal(params)).toBe('20260107_DEPT_PET_038_D_0103');
  });

  it('sans segment, pas de numéro', () => {
    expect(numeroConcoursFederal({ ...params, segment: '' })).toBeUndefined();
  });
});
