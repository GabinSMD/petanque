import type { Match, MatchStage, Team } from '../types';
import type { EngineCtx } from './ctx';
import { shuffle, spreadEvenly } from './ctx';
import { isByeMatch, loserOf, winnerOf } from './match';
import { enConflit, type Protections } from './protections';
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
  /** Groupes de clubs protégés ensemble (manuel §3.B.5, niveau 2). */
  protections?: Protections;
  /** Tirage intégralement aléatoire, sans aucune protection. */
  sansProtection?: boolean;
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
    // Protection club par défaut, comme dans le logiciel fédéral.
    if (!opts.sansProtection) repairSameClubPairs(pairs, ctx, opts.protections ?? []);

    const byeUnits: Unit[] = byeTeams.map((t) => ({ a: teamSlot(t.id), b: { bye: true } }));
    const matchUnits: Unit[] = pairs.map(([a, b]) => ({ a: teamSlot(a.id), b: teamSlot(b.id) }));
    units = spreadEvenly(matchUnits, byeUnits);
  }

  const matches = createBracketMatches(concoursId, stage, units, ctx);
  return applyChanges(matches, propagate(matches));
}

/** Sépare (au mieux) deux équipes protégées au premier tour. */
function repairSameClubPairs(
  pairs: [Team, Team][],
  ctx: EngineCtx,
  protections: Protections,
): void {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i]!;
      if (!enConflit(a, b, protections)) continue;
      const order = shuffle(
        pairs.flatMap((_, j) => (j === i ? [] : [j])),
        ctx.rng,
      );
      for (const j of order) {
        const [c, d] = pairs[j]!;
        // Échange b <-> d si aucune des deux paires ne reste en conflit.
        if (!enConflit(a, d, protections) && !enConflit(c, b, protections)) {
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

/** Une place d'un tableau de repêchage, alimentée par le perdant d'une partie. */
export interface RecoveryEntry {
  /** Partie dont le perdant occupera cette place. */
  loserFrom: string;
  /**
   * `true` : l'équipe n'entre qu'au tour suivant — le « cadrage » du manuel
   * FFPJP (« reversée à la 2e partie du concours B »). Techniquement, elle
   * occupe une unité exemptée du premier tour, qui se résout d'elle-même.
   * Les exempts disponibles sont attribués à ces entrées en priorité ; s'il
   * n'y en a pas assez, les entrées différées restantes rejoignent le
   * premier tour.
   */
  deferred?: boolean;
}

/**
 * Tableau de repêchage « à venir » : ses places sont alimentées par les
 * perdants de parties d'un autre tableau. Sert à la consolante (perdants du
 * principal) comme au complémentaire (perdants de la consolante), d'où le
 * paramètre `stage`.
 */
export function buildRecoveryBracket(
  concoursId: string,
  stage: MatchStage,
  entries: RecoveryEntry[],
  ctx: EngineCtx,
): Match[] {
  if (entries.length < 2) return [];
  const size = nextPow2(entries.length);
  let remainingByes = size - entries.length;

  const deferred = entries.filter((e) => e.deferred);
  const direct = entries.filter((e) => !e.deferred);

  const byeEntries: RecoveryEntry[] = [];
  while (remainingByes > 0 && deferred.length > 0) {
    byeEntries.push(deferred.shift()!);
    remainingByes -= 1;
  }
  while (remainingByes > 0 && direct.length > 0) {
    byeEntries.push(direct.shift()!);
    remainingByes -= 1;
  }
  const playing = [...deferred, ...direct];

  const byeUnits: Unit[] = byeEntries.map((e) => ({
    a: { loserFrom: e.loserFrom },
    b: { bye: true },
  }));
  const matchUnits: Unit[] = [];
  while (playing.length >= 2) {
    matchUnits.push({
      a: { loserFrom: playing.shift()!.loserFrom },
      b: { loserFrom: playing.shift()!.loserFrom },
    });
  }
  const units = spreadEvenly(matchUnits, byeUnits);
  return createBracketMatches(concoursId, stage, units, ctx);
}

/**
 * Repêchage simple : le premier tour du tableau est alimenté par les perdants
 * des parties (réelles) du premier tour du tableau source.
 */
export function buildConsolanteFromSources(
  concoursId: string,
  sourceMatchIds: string[],
  ctx: EngineCtx,
  stage: MatchStage = 'consolante',
): Match[] {
  return buildRecoveryBracket(
    concoursId,
    stage,
    sourceMatchIds.map((id) => ({ loserFrom: id })),
    ctx,
  );
}

/* ------------------------------------------------------------------ */
/* Tableaux à entrées échelonnées                                      */
/* ------------------------------------------------------------------ */

/** Un engagé, et le tour auquel il entre dans le tableau. */
export interface StagedEntry {
  /** Équipe réelle. */
  teamId?: string;
  /** Ou place alimentée par le perdant d'une autre partie. */
  loserFrom?: string;
  /** 0 = première partie, 1 = cadrage, etc. */
  round: number;
}

/**
 * Tableau dont les engagés n'entrent pas tous au même tour — le « cadrage »
 * du manuel, où les perdants d'un tour du concours A rejoignent la 2e partie
 * du concours B (§3.D.4 et §3.D.13).
 *
 * Deux idées suffisent, et aucune ne touche à `propagate` :
 *
 *  - une entrée au tour `r` occupe un bloc aligné de 2^r places du premier
 *    tour : elle y affronte des exempts, qui se résolvent d'eux-mêmes et la
 *    déposent au tour voulu ;
 *  - les blocs sans engagé ne donnent aucune partie — le tableau est creux —
 *    et la place d'en face, privée d'alimentation, est marquée exempte. Le
 *    mécanisme d'exempt existant la résout donc à n'importe quel tour.
 *
 * Conséquence tenue par construction : toute partie créée finit par produire
 * un vainqueur, donc aucune ne reste bloquée avec un seul camp connu.
 */
export function buildStagedBracket(
  concoursId: string,
  stage: MatchStage,
  entries: StagedEntry[],
  ctx: EngineCtx,
): Match[] {
  if (entries.length < 2) return [];

  /**
   * Placement par blocs alignés. Les engagés du premier tour vont par paires
   * — une partie — et les entrées différées sont réparties **entre** ces
   * paires plutôt que tassées à gauche : sans quoi les repêchés se
   * rencontreraient entre eux au cadrage, offrant un chemin plus facile aux
   * autres. Répartir entre des paires préserve l'alignement, donc ne gaspille
   * aucune place.
   */
  const directes = entries.filter((e) => e.round === 0);
  const differees = entries
    .filter((e) => e.round > 0)
    .sort((a, b) => b.round - a.round);

  type Bloc = { entries: StagedEntry[]; span: number };
  const paires: Bloc[] = [];
  for (let i = 0; i < directes.length; i += 2) {
    paires.push({ entries: directes.slice(i, i + 2), span: 2 });
  }
  const blocsDifferes: Bloc[] = differees.map((e) => ({ entries: [e], span: 1 << e.round }));
  const blocs = spreadEvenly(paires, blocsDifferes);

  const places: { entry: StagedEntry; start: number; span: number }[] = [];
  let curseur = 0;
  for (const bloc of blocs) {
    if (curseur % bloc.span !== 0) curseur += bloc.span - (curseur % bloc.span);
    bloc.entries.forEach((entry, i) => {
      places.push({ entry, start: curseur + i, span: bloc.entries.length > 1 ? 1 : bloc.span });
    });
    curseur += bloc.span;
  }

  const size = nextPow2(Math.max(curseur, 2));
  const rounds = Math.log2(size);
  const now = ctx.now();

  /** Place → engagé qui y entre (seule la première place du bloc le porte). */
  const parPlace = new Map<number, StagedEntry>();
  for (const p of places) parPlace.set(p.start, p.entry);

  const matches: Match[] = [];
  /** Parties existantes, pour savoir si une place est alimentée. */
  const existe = new Set<string>();

  // Premier tour : une partie dès qu'une des deux places porte un engagé.
  for (let position = 0; position < size / 2; position += 1) {
    const a = parPlace.get(position * 2);
    const b = parPlace.get(position * 2 + 1);
    // Ni bloc vide, ni intérieur d'un bloc dont l'engagé est ailleurs : sans
    // engagé sur l'une des deux places, aucune partie — le tour suivant
    // traitera l'absence d'alimentation.
    if (!a && !b) continue;
    matches.push({
      id: ctx.newId(),
      concoursId,
      stage,
      round: 0,
      position,
      teamAId: a?.teamId ?? null,
      teamBId: b?.teamId ?? null,
      byeA: a ? undefined : true,
      byeB: b ? undefined : true,
      loserFromA: a?.loserFrom,
      loserFromB: b?.loserFrom,
      scoreA: null,
      scoreB: null,
      done: false,
      terrain: null,
      updatedAt: now,
    });
    existe.add(`0:${position}`);
  }

  // Tours suivants : une partie dès qu'un de ses deux enfants existe ; la
  // place sans enfant est exempte.
  for (let round = 1; round < rounds; round += 1) {
    const count = size >> (round + 1);
    for (let position = 0; position < count; position += 1) {
      const enfantA = existe.has(`${round - 1}:${position * 2}`);
      const enfantB = existe.has(`${round - 1}:${position * 2 + 1}`);
      if (!enfantA && !enfantB) continue;
      matches.push({
        id: ctx.newId(),
        concoursId,
        stage,
        round,
        position,
        teamAId: null,
        teamBId: null,
        byeA: enfantA ? undefined : true,
        byeB: enfantB ? undefined : true,
        scoreA: null,
        scoreB: null,
        done: false,
        terrain: null,
        updatedAt: now,
      });
      existe.add(`${round}:${position}`);
    }
  }

  return applyChanges(matches, propagate(matches));
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

/**
 * Taille du tableau, déduite du nombre de tours plutôt que du nombre de
 * parties du premier tour : un tableau à entrées échelonnées est creux — des
 * places du premier tour n'existent pas — et compter les parties le
 * sous-estimerait. Pour un tableau plein, le résultat est identique.
 */
export function bracketSizeOf(stageMatches: Match[]): number {
  if (stageMatches.length === 0) return 0;
  const maxRound = Math.max(...stageMatches.map((m) => m.round));
  return 1 << (maxRound + 1);
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
