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
): TerrainState[] {
  const live = matches.filter(isLiveMatch);
  const byTerrain = new Map<number, Match>();
  for (const m of live) {
    if (m.terrain && m.terrain >= 1) byTerrain.set(m.terrain, m);
  }
  return terrainNumeros(nbTerrains, decalage).map((n) => ({
    number: n,
    match: byTerrain.get(n) ?? null,
  }));
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

/** Numéros de terrains libres (dans la plage du concours). */
export function freeTerrains(matches: Match[], nbTerrains: number, decalage = 0): number[] {
  const occupied = new Set(
    matches.filter(isLiveMatch).map((m) => m.terrain).filter((t): t is number => Boolean(t)),
  );
  return terrainNumeros(nbTerrains, decalage).filter((n) => !occupied.has(n));
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
): TerrainAssignment[] {
  const free = freeTerrains(matches, nbTerrains, decalage);
  const waiting = waitingMatches(matches);
  const out: TerrainAssignment[] = [];
  for (let i = 0; i < Math.min(free.length, waiting.length); i++) {
    out.push({ matchId: waiting[i]!.id, terrain: free[i]! });
  }
  return out;
}
