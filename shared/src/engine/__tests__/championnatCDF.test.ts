import { describe, expect, it } from 'vitest';
import {
  CHAMPIONNATS_CDF,
  JEUX_FEDERAUX,
  championnatsDuJeu,
  jeuDuConcours,
  jeuFederal,
  numeroConcoursFederal,
  parametresCDF,
  type JeuFederal,
} from '../championnatCDF';

describe('choix CDF : les championnats du manuel (§3.A)', () => {
  it('porte les dix-sept championnats des listes déroulantes', () => {
    // Relevé sur les copies d'écran p.14 et p.15, une liste par « Jeu » :
    // pétanque 01 à 11, jeu provençal 14 et 15, tir de précision 16 à 19.
    expect(CHAMPIONNATS_CDF).toHaveLength(17);
    expect(CHAMPIONNATS_CDF[0]!.code).toBe('01');
    expect(CHAMPIONNATS_CDF[0]!.label).toBe('Triplette Senior Masculin');
    expect(CHAMPIONNATS_CDF.at(-1)!.code).toBe('19');
    expect(CHAMPIONNATS_CDF.at(-1)!.label).toBe('Tir de Précision Junior Féminin');
  });

  it('n\'invente pas les codes 12 et 13', () => {
    // Ils ne figurent dans aucune des cinq listes ouvertes sur les copies
    // d'écran. Un trou dans la numérotation fédérale se laisse en trou.
    const codes = CHAMPIONNATS_CDF.map((c) => c.code);
    expect(codes).not.toContain('12');
    expect(codes).not.toContain('13');
    expect(parametresCDF('12')).toBeUndefined();
    expect(parametresCDF('13')).toBeUndefined();
  });

  it('porte le jeu provençal, en triplette et en doublette', () => {
    expect(parametresCDF('14')!.format).toBe('triplette');
    expect(parametresCDF('15')!.format).toBe('doublette');
  });

  it('porte le tir de précision, individuel et strict', () => {
    // Copie d'écran p.15 : « 16-Tir de Précision Senior Masculin » met
    // Individuel, Sénior *strict*, Masculin, homogénéité OUI.
    expect(parametresCDF('16')).toEqual({
      format: 'tete_a_tete',
      categorieAge: 'seniors',
      strict: true,
      critereSexe: 'masculin',
      critereClassification: 'tous',
      homogene: true,
      niveau: 'championnat',
    });
    expect(parametresCDF('17')!.critereSexe).toBe('feminin');
    // « 18-Tir de Précision Junior Masculin » : Individuel, Junior strict.
    expect(parametresCDF('18')!.categorieAge).toBe('juniors');
    expect(parametresCDF('18')!.critereSexe).toBe('masculin');
    expect(parametresCDF('19')!.categorieAge).toBe('juniors');
    expect(parametresCDF('19')!.critereSexe).toBe('feminin');
  });

  it('le tir de précision junior reste homogène, contre la règle des jeunes', () => {
    // La copie d'écran de « 18-Tir de Précision Junior Masculin » affiche
    // Homogénéité **OUI**, là où les championnats jeunes de pétanque sont à NON.
    // Le manuel tranche, pas notre règle générale.
    expect(parametresCDF('18')!.homogene).toBe(true);
    expect(parametresCDF('19')!.homogene).toBe(true);
    expect(parametresCDF('04')!.homogene).toBe(false);
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
        jeu: 'petanque',
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
        jeu: 'petanque',
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
      jeu: 'petanque',
      comiteNumero: '026',
      segment: 'T',
      clubNumero: '0260100',
    });
    expect(numero?.startsWith('20260105_')).toBe(true);
  });

  it('écrit le code du jeu que montrent les copies d\'écran', () => {
    // p.15 : `_PROV_` pour le jeu provençal, `_VET_` pour les vétérans,
    // `_PROMO_` pour la promotion, `_TDP_` pour le tir de précision, `_PET_`
    // pour la pétanque. J'avais écrit `_JP_`, que le manuel n'écrit nulle part.
    const numero = (jeu: JeuFederal): string =>
      numeroConcoursFederal({
        date: '2026-12-17',
        codeNiveau: 'CD',
        jeu,
        comiteNumero: '038',
        segment: 'T',
        clubNumero: '0380423',
      }) ?? '';
    expect(numero('provencal')).toContain('_PROV_');
    expect(numero('provencal')).not.toContain('_JP_');
    expect(numero('veterans')).toContain('_VET_');
    expect(numero('promotion')).toContain('_PROMO_');
    expect(numero('tir_precision')).toContain('_TDP_');
    expect(numero('petanque')).toContain('_PET_');
  });

  it('rend `undefined` quand il manque un code : pas de numéro inventé', () => {
    // Sans numéro de club ni code de comité, le numéro fédéral n'existe pas —
    // mieux vaut ne rien afficher que quelque chose que le comité ne reconnaît
    // pas.
    expect(
      numeroConcoursFederal({
        date: '2026-12-17',
        codeNiveau: 'DEPT',
        jeu: 'petanque',
        segment: 'T',
      }),
    ).toBeUndefined();
  });
});

