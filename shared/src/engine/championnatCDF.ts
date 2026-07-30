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

/** Les onze championnats de la liste « Choix CDF », dans l'ordre du manuel. */
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
];

/** Paramètres d'un championnat, ou `undefined` si le code est inconnu. */
export function parametresCDF(code: string): ParametresCDF | undefined {
  return CHAMPIONNATS_CDF.find((c) => c.code === code)?.parametres;
}

export interface ParamsNumeroFederal {
  /** Date au format YYYY-MM-DD. */
  date: string;
  /** Code de niveau tel que le manuel l'écrit : `DEPT`, `CD`, `REG`… */
  codeNiveau: string;
  discipline?: Discipline;
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
  const jeu = p.discipline === 'jeu_provencal' ? 'JP' : 'PET';
  const club = p.clubNumero.startsWith(p.comiteNumero)
    ? p.clubNumero.slice(p.comiteNumero.length)
    : p.clubNumero;
  return [jour, p.codeNiveau, jeu, p.comiteNumero, p.segment, club].join('_');
}
