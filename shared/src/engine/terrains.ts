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

export interface TerrainAssignment {
  matchId: string;
  terrain: number;
}

/**
 * Affecte automatiquement les parties en attente aux terrains libres,
 * dans l'ordre (poules d'abord, puis tableau), sans dépasser nbTerrains.
 * Retourne la liste des affectations à appliquer.
 */
export function autoAssignTerrains(
  matches: Match[],
  nbTerrains: number,
  decalage = 0,
  bloques: number[] = [],
): TerrainAssignment[] {
  const free = freeTerrains(matches, nbTerrains, decalage, bloques);
  const waiting = waitingMatches(matches);
  const out: TerrainAssignment[] = [];
  for (let i = 0; i < Math.min(free.length, waiting.length); i++) {
    out.push({ matchId: waiting[i]!.id, terrain: free[i]! });
  }
  return out;
}
