import type { Match, Poule, Team } from '../types';
import type { EngineCtx } from './ctx';
import { shuffle } from './ctx';
import { loserOf, winnerOf } from './match';
import { clesProtection, enConflit, type Protections } from './protections';

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
  /**
   * Groupes de clubs protégés ensemble (manuel §3.B.5, niveau 2). La
   * protection club — niveau 1 — s'applique de toute façon, sauf
   * `sansProtection`.
   */
  protections?: Protections;
  /** Tirage intégralement aléatoire, sans aucune protection. */
  sansProtection?: boolean;
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

  const protections = opts.protections ?? [];

  // Têtes de série : une par poule, en tournant. Ce n'est pas une notion
  // fédérale — le manuel n'en parle pas — mais un confort d'organisateur.
  if (seedIds.length > 0) {
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
  }

  const dejaPlaces = new Set(groups.flat().map((t) => t.id));
  const reste = shuffle(
    teams.filter((t) => !dejaPlaces.has(t.id)),
    ctx.rng,
  );

  if (opts.sansProtection) {
    // Tirage intégralement aléatoire : on remplit dans l'ordre du mélange.
    let ri = 0;
    for (let g = 0; g < groups.length; g++) {
      while (groups[g]!.length < sizes[g]! && ri < reste.length) {
        groups[g]!.push(reste[ri++]!);
      }
    }
  } else {
    // Protection (manuel §3.B.5) : on distribue club par club, du club le
    // plus représenté au moins représenté, en plaçant chaque équipe dans la
    // poule libre où elle croise le moins de protégés. Deux équipes d'un même
    // club ne tombent ensemble que s'il y en a plus que de poules — ce qu'une
    // réparation par échanges ne garantissait pas.
    const cleDe = (t: Team): string =>
      [...clesProtection(t, protections)].sort().join('|') || `seule:${t.id}`;
    const parCle = new Map<string, Team[]>();
    for (const t of reste) {
      const cle = cleDe(t);
      const liste = parCle.get(cle) ?? [];
      liste.push(t);
      parCle.set(cle, liste);
    }
    const cles = [...parCle.keys()].sort(
      (a, b) => parCle.get(b)!.length - parCle.get(a)!.length,
    );

    for (const cle of cles) {
      for (const team of parCle.get(cle)!) {
        let meilleure = -1;
        let meilleurCout = Number.POSITIVE_INFINITY;
        for (let g = 0; g < groups.length; g++) {
          if (groups[g]!.length >= sizes[g]!) continue;
          const cout = groups[g]!.filter((t) => enConflit(t, team, protections)).length;
          // À coût égal, la poule la moins remplie : on garde l'équilibre.
          if (
            cout < meilleurCout ||
            (cout === meilleurCout && groups[g]!.length < groups[meilleure]!.length)
          ) {
            meilleure = g;
            meilleurCout = cout;
          }
        }
        if (meilleure >= 0) groups[meilleure]!.push(team);
      }
    }
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

/**
 * Bilan d'un groupe pour la formule « par groupes A-B-C » (manuel §3.D.5) :
 * l'équipe à 2 victoires descend dans le A, les deux équipes à 1 victoire
 * dans le B, celle à 2 défaites dans le C. Le barrage n'est pas joué, il ne
 * sert donc pas au bilan.
 */
export interface PouleGroupOutcome {
  poule: Poule;
  complete: boolean;
  /** 2 victoires → concours A. */
  gg: string | null;
  /** 1 victoire → concours B (les deux équipes qui auraient joué le barrage). */
  gp: string[];
  /** 2 défaites → concours C. */
  pp: string | null;
}

export function pouleGroupOutcome(poule: Poule, pouleMatches: Match[]): PouleGroupOutcome {
  if (poule.teamIds.length !== 4) {
    throw new Error('Formule par groupes : poules de 4 requises (victoires non comparables à 3)');
  }
  const bySlot = new Map(pouleMatches.map((m) => [m.pouleSlot, m]));
  const g = bySlot.get('GAGNANTS');
  const p = bySlot.get('PERDANTS');
  const gp = [loserOf(g), winnerOf(p)].filter((id): id is string => Boolean(id));
  return {
    poule,
    complete: Boolean(g?.done && p?.done),
    gg: winnerOf(g),
    gp,
    pp: loserOf(p),
  };
}

/** Nombre de parties restantes dans une poule. */
export function pouleRemaining(pouleMatches: Match[]): number {
  return pouleMatches.filter((m) => !m.done).length;
}
