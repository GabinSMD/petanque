/**
 * Besoin en terrains, annoncé avant le tirage (manuel « Gestion Concours »
 * §3.B.6).
 *
 * Le « Rapport avant tirage » du logiciel fédéral (copie d'écran p.28) ne se
 * contente pas de compter les équipes :
 *
 * ```
 * Nbre d'équipes inscrites:            32
 * La numérotation des équipes commence à 1
 * La numérotation des terrains commence à 1
 * Vous avez 16 terrains Disponibles
 * Vous aurez Besoin de 16 Terrains au maximum
 * ```
 *
 * C'est une information de terrain, au sens propre : un club à huit jeux qui
 * tire 32 équipes en poules en a besoin de seize au premier tour. Le savoir avant
 * le tirage évite de le découvrir quand les équipes attendent déjà.
 *
 * ## D'où vient le calcul
 *
 * La règle des poules était **déjà écrite** — dans `pouleSizes`, où elle sert à
 * choisir la répartition quand les terrains manquent : « une poule de 4 lance ses
 * deux premières parties en même temps, une poule de 3 une seule ». Elle était
 * simplement privée. La rendre publique garantit que le nombre annoncé est celui
 * du tirage qui suivra, et non un second calcul qui pourrait en différer.
 */
import type { Concours } from '../types';
import { pouleSizes } from './poules';

/**
 * Terrains occupés en même temps par une répartition de poules : deux par poule
 * de 4, un par poule de 3.
 */
export function terrainsSimultanes(tailles: number[]): number {
  return tailles.reduce((total, taille) => total + (taille >= 4 ? 2 : 1), 0);
}

export interface BesoinTerrains {
  /** Terrains nécessaires au moment le plus chargé. */
  necessaires: number;
  /** Terrains déclarés sur le concours ; 0 = non renseigné. */
  disponibles: number;
  /**
   * Les terrains déclarés suffisent-ils ? `undefined` quand aucun n'est déclaré :
   * la fenêtre fédérale accepte 0 comme « non renseigné », et on ne reproche pas
   * un manque qu'on ne peut pas constater.
   */
  suffisants?: boolean;
  /** Terrains manquants, 0 s'il n'en manque pas. */
  manquants: number;
}

/** Taille du tableau : la puissance de deux qui contient l'effectif. */
function tailleTableau(n: number): number {
  let taille = 1;
  while (taille < n) taille *= 2;
  return taille;
}

/**
 * Besoin maximal en terrains pour cet effectif, ou `undefined` quand la question
 * n'a pas de sens.
 *
 * Deux cas rendent `undefined` plutôt qu'un nombre :
 *
 *  - le **tir de précision**, qui se joue sur cinq ateliers et non sur des
 *    terrains — annoncer un nombre de terrains y serait trompeur ;
 *  - un **effectif que les poules refusent** (5 équipes, 0 équipe) : le tirage
 *    lui-même refusera, et un besoin inventé n'aiderait personne.
 *
 * Ce qui n'est pas pris en compte, et que je signale plutôt que de le passer sous
 * silence : le cadrage différé et les formules par groupes changent la composition
 * du premier tour. Le nombre reste alors un ordre de grandeur, calculé sur le
 * tableau plein.
 */
export function besoinTerrains(
  concours: Pick<Concours, 'mode' | 'nbTerrains'>,
  nbEquipes: number,
): BesoinTerrains | undefined {
  if (nbEquipes < 2) return undefined;

  let necessaires: number;
  switch (concours.mode) {
    case 'tir_precision':
      return undefined;
    case 'poules': {
      const tailles = pouleSizes(nbEquipes, concours.nbTerrains);
      if (!tailles) return undefined;
      necessaires = terrainsSimultanes(tailles);
      break;
    }
    case 'elimination_directe': {
      // Parties réellement jouées au premier tour : l'effectif moins les places
      // qui passent directement. Un tableau de 16 pour 12 équipes fait quatre
      // parties et quatre exemptes.
      necessaires = nbEquipes - tailleTableau(nbEquipes) / 2;
      break;
    }
    default: {
      // Formules en rondes : tout le monde joue, l'exempte éventuelle mise à
      // part — d'où l'arrondi vers le haut.
      necessaires = Math.ceil(nbEquipes / 2);
      break;
    }
  }

  const disponibles = concours.nbTerrains ?? 0;
  if (disponibles <= 0) {
    return { necessaires, disponibles: 0, manquants: 0 };
  }
  const manquants = Math.max(0, necessaires - disponibles);
  return { necessaires, disponibles, suffisants: manquants === 0, manquants };
}
