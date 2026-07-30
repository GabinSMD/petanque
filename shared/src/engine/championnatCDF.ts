/**
 * « Choix CDF » et numéro de concours (manuel « Gestion Concours » §3.A).
 *
 * J'avais classé ce point comme bloqué faute de savoir ce que ce champ
 * contenait. Il suffisait d'extraire les copies d'écran en pleine résolution :
 *
 *  - **p.14** montre la liste déroulante « Choix CDF » ouverte, avec ses onze
 *    catégories numérotées, de « 01-Triplette Senior Masculin » à
 *    « 11-Individuel Senior Féminin » ;
 *  - **p.14 (autre vue)** montre qu'en choisir une **remplit les paramètres** :
 *    « 09-Doublette Senior Mixte » met doublette, sénior *strict*, mixte,
 *    homogénéité OUI. Le manuel le disait en passant — « les paramètres sont
 *    mis automatiquement » — sans dire lesquels ;
 *  - **p.13** montre la fenêtre de validation et le fameux numéro :
 *    `20261217_DEPT_PET_038_T_0423`, soit le nom du concours avec le **numéro du
 *    club** (0423, le club 0380423 sans son préfixe de comité 038) à la place du
 *    nom du club.
 *
 * L'intérêt du préréglage n'est pas le confort : le manuel avertit qu'un
 * paramétrage validé ne se modifie plus (« si erreur supprimer le concours et le
 * recréer »). Choisir « Doublette Senior Mixte » dans une liste ferme la porte
 * aux quatre réglages contradictoires qu'il faudrait sinon poser à la main.
 *
 * Ce qui reste inféré, et que je signale plutôt que de le présenter comme
 * établi : le **segment de catégorie** du nom (`T`, `DSMixte`, `TPromo` sur les
 * trois exemples visibles) n'est pas documenté pour les autres combinaisons. Le
 * numéro se construit donc à partir du segment qu'on lui donne, sans prétendre
 * deviner l'abréviation fédérale de tous les cas.
 */
import type {
  CategorieAge,
  ConcoursMode,
  CritereClassification,
  CritereSexe,
  Discipline,
  NiveauConcours,
  TeamFormat,
} from '../types';

/** Paramètres qu'un championnat impose au concours. */
export interface ParametresCDF {
  format: TeamFormat;
  categorieAge: CategorieAge;
  /** Championnat : la catégorie est stricte, pas de repêchage des plus jeunes. */
  strict: boolean;
  critereSexe: CritereSexe;
  critereClassification: CritereClassification;
  /** Homogénéité club, exigée sauf en championnats jeunes (§3.C). */
  homogene: boolean;
  niveau: NiveauConcours;
}

export interface ChampionnatCDF {
  /** Code à deux chiffres de la liste fédérale. */
  code: string;
  label: string;
  parametres: ParametresCDF;
}

const base = (
  format: TeamFormat,
  categorieAge: CategorieAge,
  critereSexe: CritereSexe,
): ParametresCDF => ({
  format,
  categorieAge,
  strict: true,
  critereSexe,
  critereClassification: 'tous',
  // §3.C : « il faut Homogène club pour tous les championnats sauf pour les
  // championnats jeunes ».
  homogene: !['juniors', 'cadets', 'minimes', 'benjamins'].includes(categorieAge),
  niveau: 'championnat',
});

/**
 * Tir de précision. Même modèle, à une exception près qui vient de la copie
 * d'écran : « 18-Tir de Précision Junior Masculin » affiche **Homogénéité OUI**,
 * là où la règle des championnats jeunes de `base` la met à NON. Le tir se joue
 * seul — l'homogénéité d'une équipe d'un joueur ne coûte rien — et le manuel
 * l'affiche à OUI. On suit le manuel.
 */
const tir = (categorieAge: CategorieAge, critereSexe: CritereSexe): ParametresCDF => ({
  ...base('tete_a_tete', categorieAge, critereSexe),
  homogene: true,
});

/**
 * « Jeu » : le type de championnat, et non la discipline.
 *
 * Je l'avais pris pour la discipline en livrant le lot #101, faute d'avoir
 * ouvert les cinq copies d'écran de la p.15. Chacune montre la même fenêtre de
 * création avec un « Jeu » différent, et trois choses changent avec lui :
 *
 *  - la **liste « Choix CDF »** : 01 à 11 en pétanque, 14 et 15 en jeu
 *    provençal, 16 à 19 en tir de précision — et pour PROMOTION comme pour
 *    VETERANS la ligne **disparaît de la fenêtre**, elle n'est pas grisée ;
 *  - les **paramètres**, quand il n'y a pas de liste : VETERANS met triplette /
 *    vétéran strict, PROMOTION met triplette / sénior strict / classification
 *    Promotion-NC ;
 *  - le **code du numéro de concours** : `PET`, `PROMO`, `VET`, `PROV`, `TDP`.
 */
