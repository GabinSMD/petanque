import { describe, expect, it } from 'vitest';
import {
  CHAMPIONNATS_CDF,
  numeroConcoursFederal,
  parametresCDF,
} from '../championnatCDF';

describe('choix CDF : les championnats du manuel (§3.A)', () => {
  it('porte les onze catégories de la liste déroulante', () => {
    // Relevé sur la copie d'écran p.14 : de « 01-Triplette Senior Masculin » à
    // « 11-Individuel Senior Féminin ».
    expect(CHAMPIONNATS_CDF).toHaveLength(11);
    expect(CHAMPIONNATS_CDF[0]!.code).toBe('01');
    expect(CHAMPIONNATS_CDF[0]!.label).toBe('Triplette Senior Masculin');
    expect(CHAMPIONNATS_CDF[10]!.code).toBe('11');
    expect(CHAMPIONNATS_CDF[10]!.label).toBe('Individuel Senior Féminin');
  });

  it('remplit les paramètres, comme le fait le logiciel fédéral', () => {
    // Copie d'écran p.14 : « 09-Doublette Senior Mixte » sélectionné met
    // doublette, sénior **strict**, mixte, homogénéité OUI.
    expect(parametresCDF('09')).toEqual({
      format: 'doublette',
      categorieAge: 'seniors',
      strict: true,
      critereSexe: 'mixte',
      critereClassification: 'tous',
      homogene: true,
      niveau: 'championnat',
    });
  });

  it('distingue les formations et les genres', () => {
    expect(parametresCDF('01')!.format).toBe('triplette');
    expect(parametresCDF('01')!.critereSexe).toBe('masculin');
    expect(parametresCDF('02')!.critereSexe).toBe('feminin');
    expect(parametresCDF('07')!.format).toBe('doublette');
    expect(parametresCDF('10')!.format).toBe('tete_a_tete');
  });

  it('porte les catégories de jeunes avec leur âge', () => {
    expect(parametresCDF('04')!.categorieAge).toBe('juniors');
    expect(parametresCDF('05')!.categorieAge).toBe('cadets');
    expect(parametresCDF('06')!.categorieAge).toBe('minimes');
  });

  it('impose l\'homogénéité : un championnat se joue en club', () => {
    // §3.C : « il faut Homogène club pour tous les championnats sauf pour les
    // championnats jeunes ».
    expect(parametresCDF('01')!.homogene).toBe(true);
    expect(parametresCDF('04')!.homogene).toBe(false);
    expect(parametresCDF('05')!.homogene).toBe(false);
    expect(parametresCDF('06')!.homogene).toBe(false);
  });

  it('ne rend rien sur un code inconnu', () => {
    expect(parametresCDF('99')).toBeUndefined();
    expect(parametresCDF('')).toBeUndefined();
  });
});

describe('numéro de concours (§3.A, copie d\'écran p.13)', () => {
  it('reproduit l\'exemple du manuel', () => {
    // La fenêtre de validation affiche « 20261217_DEPT_PET_038_T_0423 » pour un
    // concours départemental en triplette du club 0380423, comité 038.
    expect(
      numeroConcoursFederal({
        date: '2026-12-17',
        codeNiveau: 'DEPT',
        discipline: 'petanque',
        comiteNumero: '038',
        segment: 'T',
        clubNumero: '0380423',
      }),
    ).toBe('20261217_DEPT_PET_038_T_0423');
  });

  it('retire le préfixe du comité du numéro de club', () => {
    // Le club 0380423 du comité 038 s'écrit « 0423 » : c'est ce que montre la
    // fenêtre.
    expect(
      numeroConcoursFederal({
        date: '2026-12-17',
        codeNiveau: 'CD',
        discipline: 'petanque',
        comiteNumero: '038',
        segment: 'DSMixte',
        clubNumero: '0380423',
      }),
    ).toBe('20261217_CD_PET_038_DSMixte_0423');
  });

  it('écrit la date en AAAAMMJJ', () => {
    const numero = numeroConcoursFederal({
      date: '2026-01-05',
      codeNiveau: 'DEPT',
      discipline: 'petanque',
      comiteNumero: '026',
      segment: 'T',
      clubNumero: '0260100',
    });
    expect(numero?.startsWith('20260105_')).toBe(true);
  });

  it('dit le jeu provençal autrement', () => {
    const numero = numeroConcoursFederal({
      date: '2026-12-17',
      codeNiveau: 'DEPT',
      discipline: 'jeu_provencal',
      comiteNumero: '038',
      segment: 'T',
      clubNumero: '0380423',
    });
    expect(numero ?? '').toContain('_JP_');
  });

  it('rend `undefined` quand il manque un code : pas de numéro inventé', () => {
    // Sans numéro de club ni code de comité, le numéro fédéral n'existe pas —
    // mieux vaut ne rien afficher que quelque chose que le comité ne reconnaît
    // pas.
    expect(
      numeroConcoursFederal({
        date: '2026-12-17',
        codeNiveau: 'DEPT',
        discipline: 'petanque',
        segment: 'T',
      }),
    ).toBeUndefined();
  });
});
