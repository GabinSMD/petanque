import type { Match } from '../types';
import { isByeMatch } from './match';

/**
 * Gestion dynamique des terrains : quelles parties sont « en cours »
 * (prêtes, non terminées), quels terrains sont occupés/libres, et
 * affectation automatique des parties en attente aux terrains libres.
 */

/** Une partie occupe un terrain si elle est prête (deux camps) et non finie. */
export function isLiveMatch(m: Match): boolean {
  if (m.done || isByeMatch(m)) return false;
  const aKnown = Boolean(m.teamAId || (m.playersA && m.playersA.length));
  const bKnown = Boolean(m.teamBId || (m.playersB && m.playersB.length));
  return aKnown && bKnown;
}

export interface TerrainState {
  number: number;
  match: Match | null;
  /**
   * Terrain retiré du jeu à la main : flaque d'eau, jeu réservé, sanitaires
   * voisins… (manuel §3.D.1.B.5.2). Il reste affiché — l'organisateur doit
   * voir *pourquoi* il ne sert pas — mais l'affectation l'ignore.
   */
  bloque: boolean;
}

/**
 * Numéros des terrains du concours. Le décalage sert quand plusieurs
 * concours partagent le boulodrome le même jour : terrains 1.., 51.., 101…
 * (manuel §3.A zone 7).
 */
export function terrainNumeros(nbTerrains: number, decalage = 0): number[] {
  const out: number[] = [];
  for (let i = 1; i <= nbTerrains; i++) out.push(decalage + i);
  return out;
}

/** État des `nbTerrains` terrains : la partie live occupant chacun, ou null. */
export function terrainBoard(
  matches: Match[],
  nbTerrains: number,
  decalage = 0,
  bloques: number[] = [],
): TerrainState[] {
  const live = matches.filter(isLiveMatch);
  const byTerrain = new Map<number, Match>();
  for (const m of live) {
    if (m.terrain && m.terrain >= 1) byTerrain.set(m.terrain, m);
  }
  const interdits = new Set(bloques);
  return terrainNumeros(nbTerrains, decalage).map((n) => ({
    number: n,
    match: byTerrain.get(n) ?? null,
    bloque: interdits.has(n),
  }));
}

/**
 * Les deux jeux d'une poule, selon la convention fédérale rappelée au
 * §3.D.1.A : « les parties du haut, terrains du haut — les parties du bas,
 * terrains du bas ». La poule 1 occupe les jeux 1 et 2, la poule 2 les jeux 3
 * et 4, et ainsi de suite : les gagnants jouent sur l'impair, les perdants et
 * le barrage sur le pair.
 */
export function terrainsPoule(pouleIndex: number, decalage = 0): { haut: number; bas: number } {
  return { haut: decalage + pouleIndex * 2 - 1, bas: decalage + pouleIndex * 2 };
}

/** Parties live sans terrain affecté (en attente d'un terrain). */
export function waitingMatches(matches: Match[]): Match[] {
  return matches
    .filter((m) => isLiveMatch(m) && (!m.terrain || m.terrain < 1))
    .sort(
      (a, b) =>
        stageOrder(a) - stageOrder(b) || a.round - b.round || a.position - b.position,
    );
}

function stageOrder(m: Match): number {
  const order: Record<string, number> = { poule: 0, ronde: 1, principal: 2, consolante: 3 };
  return order[m.stage] ?? 9;
}

/** Numéros de terrains libres : ni occupés, ni bloqués. */
export function freeTerrains(
  matches: Match[],
  nbTerrains: number,
  decalage = 0,
  bloques: number[] = [],
): number[] {
  const occupied = new Set(
    matches.filter(isLiveMatch).map((m) => m.terrain).filter((t): t is number => Boolean(t)),
  );
  const interdits = new Set(bloques);
  return terrainNumeros(nbTerrains, decalage).filter(
    (n) => !occupied.has(n) && !interdits.has(n),
  );
}

/**
 * Terrains libres, classés selon que les deux équipes y ont déjà joué ou non
 * (manuel §3.D, écran « Match à lancer », copie d'écran p.45).
 */
