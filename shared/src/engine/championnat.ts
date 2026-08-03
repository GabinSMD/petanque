/**
 * Championnat des clubs et Coupe de France (manuel « Gestion Concours » §3.E).
 *
 * Ce module ne fait pas jouer la compétition : il contrôle qu'une composition
 * d'équipe est réglementaire, comme le fait le menu fédéral. Les critères
 * viennent des mêmes règles que le dépôt des licences, avec deux contingents
 * propres aux compétitions de clubs : les joueurs mutés, dont le nombre est
 * fixé par l'organisateur, et les joueurs étrangers hors Union européenne, dont
 * le contingent a trois positions — tous, un seul, aucun.
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
  | 'cnc_plus55';

/**
 * Les trois positions du contingent d'étrangers hors Union européenne. Le manuel
 * (§3.E, p.113) : « Choix du nbre de joueurs mutés dans l'équipe (étranger hors
 * UE) », et le panneau offre **Tous / Limite 1 Externe / Aucune**. La limite
 * d'un seul était codée en dur ici : les deux autres positions étaient
 * inatteignables.
 */
export type ContingentHorsUE = 'tous' | 'un_externe' | 'aucun';

const PLAFOND_HORS_UE: Record<ContingentHorsUE, number | undefined> = {
  tous: undefined,
  un_externe: 1,
  aucun: 0,
};

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
];

/** Critères de contrôle d'une compétition, pour l'année et les quotas donnés. */
export function criteresCompetition(
  id: CompetitionClubId,
  annee: number,
  maxMutes: number,
  dateRencontre?: string,
  horsUE: ContingentHorsUE = 'un_externe',
): CriteresLicence {
  const competition = COMPETITIONS_CLUB.find((c) => c.id === id) ?? COMPETITIONS_CLUB[0]!;
  return {
    annee,
    dateConcours: dateRencontre,
    sexe: competition.sexe,
    categorieAge: competition.categorieAge,
    // Jamais strict : une catégorie s'ouvre en dessous, une seule — c'est la
    // règle générale, appliquée dans `controlerEquipe`.
    strict: false,
    homogene: competition.homogene,
    maxMutes,
    maxHorsUE: PLAFOND_HORS_UE[horsUE],
  };
}
