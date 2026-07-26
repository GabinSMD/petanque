import type { Match, Team } from '../../types';
import { defaultCtx, type EngineCtx } from '../ctx';
import { applyChanges, propagate } from '../bracket';
import { recomputePoule } from '../poules';
import type { Poule } from '../../types';

let idCounter = 0;

/** Contexte déterministe pour les tests. */
export function testCtx(seed = 42): EngineCtx {
  const base = defaultCtx(seed);
  return {
    ...base,
    newId: () => `id-${++idCounter}`,
    now: () => '2026-01-01T00:00:00.000Z',
  };
}

export function makeTeam(i: number, club?: string): Team {
  return {
    id: `t${i}`,
    concoursId: 'c1',
    number: i,
    players: [{ name: `Joueur ${i}` }],
    club,
    forfait: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => makeTeam(i + 1));
}

/** Saisit un score sur une partie de poule puis recalcule la poule. */
export function playPouleSlot(
  poule: Poule,
  matches: Match[],
  slot: string,
  scoreA: number,
  scoreB: number,
): Match[] {
  const m = matches.find((x) => x.pouleId === poule.id && x.pouleSlot === slot);
  if (!m) throw new Error(`Partie introuvable : ${slot}`);
  const updated = matches.map((x) =>
    x.id === m.id ? { ...x, scoreA, scoreB, done: true } : x,
  );
  const pouleMatches = updated.filter((x) => x.pouleId === poule.id);
  const changed = recomputePoule(poule, pouleMatches);
  return applyChanges(updated, changed);
}

/** Saisit un score sur une partie de tableau puis propage. */
export function playBracketMatch(
  all: Match[],
  matchId: string,
  scoreA: number,
  scoreB: number,
): Match[] {
  const updated = all.map((x) =>
    x.id === matchId ? { ...x, scoreA, scoreB, done: true } : x,
  );
  return applyChanges(updated, propagate(updated));
}

export function bySlot(matches: Match[], pouleId: string, slot: string): Match {
  const m = matches.find((x) => x.pouleId === pouleId && x.pouleSlot === slot);
  if (!m) throw new Error(`Partie introuvable : ${slot}`);
  return m;
}

export function at(matches: Match[], stage: string, round: number, position: number): Match {
  const m = matches.find(
    (x) => x.stage === stage && x.round === round && x.position === position,
  );
  if (!m) throw new Error(`Partie introuvable : ${stage} ${round}/${position}`);
  return m;
}