export type JeuFederal = 'petanque' | 'promotion' | 'veterans' | 'provencal' | 'tir_precision';

export interface Jeu {
  id: JeuFederal;
  /** Libellé de la liste déroulante, en capitales comme le logiciel fédéral. */
  label: string;
  /** Code du jeu dans le numéro de concours. */
  code: string;
  /** Codes « Choix CDF » proposés ; vide quand la ligne n'apparaît pas. */
  codesCDF: string[];
  /**
   * Paramètres que le jeu impose lui-même. Absents dès qu'il y a une liste : le
   * championnat choisi s'en charge, et deux sources pour les mêmes quatre
   * critères se contrediraient tôt ou tard.
   */
  parametres?: ParametresCDF;
}

export const JEUX_FEDERAUX: Jeu[] = [
  {
    id: 'petanque',
    label: 'PETANQUE',
    code: 'PET',
    codesCDF: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'],
  },
  {
    id: 'promotion',
    label: 'PROMOTION',
    code: 'PROMO',
    codesCDF: [],
    // Copie d'écran p.15 : Triplette, Sénior strict, Genre Tous, Classification
    // Promotion/NC, Homogénéité OUI. Numéro `20261217_CD_PROMO_038_TSPromo_…`.
    parametres: {
      format: 'triplette',
      categorieAge: 'seniors',
      strict: true,
      critereSexe: 'tous',
      critereClassification: 'promotion',
      homogene: true,
      niveau: 'championnat',
    },
  },
  {
    id: 'veterans',
    label: 'VETERANS',
    code: 'VET',
    codesCDF: [],
    // Copie d'écran p.15 : Triplette, Vétéran strict, Tous, Tous, OUI. Numéro
    // `20261217_CD_VET_038_TV_…`.
    parametres: {
      format: 'triplette',
      categorieAge: 'veterans',
      strict: true,
      critereSexe: 'tous',
      critereClassification: 'tous',
      homogene: true,
      niveau: 'championnat',
    },
  },
  { id: 'provencal', label: 'PROVENCAL', code: 'PROV', codesCDF: ['14', '15'] },
  {
    id: 'tir_precision',
    label: 'TIR DE PRECISION',
    code: 'TDP',
    codesCDF: ['16', '17', '18', '19'],
  },
];

/** Un jeu par son identifiant, ou `undefined` s'il n'existe pas. */
export function jeuFederal(id: JeuFederal): Jeu | undefined {
  return JEUX_FEDERAUX.find((j) => j.id === id);
}

/** Les championnats que ce jeu propose, dans l'ordre de sa liste déroulante. */
export function championnatsDuJeu(id: JeuFederal): ChampionnatCDF[] {
  const codes = jeuFederal(id)?.codesCDF ?? [];
  return codes
    .map((code) => CHAMPIONNATS_CDF.find((c) => c.code === code))
    .filter((c): c is ChampionnatCDF => Boolean(c));
}

/**
 * Les dix-sept championnats des listes « Choix CDF », dans l'ordre du manuel.
 *
 * Les codes **12 et 13 n'apparaissent dans aucune des cinq listes** ouvertes sur
 * les copies d'écran : la numérotation fédérale a un trou, et il reste un trou
 * plutôt que deux championnats devinés.
 */
