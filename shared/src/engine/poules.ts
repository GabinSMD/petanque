import type { Match, Poule, Team } from '../types';
import type { EngineCtx } from './ctx';
import { shuffle } from './ctx';
import { loserOf, winnerOf } from './match';

/**
 * Répartition FFPJP : poules de 4, complétées par des poules de 3
 * quand l'effectif ne tombe pas juste.
 * Retourne null si l'effectif est incompatible (ex. 5 équipes).
 */
export function pouleSizes(n: number): number[] | null {
  if (n < 4) return null;
  const q = Math.floor(n / 4);
  const r = n % 4;
  let fours: number;
  let threes: number;
  if (r === 0) {
    fours = q;
    threes = 0;
  } else if (r === 3) {
    fours = q;
    threes = 1;
  } else if (r === 2) {
    if (q < 1) return null;
    fours = q - 1;
    threes = 2;
  } else {
    // r === 1 : il faut « casser » deux poules de 4 en trois poules de 3.
    if (q < 2) return null;
    fours = q - 2;
    threes = 3;
  }
  return [...Array(fours).fill(4), ...Array(threes).fill(3)];
}

export interface PouleDraw {
  poules: Poule[];
  matches: Match[];
}

export interface DrawPoulesOptions {
  avoidSameClub?: boolean;
  /** Têtes de série (ids ordonnés) : réparties dans des poules différentes. */
  seeds?: string[];
}

/**
 * Tirage au sort des poules : mélange des équipes, découpage en poules
 * de 4 puis de 3, avec une passe de réparation pour éviter (au mieux)
 * deux équipes du même club dans une poule. Les têtes de série éventuelles
 * sont réparties une par poule (poules différentes).
 */
export function drawPoules(
  concoursId: string,
  teams: Team[],
  ctx: EngineCtx,
  opts: DrawPoulesOptions = {},
): PouleDraw | null {
  const sizes = pouleSizes(teams.length);
  if (!sizes) return null;

  const groups: Team[][] = sizes.map(() => []);
  const seedIds = opts.seeds ?? [];
  const byId = new Map(teams.map((t) => [t.id, t]));

  if (seedIds.length > 0) {
    // Placement des têtes de série, une par poule (en tournant si besoin).
    const seeded = seedIds.map((id) => byId.get(id)).filter((t): t is Team => Boolean(t));
    let gi = 0;
    for (const team of seeded) {
      let tries = 0;
      while (groups[gi]!.length >= sizes[gi]! && tries < groups.length) {
        gi = (gi + 1) % groups.length;
        tries++;
      }
      groups[gi]!.push(team);
      gi = (gi + 1) % groups.length;
    }
    // Répartition aléatoire du reste dans les places libres.
    const seedSet = new Set(seedIds);
    const rest = shuffle(
      teams.filter((t) => !seedSet.has(t.id)),
      ctx.rng,
    );
    let ri = 0;
    for (let g = 0; g < groups.length; g++) {
      while (groups[g]!.length < sizes[g]! && ri < rest.length) {
        groups[g]!.push(rest[ri++]!);
      }
    }
  } else {
    const pool = shuffle(teams, ctx.rng);
    let offset = 0;
    for (let g = 0; g < sizes.length; g++) {
      groups[g] = pool.slice(offset, offset + sizes[g]!);
      offset += sizes[g]!;
    }
  }

  if (opts.avoidSameClub) {
    repairSameClub(groups, ctx);
  }

  const now = ctx.now();
  const poules: Poule[] = [];
  const matches: Match[] = [];

  groups.forEach((group, i) => {
    const poule: Poule = {
      id: ctx.newId(),
      concoursId,
      index: i + 1,
      teamIds: group.map((t) => t.id),
      terrain: null,
      updatedAt: now,
    };
    poules.push(poule);
    matches.push(...createPouleMatches(concoursId, poule, ctx));
  });

  return { poules, matches };
}

/** Échanges bornés entre poules pour séparer les équipes d'un même club. */
function repairSameClub(groups: Team[][], ctx: EngineCtx): void {
  const conflict = (group: Team[], team: Team, ignoreIdx: number): boolean =>
    group.some((t, idx) => idx !== ignoreIdx && t.club && team.club && t.club === team.club);

  for (let pass = 0; pass < 4; pass++) {
    let fixedSomething = false;
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]!;
      for (let ti = 0; ti < group.length; ti++) {
        const team = group[ti]!;
        if (!conflict(group, team, ti)) continue;
        // Cherche un échange qui ne crée de conflit ni ici ni là-bas.
        const order = shuffle(
          groups.flatMap((g, ogi) => (ogi === gi ? [] : g.map((_, oti) => [ogi, oti] as const))),
          ctx.rng,
        );
        for (const [ogi, oti] of order) {
          const other = groups[ogi]![oti]!;
          const groupWithout = group.map((t, idx) => (idx === ti ? other : t));
          const otherWithout = groups[ogi]!.map((t, idx) => (idx === oti ? team : t));
          if (
            !conflict(groupWithout, other, ti) &&
            !conflict(otherWithout, team, oti)
          ) {
            group[ti] = other;
            groups[ogi]![oti] = team;
            fixedSomething = true;
            break;
          }
        }
      }
    }
    if (!fixedSomething) return;
  }
}

