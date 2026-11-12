/**
 * Championnat des clubs et Coupe de France (manuel « Gestion Concours » §3.E).
 *
 * Ce module ne fait pas jouer la compétition : il contrôle qu'une composition
 * d'équipe est réglementaire, comme le fait le menu fédéral. Les critères
 * viennent des mêmes règles que le dépôt des licences, avec deux contingents
 * propres aux compétitions de clubs : les joueurs en mutation externe, dont le
 * contingent a trois positions — tous, un seul, aucun — et les joueurs étrangers
 * hors Union européenne, un seul par équipe.
 */
import type { CritereSexe } from '../types';
import type { CategorieCritere, CriteresLicence } from './licences';

/** Les 27 États membres, en codes ISO à trois et deux lettres. */
const UE = new Set([
  'AUT', 'BEL', 'BGR', 'CYP', 'CZE', 'DEU', 'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'GRC',
  'HRV', 'HUN', 'IRL', 'ITA', 'LTU', 'LUX', 'LVA', 'MLT', 'NLD', 'POL', 'PRT', 'ROU',
  'SVK', 'SVN', 'SWE',
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'ES', 'EE', 'FI', 'FR', 'GR',
  'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SK', 'SI', 'SE',
]);

/** Codes hors UE fréquents en pétanque, pour ne pas rester muet dessus. */
const HORS_UE = new Set([
  'CHE', 'CH', 'MAR', 'MA', 'TUN', 'TN', 'DZA', 'DZ', 'GBR', 'GB', 'TUR', 'TR',
  'SEN', 'SN', 'CIV', 'CI', 'MDG', 'MG', 'THA', 'TH', 'USA', 'US', 'CAN', 'CA',
  'NOR', 'NO', 'SRB', 'RS', 'MCO', 'MC', 'AND', 'AD',
]);

/**
 * Le joueur est-il hors Union européenne ? `null` quand la nationalité est
 * absente ou illisible : on ne disqualifie pas quelqu'un sur une valeur qu'on
 * ne sait pas interpréter — l'incertitude se signale, elle ne tranche pas.
 */
export function estHorsUE(nationalite: string | undefined): boolean | null {
  const code = nationalite?.trim().toUpperCase();
  if (!code) return null;
  if (UE.has(code)) return false;
  if (HORS_UE.has(code)) return true;
  return null;
}

export type CompetitionClubId =
  | 'coupe_de_france'
  | 'cnc_open'
  | 'cnc_feminin'
  | 'cnc_jeunes'
  | 'cnc_veterans'
  | 'cnc_plus55'
  | 'autre';

/**
 * Les trois positions du panneau « Mutations » de l'écran Championnat – Coupe
 * (manuel §3.E, planches p.112 à p.114) : **Tous / Limite 1 Externe / Aucune**.
 * Elles portent sur les joueurs en mutation **externe** — les cartes joueur
 * affichent « MUT.OK » ou « MUT.INT », et le voyant de l'équipe s'appelle
 * « Mutation ».
 *
 * Ce panneau était lu jusqu'ici comme un contingent d'étrangers hors UE, à cause
 * d'une légende du manuel qui mêle les deux (« Choix du nbre de joueurs mutés
 * dans l'équipe (étranger hors UE) »). Les étrangers hors UE relèvent d'une
 * autre règle, fixe : un seul par équipe (p.35, Critères France).
 *
 * « Aucune » est lu comme « aucune mutation externe » : une mutation interne au
 * comité ne compte dans aucune des trois positions. Lecture à confirmer sur un
 * règlement de division, le manuel ne le dit pas en toutes lettres.
 */
export type ContingentMutations = 'tous' | 'un_externe' | 'aucun';

const PLAFOND_MUTES_EXTERNES: Record<ContingentMutations, number | undefined> = {
  tous: undefined,
  un_externe: 1,
  aucun: 0,
};

/** « 1 seul joueur étranger Hors UE par équipe (même championnat des clubs et coupe de France) » */
const MAX_HORS_UE = 1;