export const CHAMPIONNATS_CDF: ChampionnatCDF[] = [
  { code: '01', label: 'Triplette Senior Masculin', parametres: base('triplette', 'seniors', 'masculin') },
  { code: '02', label: 'Triplette Senior Féminin', parametres: base('triplette', 'seniors', 'feminin') },
  { code: '03', label: 'Triplette Senior Mixte', parametres: base('triplette', 'seniors', 'mixte') },
  { code: '04', label: 'Triplette Junior', parametres: base('triplette', 'juniors', 'tous') },
  { code: '05', label: 'Triplette Cadet', parametres: base('triplette', 'cadets', 'tous') },
  { code: '06', label: 'Triplette Minime', parametres: base('triplette', 'minimes', 'tous') },
  { code: '07', label: 'Doublette Senior Masculin', parametres: base('doublette', 'seniors', 'masculin') },
  { code: '08', label: 'Doublette Senior Féminin', parametres: base('doublette', 'seniors', 'feminin') },
  { code: '09', label: 'Doublette Senior Mixte', parametres: base('doublette', 'seniors', 'mixte') },
  { code: '10', label: 'Individuel Senior Masculin', parametres: base('tete_a_tete', 'seniors', 'masculin') },
  { code: '11', label: 'Individuel Senior Féminin', parametres: base('tete_a_tete', 'seniors', 'feminin') },
  // Jeu provençal (liste ouverte sur la copie d'écran p.15). Elle ne donne que
  // la formation ; le reste suit le modèle des autres championnats — sénior
  // strict, ouvert, homogène — et c'est une inférence, pas un relevé.
  { code: '14', label: 'Triplette Jeu Provençal', parametres: base('triplette', 'seniors', 'tous') },
  { code: '15', label: 'Doublette Jeu Provençal', parametres: base('doublette', 'seniors', 'tous') },
  // Tir de précision : la fenêtre montre les paramètres appliqués — Individuel,
  // catégorie stricte, genre.
  { code: '16', label: 'Tir de Précision Senior Masculin', parametres: tir('seniors', 'masculin') },
  { code: '17', label: 'Tir de Précision Senior Féminin', parametres: tir('seniors', 'feminin') },
  { code: '18', label: 'Tir de Précision Junior Masculin', parametres: tir('juniors', 'masculin') },
  { code: '19', label: 'Tir de Précision Junior Féminin', parametres: tir('juniors', 'feminin') },
];

/** Paramètres d'un championnat, ou `undefined` si le code est inconnu. */
export function parametresCDF(code: string): ParametresCDF | undefined {
  return CHAMPIONNATS_CDF.find((c) => c.code === code)?.parametres;
}

/**
 * Retrouve le jeu d'un concours déjà enregistré.
 *
 * Le jeu n'est pas un champ en base, pour la même raison que le code CDF : il ne
 * sert qu'à remplir des critères qui, eux, sont enregistrés — en garder une
 * copie donnerait deux versions de la même chose, et l'une des deux finirait par
 * mentir. Il se relit donc du concours, ce qui suffit à afficher le bon numéro
 * quand on rouvre une fiche.
 *
 * L'ordre compte : la discipline et le mode nomment le concours, la
 * classification n'est qu'un critère.
 */
export function jeuDuConcours(c: {
  discipline?: Discipline;
  mode?: ConcoursMode;
  categorieAge?: CategorieAge;
  strict?: boolean;
  critereClassification?: CritereClassification;
}): JeuFederal {
  if (c.discipline === 'jeu_provencal') return 'provencal';
  if (c.mode === 'tir_precision') return 'tir_precision';
  // Vétérans **strict** seulement : hors strict, les plus âgés jouent chez les
  // vétérans sans que le concours soit le championnat vétéran.
  if (c.categorieAge === 'veterans' && c.strict) return 'veterans';
  if (c.critereClassification === 'promotion') return 'promotion';
  return 'petanque';
}

export interface ParamsNumeroFederal {
  /** Date au format YYYY-MM-DD. */
  date: string;
  /** Code de niveau tel que le manuel l'écrit : `DEPT`, `CD`, `REG`… */
  codeNiveau: string;
  /**
   * Type de championnat. C'est lui qui donne le code du numéro — `PET`, `PROMO`,
   * `VET`, `PROV`, `TDP` — et non la discipline : j'écrivais `JP` pour le jeu
   * provençal, que le manuel n'écrit nulle part.
   */
  jeu?: JeuFederal;
  /** Code du comité départemental, à trois chiffres (`038`). */
  comiteNumero?: string;
  /** Segment de catégorie du nom (`T`, `DSMixte`, `TPromo`…). */
  segment: string;
  /** Numéro fédéral du club, préfixe de comité compris (`0380423`). */
  clubNumero?: string;
}

/**
 * Numéro de concours tel que le montre la fenêtre de validation :
 * `AAAAMMJJ_niveau_jeu_comité_segment_club`, le club réduit à son numéro sans le
 * préfixe du comité.
 *
 * Rend `undefined` s'il manque le code du comité ou le numéro du club : un
 * numéro tronqué ne serait reconnu par personne, et mieux vaut ne rien afficher
 * que de faire croire à un identifiant fédéral.
 */
export function numeroConcoursFederal(p: ParamsNumeroFederal): string | undefined {
  if (!p.comiteNumero || !p.clubNumero) return undefined;
  const jour = p.date.replaceAll('-', '');
  const jeu = jeuFederal(p.jeu ?? 'petanque')?.code ?? 'PET';
  const club = p.clubNumero.startsWith(p.comiteNumero)
    ? p.clubNumero.slice(p.comiteNumero.length)
    : p.clubNumero;
  return [jour, p.codeNiveau, jeu, p.comiteNumero, p.segment, club].join('_');
}