const POULE_SLOT_POSITION = { M1: 0, M2: 1, GAGNANTS: 2, PERDANTS: 3, BARRAGE: 4 } as const;

function pouleMatch(
  concoursId: string,
  poule: Poule,
  slot: keyof typeof POULE_SLOT_POSITION,
  teamAId: string | null,
  teamBId: string | null,
  ctx: EngineCtx,
): Match {
  return {
    id: ctx.newId(),
    concoursId,
    stage: 'poule',
    pouleId: poule.id,
    pouleSlot: slot,
    round: 0,
    position: POULE_SLOT_POSITION[slot],
    teamAId,
    teamBId,
    scoreA: null,
    scoreB: null,
    done: false,
    terrain: null,
    updatedAt: ctx.now(),
  };
}

/**
 * Parties d'une poule.
 * Poule de 4 : M1 (t1-t2), M2 (t3-t4), gagnants, perdants, barrage.
 * Poule de 3 : M1 (t1-t2, t3 exempt), gagnants (vainqueur M1 - t3), barrage.
 */
export function createPouleMatches(concoursId: string, poule: Poule, ctx: EngineCtx): Match[] {
  const t = poule.teamIds;
  if (t.length === 4) {
    return [
      pouleMatch(concoursId, poule, 'M1', t[0]!, t[1]!, ctx),
      pouleMatch(concoursId, poule, 'M2', t[2]!, t[3]!, ctx),
      pouleMatch(concoursId, poule, 'GAGNANTS', null, null, ctx),
      pouleMatch(concoursId, poule, 'PERDANTS', null, null, ctx),
      pouleMatch(concoursId, poule, 'BARRAGE', null, null, ctx),
    ];
  }
  if (t.length === 3) {
    return [
      pouleMatch(concoursId, poule, 'M1', t[0]!, t[1]!, ctx),
      pouleMatch(concoursId, poule, 'GAGNANTS', null, t[2]!, ctx),
      pouleMatch(concoursId, poule, 'BARRAGE', null, null, ctx),
    ];
  }
  throw new Error(`Taille de poule invalide : ${t.length}`);
}

/**
 * Recalcule les participants des parties dérivées d'une poule
 * (gagnants / perdants / barrage) à partir des résultats saisis.
 * Toute partie dont un participant change est réinitialisée : la
 * correction d'un score amont invalide proprement l'aval.
 * Retourne uniquement les parties modifiées (nouvelles instances).
 */
export function recomputePoule(poule: Poule, pouleMatches: Match[]): Match[] {
  const bySlot = new Map(pouleMatches.map((m) => [m.pouleSlot, m]));
  const changed: Match[] = [];

  const apply = (slot: PouleSlotName, a: string | null, b: string | null): Match | undefined => {
    const current = bySlot.get(slot);
    if (!current) return undefined;
    if (current.teamAId === a && current.teamBId === b) return current;
    const next: Match = {
      ...current,
      teamAId: a,
      teamBId: b,
      scoreA: null,
      scoreB: null,
      done: false,
    };
    bySlot.set(slot, next);
    changed.push(next);
    return next;
  };

  const m1 = bySlot.get('M1');
  if (poule.teamIds.length === 4) {
    const m2 = bySlot.get('M2');
    const g = apply('GAGNANTS', winnerOf(m1), winnerOf(m2));
    const p = apply('PERDANTS', loserOf(m1), loserOf(m2));
    apply('BARRAGE', loserOf(g), winnerOf(p));
  } else {
    const g = apply('GAGNANTS', winnerOf(m1), poule.teamIds[2] ?? null);
    apply('BARRAGE', loserOf(m1), loserOf(g));
  }
  return changed;
}

type PouleSlotName = 'M1' | 'M2' | 'GAGNANTS' | 'PERDANTS' | 'BARRAGE';

export interface PouleOutcome {
  poule: Poule;
  complete: boolean;
  /** Premier de poule : vainqueur de la partie des gagnants (2 victoires). */
  q1: string | null;
  /** Second de poule : vainqueur du barrage. */
  q2: string | null;
  /** Éliminés (2 en poule de 4, 1 en poule de 3). */
  eliminated: string[];
}

/** Bilan de qualification d'une poule. */
export function pouleOutcome(poule: Poule, pouleMatches: Match[]): PouleOutcome {
  const bySlot = new Map(pouleMatches.map((m) => [m.pouleSlot, m]));
  const g = bySlot.get('GAGNANTS');
  const b = bySlot.get('BARRAGE');
  const p = bySlot.get('PERDANTS');
  const complete = Boolean(g?.done && b?.done);
  const eliminated: string[] = [];
  if (poule.teamIds.length === 4) {
    const lp = loserOf(p);
    if (lp) eliminated.push(lp);
  }
  const lb = loserOf(b);
  if (lb) eliminated.push(lb);
  return { poule, complete, q1: winnerOf(g), q2: winnerOf(b), eliminated };
}

/** Nombre de parties restantes dans une poule. */
export function pouleRemaining(pouleMatches: Match[]): number {
  return pouleMatches.filter((m) => !m.done).length;
}