export interface CompetitionClub {
  id: CompetitionClubId;
  label: string;
  /** Filtre prédéfini, comme les choix du menu fédéral. */
  sexe: CritereSexe;
  categorieAge?: CategorieCritere;
  /**
   * Homogénéité club exigée. Le manuel : « il faut Homogène club pour tous les
   * championnats sauf pour les championnats jeunes ».
   */
  homogene: boolean;
}

export const COMPETITIONS_CLUB: CompetitionClub[] = [
  { id: 'coupe_de_france', label: 'Coupe de France des clubs', sexe: 'tous', homogene: true },
  { id: 'cnc_open', label: 'CNC / CRC / CDC — Open', sexe: 'tous', homogene: true },
  { id: 'cnc_feminin', label: 'CNC / CRC / CDC — Féminin', sexe: 'feminin', homogene: true },
  {
    id: 'cnc_jeunes',
    label: 'CNC / CRC / CDC — Jeunes',
    sexe: 'tous',
    categorieAge: 'juniors',
    homogene: false,
  },
  {
    id: 'cnc_veterans',
    label: 'CNC / CRC / CDC — Vétérans',
    sexe: 'tous',
    categorieAge: 'veterans',
    homogene: true,
  },
  {
    id: 'cnc_plus55',
    label: 'CNC / CRC / CDC — +55',
    sexe: 'tous',
    categorieAge: 'plus55',
    homogene: true,
  },
  // « Sélection Championnat des Clubs autres (Jeunes, Vétérans, etc.) » et ses
  // « Filtres à définir selon le type de Championnat des clubs à contrôler »
  // (§3.E, planche p.113). Les valeurs ci-dessous ne sont que le point de
  // départ : la feuille porte ses propres filtres (`FiltresCompetition`).
  // Homogène par défaut, comme tous les championnats sauf les jeunes.
  { id: 'autre', label: 'Autre championnat de clubs', sexe: 'tous', homogene: true },
];

/**
 * Filtres libres d'un « autre » championnat de clubs (§3.E), réglés sur la
 * feuille de match. Ils reprennent exactement ce qu'une compétition prédéfinie
 * fixe — sexe, catégorie d'âge, homogénéité club — pour qu'un championnat que
 * la liste ne connaît pas (un CDC vétérans féminin, un championnat régional
 * jeunes homogène…) se contrôle avec les mêmes règles. Le contingent de
 * mutations reste à part : il se règle pour toutes les compétitions.
 */
export interface FiltresCompetition {
  sexe: CritereSexe;
  categorieAge?: CategorieCritere;
  homogene: boolean;
}

/**
 * La compétition telle qu'elle s'applique : la prédéfinie, ou pour « autre »
 * ses valeurs de départ recouvertes par les filtres de la feuille. Les filtres
 * sont ignorés pour une compétition prédéfinie — son règlement ne se discute
 * pas rencontre par rencontre.
 */
export function competitionClub(
  id: CompetitionClubId,
  filtres?: FiltresCompetition,
): CompetitionClub {
  const base = COMPETITIONS_CLUB.find((c) => c.id === id) ?? COMPETITIONS_CLUB[0]!;
  if (base.id !== 'autre' || !filtres) return base;
  return {
    ...base,
    sexe: filtres.sexe,
    categorieAge: filtres.categorieAge,
    homogene: filtres.homogene,
  };
}

/** Critères de contrôle d'une compétition, pour l'année et les quotas donnés. */
export function criteresCompetition(
  id: CompetitionClubId,
  annee: number,
  mutations: ContingentMutations = 'un_externe',
  dateRencontre?: string,
  filtres?: FiltresCompetition,
): CriteresLicence {
  const competition = competitionClub(id, filtres);
  return {
    annee,
    dateConcours: dateRencontre,
    sexe: competition.sexe,
    categorieAge: competition.categorieAge,
    // Jamais strict : une catégorie s'ouvre en dessous, une seule — c'est la
    // règle générale, appliquée dans `controlerEquipe`.
    strict: false,
    homogene: competition.homogene,
    maxMutes: PLAFOND_MUTES_EXTERNES[mutations],
    maxHorsUE: MAX_HORS_UE,
  };
}
