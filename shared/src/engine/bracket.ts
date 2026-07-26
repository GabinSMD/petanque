import type { Match, MatchStage, Team } from '../types';
import type { EngineCtx } from './ctx';
import { shuffle, spreadEvenly } from './ctx';
import { isByeMatch, loserOf, winnerOf } from './match';
import type { PouleOutcome } from './poules';

/** Puissance de 2 immédiatement supérieure ou égale. */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

interface Slot {
  teamId?: string;
  bye?: boolean;
  loserFrom?: string;
}

/** Une « unité » = les deux places d'une partie du premier tour. */
interface Unit {
  a: Slot;
  b: Slot;
}

function teamSlot(teamId: string): Slot {
  return { teamId };
}

function createBracketMatches(
  concoursId: string,
  stage: MatchStage,
  units: Unit[],
  ctx: EngineCtx,
): Match[] {
  const bracketSize = units.length * 2;
  const rounds = Math.log2(bracketSize);
  const now = ctx.now();
  const matches: Match[] = [];

  units.forEach((u, position) => {
    matches.push({
      id: ctx.newId(),
      concoursId,
      stage,
      round: 0,
      position,
      teamAId: u.a.teamId ?? null,
      teamBId: u.b.teamId ?? null,
      byeA: u.a.bye || undefined,
      byeB: u.b.bye || undefined,
      loserFromA: u.a.loserFrom,
      loserFromB: u.b.loserFrom,
      scoreA: null,
      scoreB: null,
      done: false,
      terrain: null,
      updatedAt: now,
    });
  });

  for (let r = 1; r < rounds; r++) {
    const count = bracketSize >> (r + 1);
    for (let p = 0; p < count; p++) {
      matches.push({
        id: ctx.newId(),
        concoursId,
        stage,
        round: r,
        position: p,
        teamAId: null,
        teamBId: null,
        scoreA: null,
        scoreB: null,
        done: false,
        terrain: null,
        updatedAt: now,
      });
    }
  }
  return matches;
}

/**
 * Propage l'état d'un tableau : remplissage des places « perdant de … »
 * (consolante), résolution automatique des exempts, montée des vainqueurs
 * vers le tour suivant. Toute partie dont un participant change est
 * réinitialisée — la correction d'un score se répercute donc en cascade.
 * Retourne les parties modifiées (nouvelles instances).
 */
export function propagate(all: Match[]): Match[] {
  const cur = new Map(all.map((m) => [m.id, m]));
  const changed = new Set<string>();

  const update = (m: Match, patch: Partial<Match>): Match => {
    const next = { ...m, ...patch };
    cur.set(m.id, next);
    changed.add(m.id);
    return next;
  };

  for (const stage of ['principal', 'consolante', 'complementaire'] as const) {
    const stageMatches = all.filter((m) => m.stage === stage);
    if (stageMatches.length === 0) continue;
    const keyToId = new Map(stageMatches.map((m) => [`${m.round}:${m.position}`, m.id]));
    const maxRound = Math.max(...stageMatches.map((m) => m.round));

    for (let r = 0; r <= maxRound; r++) {
      const roundIds = stageMatches
        .filter((m) => m.round === r)
        .sort((a, b) => a.position - b.position)
        .map((m) => m.id);

      for (const id of roundIds) {
        let m = cur.get(id)!;

        // 1. Remplissage des places alimentées par un perdant.
        if (m.loserFromA) {
          const src = cur.get(m.loserFromA);
          const expected = src && src.done ? loserOf(src) : null;
          if (m.teamAId !== expected) {
            m = update(m, { teamAId: expected, scoreA: null, scoreB: null, done: false });
          }
        }
        if (m.loserFromB) {
          const src = cur.get(m.loserFromB);
          const expected = src && src.done ? loserOf(src) : null;
          if (m.teamBId !== expected) {
            m = update(m, { teamBId: expected, scoreA: null, scoreB: null, done: false });
          }
        }

        // 2. Résolution des exempts : la partie se termine seule.
        if (isByeMatch(m)) {
          const real = m.byeA ? m.teamBId : m.teamAId;
          if (!m.done && real) m = update(m, { done: true });
          if (m.done && !real) m = update(m, { done: false });
        }

        // 3. Montée du vainqueur.
        if (r < maxRound) {
          const targetId = keyToId.get(`${r + 1}:${m.position >> 1}`);
          if (targetId) {
            const target = cur.get(targetId)!;
            const expected = m.done ? winnerOf(m) : null;
            if (m.position % 2 === 0) {
              if (target.teamAId !== expected) {
                update(target, { teamAId: expected, scoreA: null, scoreB: null, done: false });
              }
            } else if (target.teamBId !== expected) {
              update(target, { teamBId: expected, scoreA: null, scoreB: null, done: false });
            }
          }
        }
      }
    }
  }

  return [...changed].map((id) => cur.get(id)!);
}

