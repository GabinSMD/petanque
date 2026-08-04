import { describe, expect, it } from 'vitest';
import { nomConcoursFederal } from '../federal';
import type { JeuFederal } from '../championnatCDF';

const CLUB = 'P C PIERRE SEMARD';

/**
 * Les cinq premiers segments sont ceux du numéro ; seul le dernier diffère.
 *
 * Le `jeu` est un **identifiant** (`petanque`, `promotion`…), pas un code : c'est
 * ce que reçoit `numeroConcoursFederal`, et la vérification dans l'application a
 * montré que passer un code ici masquait le défaut — l'écran, lui, passe l'id.
 */
const nom = (codeNiveau: string, jeu: JeuFederal, segment: string, clubNom = CLUB): string =>
  nomConcoursFederal({
    date: '2026-12-17',
    codeNiveau,
    jeu,
    comiteNumero: '038',
    segment,
    clubNom,
  });

describe('nom du concours fédéral', () => {
  it('écrit les codes, et le club en clair entre guillemets', () => {
    // Le nom complet de la copie d'écran p.13, au caractère près.
    expect(nom('DEPT', 'petanque', 'T')).toBe('20261217_DEPT_PET_038_T_"P C PIERRE SEMARD"');
  });

  it('rend les huit autres noms complets attestés', () => {
    // Copies d'écran p.13 à p.15. Chacun vérifie un code de niveau, un code de
    // jeu ou un segment de catégorie différent.
    expect(nom('DEPT', 'promotion', 'TPromo')).toBe(
      '20261217_DEPT_PROMO_038_TPromo_"P C PIERRE SEMARD"',
    );
    expect(nom('CD', 'petanque', 'DSMixte')).toBe('20261217_CD_PET_038_DSMixte_"P C PIERRE SEMARD"');
    expect(nom('CD', 'promotion', 'TSPromo')).toBe(
      '20261217_CD_PROMO_038_TSPromo_"P C PIERRE SEMARD"',
    );
    expect(nom('CD', 'veterans', 'TV')).toBe('20261217_CD_VET_038_TV_"P C PIERRE SEMARD"');
    expect(nom('CD', 'provencal', 'T')).toBe('20261217_CD_PROV_038_T_"P C PIERRE SEMARD"');
    expect(nom('CD', 'tir_precision', 'I')).toBe('20261217_CD_TDP_038_I_"P C PIERRE SEMARD"');
    expect(nom('QUALIF_CD', 'tir_precision', 'ISM')).toBe(
      '20261217_QUALIF_CD_TDP_038_ISM_"P C PIERRE SEMARD"',
    );
    expect(nom('QUALIF_CD', 'tir_precision', 'IJuniorM')).toBe(
      '20261217_QUALIF_CD_TDP_038_IJuniorM_"P C PIERRE SEMARD"',
    );
  });

  it('normalise la date comme le numéro : sans tirets', () => {
    expect(nom('DEPT', 'petanque', 'T')).toContain('20261217_');
  });

  it('garde les séparateurs des segments manquants, comme l aperçu du manuel', () => {
    // La p.12 montre le nom se construire, séparateurs compris :
    // `20261217___038_T_` après le choix du comité, puis avec le club.
    // Le double tiret bas **est** l'information : il dit ce qui manque.
    expect(
      nomConcoursFederal({
        date: '2026-12-17',
        codeNiveau: '',
        jeu: undefined,
        comiteNumero: '038',
        segment: 'T',
        clubNom: '',
      }),
    ).toBe('20261217___038_T_');
  });

  it('montre le segment manquant par un double tiret bas', () => {
    // `20261217_CD_PET_038__"P C PIERRE SEMARD"` — attesté p.14.
    expect(nom('CD', 'petanque', '')).toBe('20261217_CD_PET_038__"P C PIERRE SEMARD"');
  });

  it('n habille pas le nom du club : ni majuscules forcées, ni tirets', () => {
    // Le numéro porte le **code** du club ; le nom porte son **nom**, tel quel.
    // Le passer par `motFederal` en ferait `PC-PIERRE-SEMARD`, ce que le manuel
    // n'écrit nulle part.
    expect(nom('DEPT', 'petanque', 'T', 'PC Pierre Sémard')).toBe(
      '20261217_DEPT_PET_038_T_"PC Pierre Sémard"',
    );
  });

  it('sans club, pas de guillemets vides', () => {
    expect(nom('DEPT', 'petanque', 'T', '')).toBe('20261217_DEPT_PET_038_T_');
  });
});