describe('« Jeu » : le type de championnat (§3.A, copies d\'écran p.14-15)', () => {
  it('porte les cinq valeurs de la liste', () => {
    expect(JEUX_FEDERAUX.map((j) => j.id)).toEqual([
      'petanque',
      'promotion',
      'veterans',
      'provencal',
      'tir_precision',
    ]);
    expect(JEUX_FEDERAUX.map((j) => j.label)).toEqual([
      'PETANQUE',
      'PROMOTION',
      'VETERANS',
      'PROVENCAL',
      'TIR DE PRECISION',
    ]);
  });

  it('chaque jeu a son code dans le numéro de concours', () => {
    expect(jeuFederal('petanque')!.code).toBe('PET');
    expect(jeuFederal('promotion')!.code).toBe('PROMO');
    expect(jeuFederal('veterans')!.code).toBe('VET');
    expect(jeuFederal('provencal')!.code).toBe('PROV');
    expect(jeuFederal('tir_precision')!.code).toBe('TDP');
  });

  it('chaque jeu n\'offre que ses championnats', () => {
    // La liste « Choix CDF » change avec le jeu : c'est ce que montrent les cinq
    // copies d'écran, listes ouvertes.
    expect(championnatsDuJeu('petanque').map((c) => c.code)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11',
    ]);
    expect(championnatsDuJeu('provencal').map((c) => c.code)).toEqual(['14', '15']);
    expect(championnatsDuJeu('tir_precision').map((c) => c.code)).toEqual([
      '16', '17', '18', '19',
    ]);
  });

  it('promotion et vétérans n\'ont pas de liste : la ligne disparaît', () => {
    // Sur ces deux copies d'écran, la ligne « Choix CDF » n'est pas grisée : elle
    // n'existe pas. Les paramètres viennent directement du jeu.
    expect(championnatsDuJeu('promotion')).toEqual([]);
    expect(championnatsDuJeu('veterans')).toEqual([]);
  });

  it('« VETERANS » impose triplette vétéran strict', () => {
    expect(jeuFederal('veterans')!.parametres).toEqual({
      format: 'triplette',
      categorieAge: 'veterans',
      strict: true,
      critereSexe: 'tous',
      critereClassification: 'tous',
      homogene: true,
      niveau: 'championnat',
    });
  });

  it('« PROMOTION » impose la classification promotion', () => {
    const p = jeuFederal('promotion')!.parametres!;
    expect(p.critereClassification).toBe('promotion');
    expect(p.format).toBe('triplette');
    expect(p.categorieAge).toBe('seniors');
    expect(p.strict).toBe(true);
  });

  it('les jeux à liste n\'imposent rien d\'eux-mêmes', () => {
    // Le championnat choisi s'en charge : préremplir en plus ferait deux sources
    // de vérité pour les mêmes quatre critères.
    expect(jeuFederal('petanque')!.parametres).toBeUndefined();
    expect(jeuFederal('provencal')!.parametres).toBeUndefined();
    expect(jeuFederal('tir_precision')!.parametres).toBeUndefined();
  });

  it('ne rend rien sur un jeu inconnu', () => {
    expect(jeuFederal('belote' as JeuFederal)).toBeUndefined();
    expect(championnatsDuJeu('belote' as JeuFederal)).toEqual([]);
  });
});

describe('déduire le jeu d\'un concours enregistré', () => {
  // Le jeu n'est pas un champ en base : comme le code CDF, il ne sert qu'à
  // remplir des critères qui, eux, sont enregistrés. Il se relit donc à partir
  // de ce concours-là, pour que le numéro affiché reste juste quand on rouvre
  // une fiche.
  it('le jeu provençal se lit sur la discipline', () => {
    expect(jeuDuConcours({ discipline: 'jeu_provencal' })).toBe('provencal');
  });

  it('le tir de précision se lit sur le mode', () => {
    expect(jeuDuConcours({ mode: 'tir_precision' })).toBe('tir_precision');
  });

  it('un championnat vétéran strict est un concours « VETERANS »', () => {
    expect(jeuDuConcours({ categorieAge: 'veterans', strict: true })).toBe('veterans');
  });

  it('une catégorie vétéran non stricte ne l\'est pas', () => {
    // Hors mode strict, les plus âgés jouent chez les vétérans mais le concours
    // n'est pas le championnat vétéran du logiciel fédéral.
    expect(jeuDuConcours({ categorieAge: 'veterans', strict: false })).toBe('petanque');
  });

  it('la classification promotion donne « PROMOTION »', () => {
    expect(jeuDuConcours({ critereClassification: 'promotion' })).toBe('promotion');
  });

  it('à défaut, c\'est la pétanque', () => {
    expect(jeuDuConcours({})).toBe('petanque');
    expect(jeuDuConcours({ discipline: 'petanque', mode: 'poules' })).toBe('petanque');
  });

  it('la discipline passe devant la classification', () => {
    // Un provençal promotion reste un provençal : c'est le jeu qui nomme le
    // concours, la classification n'est qu'un critère.
    expect(
      jeuDuConcours({ discipline: 'jeu_provencal', critereClassification: 'promotion' }),
    ).toBe('provencal');
  });
});