/* ------------------------------------------------------------------ */
/* Tirages                                                             */
/* ------------------------------------------------------------------ */

export interface EliminationDrawOptions {
  avoidSameClub?: boolean;
  teamsById?: Map<string, Team>;
  /** Têtes de série (ids ordonnés) : placées aux positions standard du tableau. */
  seeds?: string[];
}

/**
 * Ordre standard des têtes de série dans un tableau de taille `size`
 * (1, size, size/2… répartis pour que les têtes se rencontrent le plus
 * tard possible). Retourne, pour chaque position, le numéro de tête.
 */
export function seedSlotOrder(size: number): number[] {
  let slots = [1, 2];
  while (slots.length < size) {
    const sum = slots.length * 2 + 1;
    const next: number[] = [];
    for (const s of slots) {
      next.push(s);
      next.push(sum - s);
    }
    slots = next;
  }
  return slots;
}

/**
 * Tirage d'un tableau à élimination directe : mélange, exempts répartis
 * régulièrement, réparation « même club » optionnelle au premier tour.
 * Avec des têtes de série, celles-ci sont placées aux positions standard
 * (exempts prioritaires aux mieux classées) pour se rencontrer tardivement.
 */
export function drawElimination(
  concoursId: string,
  stage: MatchStage,
  teams: Team[],
  ctx: EngineCtx,
  opts: EliminationDrawOptions = {},
): Match[] {
  if (teams.length < 2) throw new Error('Il faut au moins 2 équipes');
  const bracketSize = nextPow2(teams.length);
  const byes = bracketSize - teams.length;
  const seedIds = opts.seeds ?? [];

  let units: Unit[];

  if (seedIds.length > 0) {
    // Placement par têtes de série : slot k reçoit la k-ième équipe (têtes
    // en tête), les slots au-delà de l'effectif sont des exempts.
    const byId = new Map(teams.map((t) => [t.id, t]));
    const seeded = seedIds.map((id) => byId.get(id)).filter((t): t is Team => Boolean(t));
    const seedSet = new Set(seeded.map((t) => t.id));
    const rest = shuffle(
      teams.filter((t) => !seedSet.has(t.id)),
      ctx.rng,
    );
    const ranked = [...seeded, ...rest]; // rang 1..n

    const order = seedSlotOrder(bracketSize); // numéro de tête par position
    const slots: (Team | null)[] = order.map((seedNum) =>
      seedNum <= ranked.length ? ranked[seedNum - 1]! : null,
    );

    units = [];
    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i];
      const b = slots[i + 1];
      if (a && b) units.push({ a: teamSlot(a.id), b: teamSlot(b.id) });
      else if (a) units.push({ a: teamSlot(a.id), b: { bye: true } });
      else if (b) units.push({ a: teamSlot(b.id), b: { bye: true } });
      else units.push({ a: { bye: true }, b: { bye: true } });
    }
  } else {
    const pool = shuffle(teams, ctx.rng);
    const byeTeams = pool.slice(0, byes);
    const playing = pool.slice(byes);

    const pairs: [Team, Team][] = [];
    for (let i = 0; i < playing.length; i += 2) {
      pairs.push([playing[i]!, playing[i + 1]!]);
    }
    if (opts.avoidSameClub) repairSameClubPairs(pairs, ctx);

    const byeUnits: Unit[] = byeTeams.map((t) => ({ a: teamSlot(t.id), b: { bye: true } }));
    const matchUnits: Unit[] = pairs.map(([a, b]) => ({ a: teamSlot(a.id), b: teamSlot(b.id) }));
    units = spreadEvenly(matchUnits, byeUnits);
  }

  const matches = createBracketMatches(concoursId, stage, units, ctx);
  return applyChanges(matches, propagate(matches));
}

