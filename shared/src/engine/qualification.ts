/**
 * Concours qualificatif (manuel « Gestion Concours » §3.D.2 et §3.D.7).
 *
 * Un qualificatif s'arrête dès que le nombre voulu d'équipes est atteint :
 * elles partent en phase finale, souvent à une autre date. Le logiciel fédéral
 * « calcule » le graphique correspondant ; dans un tableau à élimination
 * directe, cela revient à ne pas jouer les derniers tours.
 *
 * Conséquence assumée : le nombre de qualifiés doit être une puissance de deux
 * (2, 4, 8, 16…), ce qui est le cas d'une phase finale. Un nombre quelconque
 * demanderait un tour partiel — un cadrage — que cette version ne construit
 * pas ; `nbToursQualification` le refuse plutôt que de qualifier de travers.
 */
import type { Match, MatchStage } from '../types';
import { nextPow2 } from './bracket';
import { isByeMatch, winnerOf } from './match';

/**
 * Nombre de tours à jouer pour ne garder que `nbQualifies` équipes, ou `null`
 * si la demande n'est pas réalisable telle quelle.
 */
export function nbToursQualification(
  nbEntrants: number,
  nbQualifies: number,
): number | null {
  if (nbQualifies < 1 || nbEntrants < 1 || nbQualifies > nbEntrants) return null;
  // Puissance de deux : sinon le dernier tour ne tomberait pas juste.
  if ((nbQualifies & (nbQualifies - 1)) !== 0) return null;
  const taille = nextPow2(nbEntrants);
  return Math.log2(taille / nbQualifies);
}

/** Ne garde que les `nbTours` premiers tours d'un tableau. */
export function tronquerTableau(matches: Match[], nbTours: number): Match[] {
  return matches.filter((m) => m.round < nbTours);
}

/**
 * Équipes qualifiées à l'issue d'un tableau tronqué : les vainqueurs du
 * dernier tour existant. Un exempt a « gagné » sa partie sans jouer, il est
 * donc compté comme les autres. La liste est vide, puis partielle, jusqu'à ce
 * que le tour soit complet.
 */
export function qualifiesTableau(matches: Match[], stage: MatchStage): string[] {
  const ms = matches.filter((m) => m.stage === stage);
  if (ms.length === 0) return [];
  const dernier = Math.max(...ms.map((m) => m.round));
  return ms
    .filter((m) => m.round === dernier)
    .sort((a, b) => a.position - b.position)
    .map((m) => winnerOf(m))
    .filter((id): id is string => Boolean(id));
}

/** Le tableau est-il un qualificatif arrêté avant la finale ? */
export function estQualificatif(matches: Match[], stage: MatchStage): boolean {
  const ms = matches.filter((m) => m.stage === stage);
  if (ms.length === 0) return false;
  const dernier = Math.max(...ms.map((m) => m.round));
  // Une finale est seule dans son tour ; au-delà d'une partie, on qualifie.
  return ms.filter((m) => m.round === dernier).length > 1;
}

/** Nombre d'exempts du premier tour — utile pour annoncer la structure. */
export function nbExemptsPremierTour(matches: Match[], stage: MatchStage): number {
  return matches.filter((m) => m.stage === stage && m.round === 0 && isByeMatch(m)).length;
}
