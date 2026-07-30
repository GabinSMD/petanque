/**
 * Insérer une équipe à un dossard donné (manuel §3.B.1, zone 24 : « Insérer une
 * nouvelle équipe : permet d'insérer une équipe avant celle affichée »).
 *
 * Nous ajoutions toujours à la suite. Le cas réel : une équipe oubliée dont
 * l'étiquette numérotée est déjà distribuée, ou une numérotation qu'on veut
 * garder groupée par club. Insérer suppose alors de **décaler** les dossards
 * suivants — et de refuser un dossard qui laisserait un trou, parce qu'un trou
 * se paie à l'appel au micro.
 *
 * Ce module ne calcule que le renumérotage. L'écriture, elle, vérifie que le
 * tirage n'est pas fait : après, §3.B.8 interdit de toucher aux dossards (voir
 * `apresTirage.ts`).
 */
import type { Team } from '../types';

/** Prochain dossard libre : celui qu'on propose par défaut. */
export function placeLibreApres(teams: Team[]): number {
  if (teams.length === 0) return 1;
  return Math.max(...teams.map((t) => t.number)) + 1;
}

/**
 * Dossards à réécrire pour insérer une équipe au dossard `dossard` : toutes les
 * équipes dont le numéro est supérieur ou égal montent d'un cran.
 *
 * Les dossards non contigus — une suppression en laisse — sont respectés tels
 * quels : on décale ce qui existe, on ne comble pas les trous au passage.
 */
export function renumeroterPourInsertion(
  teams: Team[],
  dossard: number,
): { id: string; number: number }[] {
  const premier = teams.length === 0 ? 1 : Math.min(...teams.map((t) => t.number));
  const libre = placeLibreApres(teams);
  if (!Number.isInteger(dossard) || dossard < premier || dossard > libre) {
    throw new Error(
      `Dossard ${dossard} impossible : choisissez un dossard entre ${premier} et ${libre}.`,
    );
  }
  return teams
    .filter((t) => t.number >= dossard)
    .sort((a, b) => a.number - b.number)
    .map((t) => ({ id: t.id, number: t.number + 1 }));
}