/** Sépare (au mieux) deux équipes du même club au premier tour. */
function repairSameClubPairs(pairs: [Team, Team][], ctx: EngineCtx): void {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i]!;
      if (!a.club || a.club !== b.club) continue;
      const order = shuffle(
        pairs.flatMap((_, j) => (j === i ? [] : [j])),
        ctx.rng,
      );
      for (const j of order) {
        const [c, d] = pairs[j]!;
        // Échange b <-> d si aucune des deux paires ne reste en conflit.
        if (a.club !== d.club && c.club !== b.club) {
          pairs[i] = [a, d];
          pairs[j] = [c, b];
          moved = true;
          break;
        }
      }
    }
    if (!moved) return;
  }
}

/**
 * Tirage du tableau principal à l'issue des poules.
 * Règles appliquées :
 *  - les exempts vont en priorité aux premiers de poule ;
 *  - au premier tour, un premier rencontre un second d'une autre poule ;
 *  - le premier et le second d'une même poule sont placés (au mieux)
 *    dans des moitiés opposées du tableau.
 */
export function drawMainFromPoules(
  concoursId: string,
  outcomes: PouleOutcome[],
  ctx: EngineCtx,
): Match[] {
  interface Qualified {
    teamId: string;
    pouleIndex: number;
  }
  const firsts: Qualified[] = [];
  const seconds: Qualified[] = [];
  for (const o of outcomes) {
    if (!o.complete || !o.q1 || !o.q2) throw new Error('Toutes les poules doivent être terminées');
    firsts.push({ teamId: o.q1, pouleIndex: o.poule.index });
    seconds.push({ teamId: o.q2, pouleIndex: o.poule.index });
  }

  const total = firsts.length + seconds.length;
  const bracketSize = nextPow2(total);
  const byes = bracketSize - total;

  const shuffledFirsts = shuffle(firsts, ctx.rng);
  const shuffledSeconds = shuffle(seconds, ctx.rng);

  const byed: Qualified[] = [];
  while (byed.length < byes && shuffledFirsts.length > 0) byed.push(shuffledFirsts.shift()!);
  while (byed.length < byes && shuffledSeconds.length > 0) byed.push(shuffledSeconds.shift()!);

  // Appariement premier contre second d'une autre poule.
  const pairs: [Qualified, Qualified][] = [];
  for (const f of shuffledFirsts) {
    const idx = shuffledSeconds.findIndex((s) => s.pouleIndex !== f.pouleIndex);
    if (idx >= 0) {
      pairs.push([f, shuffledSeconds.splice(idx, 1)[0]!]);
      continue;
    }
    const s = shuffledSeconds.splice(0, 1)[0];
    if (!s) throw new Error('Appariement impossible : seconds insuffisants');
    // Dernier second disponible dans la même poule : échange avec une
    // paire déjà constituée pour préserver la règle.
    const swap = pairs.find(
      ([pf, ps]) => ps.pouleIndex !== f.pouleIndex && pf.pouleIndex !== s.pouleIndex,
    );
    if (swap) {
      const donated = swap[1];
      swap[1] = s;
      pairs.push([f, donated]);
    } else {
      pairs.push([f, s]);
    }
  }
  // Seconds restants entre eux (poules différentes par construction).
  while (shuffledSeconds.length >= 2) {
    pairs.push([shuffledSeconds.shift()!, shuffledSeconds.shift()!]);
  }

  const byeUnits: Unit[] = byed.map((q) => ({ a: teamSlot(q.teamId), b: { bye: true } }));
  const matchUnits: Unit[] = pairs.map(([a, b]) => ({ a: teamSlot(a.teamId), b: teamSlot(b.teamId) }));
  const units = spreadEvenly(matchUnits, byeUnits);

  separateHalves(
    units,
    new Map([...firsts, ...seconds].map((q) => [q.teamId, q.pouleIndex])),
    ctx,
  );

  const matches = createBracketMatches(concoursId, 'principal', units, ctx);
  return applyChanges(matches, propagate(matches));
}

