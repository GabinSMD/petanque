/**
 * Paramètres fédéraux d'un concours (manuel « Gestion Concours » §3.A) :
 * numérotation décalée et nom construit automatiquement.
 */
import type { Discipline, NiveauConcours, TeamFormat } from '../types';

/**
 * Numéro de la prochaine équipe. Le décalage sert quand un club enchaîne
 * plusieurs concours le même jour : équipes 1.., 101.., 201.., pour qu'il n'y
 * ait jamais deux « équipe 1 » à la table de marque (manuel §3.A zone 6).
 */
export function numeroPremiereEquipe(
  numerosExistants: number[],
  decalage: number | undefined,
): number {
  if (numerosExistants.length > 0) return Math.max(...numerosExistants) + 1;
  return (decalage ?? 0) + 1;
}

const NIVEAU_MOTS: Record<NiveauConcours, string> = {
  club: 'CLUB',
  departemental: 'DEPARTEMENTAL',
  regional: 'REGIONAL',
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
  championnat: 'CHAMPIONNAT',
  coupe_de_france: 'COUPE-DE-FRANCE',
};

const FORMATION_MOTS: Record<TeamFormat, string> = {
  tete_a_tete: 'TETE-A-TETE',
  doublette: 'DOUBLETTE',
  triplette: 'TRIPLETTE',
};

/** Majuscules sans accent, espaces et ponctuation ramenés à des tirets. */
function motFederal(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ParamsNomFederal {
  /** Date au format YYYY-MM-DD. */
  date: string;
  niveau?: NiveauConcours;
  discipline?: Discipline;
  /** Comité départemental organisateur. */
  comite?: string;
  format: TeamFormat;
  /** Club organisateur. */
  club?: string;
}

/**
 * Nom du concours tel que le construit le logiciel fédéral :
 * date_niveau_jeu_comité_formation_club. Ce qui n'est pas renseigné est
 * simplement omis.
 */
export function nomConcoursFederal(p: ParamsNomFederal): string {
  const parties = [
    p.date,
    p.niveau ? NIVEAU_MOTS[p.niveau] : '',
    p.discipline === 'jeu_provencal' ? 'JEU-PROVENCAL' : p.discipline ? 'PETANQUE' : '',
    p.comite ? motFederal(p.comite) : '',
    FORMATION_MOTS[p.format],
    p.club ? motFederal(p.club) : '',
  ];
  return parties.filter(Boolean).join('_');
}