export interface TerrainsClasses {
  /** Aucune des deux équipes n'y a joué : à servir en premier. */
  neufs: number[];
  /** Au moins une des deux y a déjà joué : second recours. */
  dejaJoues: number[];
}

/**
 * Terrains sur lesquels une équipe a déjà été envoyée — **cette** équipe et
 * aucune autre. Le sabotage a montré que c'est le point fragile : sans ce
 * contrôle, la règle se dégrade en « ne jamais réutiliser un terrain que
 * quiconque a joué », plus un seul terrain n'est neuf après un tour, et elle
 * devient un no-op silencieux.
 *
 * Toute partie qui a porté un numéro de terrain compte, terminée ou en cours :
 * une équipe qui est sur le terrain 3 en ce moment l'a bien joué. Le `!m.terrain`
 * ne garde rien de réel — un terrain n'est jamais 0 — il rétrécit le type ; le
 * sabotage confirme que son retrait ne change aucun comportement.
 */
function terrainsJoues(matches: Match[], teamId: string | null | undefined): Set<number> {
  const out = new Set<number>();
  if (!teamId) return out;
  for (const m of matches) {
    if (!m.terrain) continue;
    if (m.teamAId === teamId || m.teamBId === teamId) out.add(m.terrain);
  }
  return out;
}

/**
 * Classe des terrains libres pour une partie donnée.
 *
 * L'écran fédéral « Match à lancer » ne propose pas les terrains dans une seule
 * liste : ceux qu'une des deux équipes a déjà joués sortent de la liste
 * sélectionnable et vont dans un encadré à part, titré **« Libres mais utilisés
 * par l'un des 2 »**. Le logiciel détourne donc la partie d'un terrain déjà
 * fréquenté, et ne l'offre qu'en dernier recours.
 *
 * La règle est de fond, pas de confort : un terrain n'est pas l'autre — longueur,
 * pente, gravier, lumière — et rejouer une équipe là où elle vient de gagner lui
 * donne un avantage que le tirage n'a pas prévu.
 *
 * L'ordre des terrains est conservé dans chaque groupe : c'est celui de
 * `freeTerrains`, et l'organisateur lit une liste croissante.
 */
export function classerTerrainsLibres(
  libres: number[],
  matches: Match[],
  teamAId: string | null | undefined,
  teamBId: string | null | undefined,
): TerrainsClasses {
  const vus = new Set([...terrainsJoues(matches, teamAId), ...terrainsJoues(matches, teamBId)]);
  return {
    neufs: libres.filter((n) => !vus.has(n)),
    dejaJoues: libres.filter((n) => vus.has(n)),
  };
}

export interface TerrainAssignment {
  matchId: string;
  terrain: number;
}

/**
 * Affecte automatiquement les parties en attente aux terrains libres,
 * dans l'ordre (poules d'abord, puis tableau), sans dépasser nbTerrains.
 * Retourne la liste des affectations à appliquer.
 *
 * À terrains égaux, une partie va sur un jeu qu'aucune de ses deux équipes n'a
 * encore joué — la règle de l'écran « Match à lancer » (p.45). Le repli sur un
 * terrain déjà fréquenté est **toujours** consenti quand il n'y a rien d'autre :
 * mieux vaut une équipe qui rejoue son terrain qu'une partie qui attend. Sans ce
 * repli, huit parties pour huit terrains finiraient par se bloquer.
 *
 * L'attribution se fait partie par partie, dans l'ordre d'attente, sans chercher
 * l'optimum d'ensemble : c'est ce que fait l'organisateur qui lance ses parties
 * une à une, et un optimum global déplacerait des parties déjà annoncées.
 */
export function autoAssignTerrains(
  matches: Match[],
  nbTerrains: number,
  decalage = 0,
  bloques: number[] = [],
): TerrainAssignment[] {
  const restants = freeTerrains(matches, nbTerrains, decalage, bloques);
  const out: TerrainAssignment[] = [];
  for (const m of waitingMatches(matches)) {
    if (restants.length === 0) break;
    const { neufs } = classerTerrainsLibres(restants, matches, m.teamAId, m.teamBId);
    const terrain = neufs[0] ?? restants[0]!;
    restants.splice(restants.indexOf(terrain), 1);
    out.push({ matchId: m.id, terrain });
  }
  return out;
}