/**
 * Place (au mieux) les deux qualifiés d'une même poule dans des moitiés
 * opposées du tableau, par échanges d'unités bornés.
 */
function separateHalves(units: Unit[], pouleOfTeam: Map<string, number>, ctx: EngineCtx): void {
  if (units.length < 2) return;
  const half = (i: number) => (i * 2 < units.length ? 0 : 1);
  const poulesOf = (u: Unit): number[] =>
    [u.a.teamId, u.b.teamId]
      .filter((id): id is string => Boolean(id))
      .map((id) => pouleOfTeam.get(id))
      .filter((p): p is number => p !== undefined);

  const unitIndexesByPoule = (): Map<number, number[]> => {
    const map = new Map<number, number[]>();
    units.forEach((u, i) => {
      for (const p of poulesOf(u)) {
        const list = map.get(p) ?? [];
        list.push(i);
        map.set(p, list);
      }
    });
    return map;
  };

  const conflicts = (map: Map<number, number[]>): number[] =>
    [...map.entries()]
      .filter(([, idxs]) => idxs.length === 2 && half(idxs[0]!) === half(idxs[1]!))
      .map(([p]) => p);

  for (let pass = 0; pass < 4; pass++) {
    const map = unitIndexesByPoule();
    const bad = conflicts(map);
    if (bad.length === 0) return;
    let moved = false;
    for (const poule of bad) {
      const idxs = unitIndexesByPoule().get(poule);
      if (!idxs || idxs.length !== 2 || half(idxs[0]!) !== half(idxs[1]!)) continue;
      const from = idxs[1]!;
      const candidates = shuffle(
        units.map((_, i) => i).filter((i) => half(i) !== half(from)),
        ctx.rng,
      );
      for (const to of candidates) {
        const a = units[from]!;
        const b = units[to]!;
        units[from] = b;
        units[to] = a;
        const stillBad = conflicts(unitIndexesByPoule());
        const involved = new Set([...poulesOf(a), ...poulesOf(b)]);
        if (stillBad.some((p) => involved.has(p))) {
          units[from] = a;
          units[to] = b;
        } else {
          moved = true;
          break;
        }
      }
    }
    if (!moved) return;
  }
}

/**
 * Tableau de repêchage « à venir » : son premier tour est alimenté par les
 * perdants des parties (réelles) du premier tour du tableau source. Sert à
 * la consolante (perdants du principal) comme au complémentaire (perdants de
 * la consolante), d'où le paramètre `stage`.
 */
export function buildConsolanteFromSources(
  concoursId: string,
  sourceMatchIds: string[],
  ctx: EngineCtx,
  stage: MatchStage = 'consolante',
): Match[] {
  if (sourceMatchIds.length < 2) return [];
  const size = nextPow2(sourceMatchIds.length);
  const byes = size - sourceMatchIds.length;

  const sources = sourceMatchIds.slice();
  const byeUnits: Unit[] = [];
  for (let i = 0; i < byes; i++) {
    byeUnits.push({ a: { loserFrom: sources.shift()! }, b: { bye: true } });
  }
  const matchUnits: Unit[] = [];
  while (sources.length >= 2) {
    matchUnits.push({ a: { loserFrom: sources.shift()! }, b: { loserFrom: sources.shift()! } });
  }
  const units = spreadEvenly(matchUnits, byeUnits);
  return createBracketMatches(concoursId, stage, units, ctx);
}

/**
 * Identifiants des parties « réelles » du premier tour d'un tableau (hors
 * exempts), triés par position : ce sont les sources d'un repêchage.
 */
export function firstRoundSources(matches: Match[], stage: MatchStage): string[] {
  return matches
    .filter((m) => m.stage === stage && m.round === 0 && !isByeMatch(m))
    .sort((a, b) => a.position - b.position)
    .map((m) => m.id);
}

/** Fusionne les parties modifiées dans la liste d'origine. */
export function applyChanges(all: Match[], changed: Match[]): Match[] {
  if (changed.length === 0) return all;
  const byId = new Map(changed.map((m) => [m.id, m]));
  return all.map((m) => byId.get(m.id) ?? m);
}

/* ------------------------------------------------------------------ */
/* Libellés                                                            */
/* ------------------------------------------------------------------ */

const ROUND_NAMES: Record<number, string> = {
  2: 'Finale',
  4: 'Demi-finales',
  8: 'Quarts de finale',
  16: '8èmes de finale',
  32: '16èmes de finale',
  64: '32èmes de finale',
  128: '64èmes de finale',
};

/** Taille du tableau (nombre de places au premier tour). */
export function bracketSizeOf(stageMatches: Match[]): number {
  return stageMatches.filter((m) => m.round === 0).length * 2;
}

export function roundLabel(bracketSize: number, round: number, firstRoundHasByes: boolean): string {
  if (round === 0 && firstRoundHasByes) return 'Cadrage';
  const teams = bracketSize >> round;
  return ROUND_NAMES[teams] ?? `Tour ${round + 1}`;
}

export interface RankGroup {
  rank: number;
  label: string;
  teamIds: string[];
}

const LOSS_LABELS: Record<number, string> = {
  4: 'Demi-finalistes',
  8: 'Éliminés en quarts',
  16: 'Éliminés en 8èmes',
  32: 'Éliminés en 16èmes',
  64: 'Éliminés en 32èmes',
  128: 'Éliminés en 64èmes',
};

/** Classement d'un tableau, du vainqueur aux éliminés du premier tour. */
export function bracketRanking(matches: Match[], stage: MatchStage): RankGroup[] {
  const ms = matches.filter((m) => m.stage === stage);
  if (ms.length === 0) return [];
  const maxRound = Math.max(...ms.map((m) => m.round));
  const bracketSize = bracketSizeOf(ms);
  const hasByes = ms.some((m) => m.round === 0 && isByeMatch(m));
  const finale = ms.find((m) => m.round === maxRound);
  const groups: RankGroup[] = [];

  const winner = winnerOf(finale);
  const runnerUp = loserOf(finale);
  if (winner) groups.push({ rank: 1, label: 'Vainqueur', teamIds: [winner] });
  if (runnerUp) groups.push({ rank: 2, label: 'Finaliste', teamIds: [runnerUp] });

  let rank = 3;
  for (let r = maxRound - 1; r >= 0; r--) {
    const losers = ms
      .filter((m) => m.round === r)
      .sort((a, b) => a.position - b.position)
      .map((m) => loserOf(m))
      .filter((id): id is string => Boolean(id));
    if (losers.length === 0) continue;
    const label =
      r === 0 && hasByes
        ? 'Éliminés au cadrage'
        : (LOSS_LABELS[bracketSize >> r] ?? `Éliminés au tour ${r + 1}`);
    groups.push({ rank, label, teamIds: losers });
    rank += losers.length;
  }
  return groups;
}
