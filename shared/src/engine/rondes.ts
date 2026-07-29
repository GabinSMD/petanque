import type { Match, RolePetanque, Team } from '../types';
import type { EngineCtx } from './ctx';
import { shuffle } from './ctx';

/**
 * Formules « en rondes » : mêlée tournante, système suisse, championnat
 * toutes rondes. Pas d'élimination — un classement (victoires puis
 * goal-average) départage les participants.
 */

/** Score crédité à un exempt, à l'image du forfait FFPJP : victoire 13 à 7. */
export const BYE_SCORE: readonly [number, number] = [13, 7];

function baseMatch(
  concoursId: string,
  round: number,
  position: number,
  ctx: EngineCtx,
): Match {
  return {
    id: ctx.newId(),
    concoursId,
    stage: 'ronde',
    round,
    position,
    teamAId: null,
    teamBId: null,
    scoreA: null,
    scoreB: null,
    done: false,
    terrain: null,
    updatedAt: ctx.now(),
  };
}

function byeMatch(
  concoursId: string,
  teamId: string,
  round: number,
  position: number,
  ctx: EngineCtx,
): Match {
  return {
    ...baseMatch(concoursId, round, position, ctx),
    teamAId: teamId,
    byeB: true,
    scoreA: BYE_SCORE[0],
    scoreB: BYE_SCORE[1],
    done: true,
  };
}

/* ------------------------------------------------------------------ */
/* Mêlée tournante                                                     */
/* ------------------------------------------------------------------ */

/**
 * Ordre de distribution des rôles. Les rôles déclarés passent d'abord, chacun
 * réparti au plus large ; les joueurs sans rôle comblent ensuite les places
 * qui restent — c'est ce qui permet à une mêlée à moitié renseignée de donner
 * quand même des équipes jouables.
 */
const ORDRE_ROLES: readonly (RolePetanque | undefined)[] = [
  'pointeur',
  'tireur',
  'milieu',
  undefined,
];

/**
 * Tire une ronde de mêlée : les participants (inscrits individuellement)
 * sont répartis en équipes éphémères aussi égales que possible. Les
 * effectifs inégaux suivent l'usage : une triplette peut rencontrer une
 * doublette (chacun joue alors plus ou moins de boules). Personne n'est
 * exempt : tout le monde joue à chaque ronde.
 *
 * Quand les rôles de jeu sont déclarés à l'inscription, le tirage s'arrange
 * pour ne pas former une équipe de trois pointeurs : chaque rôle est étalé
 * sur le plus de camps possible. Ce n'est pas une règle mais une préférence —
 * s'il y a trois pointeurs pour un tireur, deux pointeurs joueront ensemble
 * plutôt que de laisser un joueur sur le banc.
 *
 * Le hasard reste entier : à effectif et rôles identiques, deux tirages
 * donnent deux compositions différentes.
 */
export function drawMeleeRonde(
  concoursId: string,
  players: Team[],
  round: number,
  teamSize: number,
  ctx: EngineCtx,
): Match[] {
  if (players.length < 2) throw new Error('Il faut au moins 2 participants');
  const nbMatches = Math.max(1, Math.floor(players.length / (2 * teamSize)));
  const nbCamps = nbMatches * 2;

  // Effectif de chaque camp : les premiers absorbent les joueurs en trop.
  const capacites = Array.from(
    { length: nbCamps },
    (_, i) =>
      Math.floor(players.length / nbCamps) + (i < players.length % nbCamps ? 1 : 0),
  );
  const camps: Team[][] = Array.from({ length: nbCamps }, () => []);
  const roleDe = (t: Team): RolePetanque | undefined => t.players[0]?.role;
  const combienDe = (camp: Team[], role: RolePetanque | undefined): number =>
    camp.filter((t) => roleDe(t) === role).length;

  for (const role of ORDRE_ROLES) {
    for (const joueur of shuffle(
      players.filter((t) => roleDe(t) === role),
      ctx.rng,
    )) {
      const libres = camps
        .map((camp, i) => ({ camp, i }))
        .filter(({ camp, i }) => camp.length < capacites[i]!);
      if (libres.length === 0) break;
      // Le camp qui a le moins de ce rôle, et à égalité le moins garni.
      const cout = ({ camp }: { camp: Team[] }): number =>
        combienDe(camp, role) * 100 + camp.length;
      const meilleur = Math.min(...libres.map(cout));
      const choisi = shuffle(
        libres.filter((l) => cout(l) === meilleur),
        ctx.rng,
      )[0]!;
      choisi.camp.push(joueur);
    }
  }

  const matches: Match[] = [];
  for (let m = 0; m < nbMatches; m += 1) {
    matches.push({
      ...baseMatch(concoursId, round, m, ctx),
      playersA: camps[m * 2]!.map((t) => t.id),
      playersB: camps[m * 2 + 1]!.map((t) => t.id),
    });
  }
  return matches;
}

/* ------------------------------------------------------------------ */
/* Système suisse                                                      */
/* ------------------------------------------------------------------ */

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Tire une ronde au système suisse : première ronde aléatoire, puis
 * appariement dans l'ordre du classement en évitant les revanches.
 * Effectif impair : l'équipe la moins bien classée n'ayant pas encore
 * été exempte gagne d'office 13 à 7.
 */
export interface OptionsSwiss {
  /**
   * Appariement **strict** (manuel §3.D.14.C, graphique 17) : on n'oppose que
   * des équipes ayant exactement le même nombre de victoires. Un groupe de
   * taille impaire produit donc un exempt — « d'où des exempts à certains
   * tours ». Sans cette option, l'appariement suit le classement et tolère
   * qu'un gagnant rencontre un perdant, ce qui est le graphique 15.
   */
  strict?: boolean;
}

export function drawSwissRonde(
  concoursId: string,
  teams: Team[],
  previous: Match[],
  round: number,
  ctx: EngineCtx,
  opts: OptionsSwiss = {},
): Match[] {
  if (teams.length < 2) throw new Error('Il faut au moins 2 équipes');
  const rondeMatches = previous.filter((m) => m.stage === 'ronde');

  if (opts.strict && round > 0) {
    return drawStrictRonde(concoursId, teams, rondeMatches, round, ctx);
  }

  let ranked: string[];
  if (round === 0) {
    ranked = shuffle(teams, ctx.rng).map((t) => t.id);
  } else {
    ranked = rondeStandings(teams, rondeMatches).map((s) => s.id);
  }

  let byeTeam: string | null = null;
  if (ranked.length % 2 === 1) {
    const byedBefore = new Set(
      rondeMatches.filter((m) => m.byeB && m.teamAId).map((m) => m.teamAId!),
    );
    byeTeam =
      [...ranked].reverse().find((id) => !byedBefore.has(id)) ?? ranked[ranked.length - 1]!;
    ranked = ranked.filter((id) => id !== byeTeam);
  }

  const played = new Set<string>();
  for (const m of rondeMatches) {
    if (m.teamAId && m.teamBId) played.add(pairKey(m.teamAId, m.teamBId));
  }

  const matches: Match[] = [];
  const pool = [...ranked];
  let position = 0;
  while (pool.length >= 2) {
    const a = pool.shift()!;
    let idx = pool.findIndex((b) => !played.has(pairKey(a, b)));
    if (idx === -1) idx = 0; // revanche inévitable en dernier recours
    const b = pool.splice(idx, 1)[0]!;
    matches.push({ ...baseMatch(concoursId, round, position++, ctx), teamAId: a, teamBId: b });
  }
  if (byeTeam) {
    matches.push(byeMatch(concoursId, byeTeam, round, position, ctx));
  }
  return matches;
}

/**
 * Appariement strict par nombre de victoires (graphique 17).
 *
 * Les équipes sont regroupées par victoires, et on n'apparie qu'à l'intérieur
 * d'un groupe. Un groupe impair laisse une équipe exempte — crédité 13-7 comme
 * un forfait, à l'image du reste de l'application — en évitant celles qui l'ont
 * déjà été. C'est la contrepartie assumée de la stricte égalité : le manuel
 * l'annonce explicitement.
 */
function drawStrictRonde(
  concoursId: string,
  teams: Team[],
  rondeMatches: Match[],
  round: number,
  ctx: EngineCtx,
): Match[] {
  const classement = rondeStandings(teams, rondeMatches);
  const groupes = new Map<number, string[]>();
  for (const s of classement) {
    const g = groupes.get(s.wins) ?? [];
    g.push(s.id);
    groupes.set(s.wins, g);
  }

  const dejaExempts = new Set(
    rondeMatches.filter((m) => m.byeB && m.teamAId).map((m) => m.teamAId!),
  );
  const dejaJoue = new Set<string>();
  for (const m of rondeMatches) {
    if (m.teamAId && m.teamBId) dejaJoue.add(pairKey(m.teamAId, m.teamBId));
  }

  const matches: Match[] = [];
  let position = 0;
  // Des plus victorieux aux moins victorieux : l'ordre des tables suit le
  // classement, comme sur le graphique fédéral.
  for (const victoires of [...groupes.keys()].sort((a, b) => b - a)) {
    let pool = [...groupes.get(victoires)!];

    if (pool.length % 2 === 1) {
      // Exempt : le moins bien placé du groupe qui ne l'a pas encore été.
      const exempt =
        [...pool].reverse().find((id) => !dejaExempts.has(id)) ?? pool[pool.length - 1]!;
      pool = pool.filter((id) => id !== exempt);
      matches.push(byeMatch(concoursId, exempt, round, position++, ctx));
      dejaExempts.add(exempt);
    }

    while (pool.length >= 2) {
      const a = pool.shift()!;
      let idx = pool.findIndex((b) => !dejaJoue.has(pairKey(a, b)));
      if (idx === -1) idx = 0; // revanche inévitable dans un groupe épuisé
      const b = pool.splice(idx, 1)[0]!;
      dejaJoue.add(pairKey(a, b));
      matches.push({ ...baseMatch(concoursId, round, position++, ctx), teamAId: a, teamBId: b });
    }
  }
  return matches;
}

/* ------------------------------------------------------------------ */
/* Championnat (toutes rondes)                                         */
/* ------------------------------------------------------------------ */

/**
 * Calendrier toutes rondes (méthode du cercle) : chacun rencontre chacun
 * exactement une fois. Effectif impair : chaque équipe se repose une ronde
 * (aucun point crédité, tout le monde joue le même nombre de parties).
 *
 * `maxRondes` arrête la rotation avant la fin : c'est le marathon du manuel
 * §3.D.14.B, « 3 à 10 parties par rotation circulaire ». La méthode du cercle
 * garantit qu'aucune paire ne se répète, même tronquée — on prend simplement
 * les premières rondes du calendrier.
 */
export function buildChampionnat(
  concoursId: string,
  teams: Team[],
  ctx: EngineCtx,
  maxRondes?: number,
): Match[] {
  if (teams.length < 2) throw new Error('Il faut au moins 2 équipes');
  if (maxRondes !== undefined && maxRondes < 1) {
    throw new Error('Il faut au moins une ronde');
  }
  const ids: (string | null)[] = shuffle(teams, ctx.rng).map((t) => t.id);
  if (ids.length % 2 === 1) ids.push(null); // fantôme = ronde de repos

  const size = ids.length;
  const rounds = Math.min(size - 1, maxRondes ?? size - 1);
  const half = size / 2;
  const rot = [...ids];
  const matches: Match[] = [];

  for (let r = 0; r < rounds; r++) {
    let position = 0;
    for (let i = 0; i < half; i++) {
      const a = rot[i]!;
      const b = rot[size - 1 - i]!;
      if (a === null || b === null) continue;
      matches.push({ ...baseMatch(concoursId, r, position++, ctx), teamAId: a, teamBId: b });
    }
    rot.splice(1, 0, rot.pop()!); // rotation, le premier reste fixe
  }
  return matches;
}

/** Nombre de rondes d'un championnat pour n équipes. */
export function championnatRondes(n: number): number {
  return n % 2 === 0 ? n - 1 : n;
}

/* ------------------------------------------------------------------ */
/* Classement                                                          */
/* ------------------------------------------------------------------ */

/** Les deux camps d'une partie, que ce soit des équipes ou une mêlée. */
function camps(m: Match): [string[], string[]] {
  return [
    m.playersA ?? (m.teamAId ? [m.teamAId] : []),
    m.playersB ?? (m.teamBId ? [m.teamBId] : []),
  ];
}

/** Camp vainqueur d'une partie jouée, au score ou par désignation. */
function coteGagnante(m: Match): 'A' | 'B' | null {
  if (m.scoreA !== null && m.scoreB !== null) {
    if (m.scoreA > m.scoreB) return 'A';
    if (m.scoreB > m.scoreA) return 'B';
    return null;
  }
  return m.vainqueur ?? null;
}

/**
 * Confrontation directe entre deux inscrits : `1` si le premier a gagné leurs
 * rencontres, `-1` si c'est le second, `0` s'ils ne se sont jamais rencontrés
 * ou s'ils se sont partagés les victoires.
 */
export function confrontationDirecte(aId: string, bId: string, matches: Match[]): number {
  let bilan = 0;
  for (const m of matches) {
    if (m.stage !== 'ronde' || !m.done) continue;
    const [cA, cB] = camps(m);
    const aEnA = cA.includes(aId);
    const aEnB = cB.includes(aId);
    const bEnA = cA.includes(bId);
    const bEnB = cB.includes(bId);
    // Il faut qu'ils se soient affrontés, pas qu'ils aient joué ensemble.
    if (!((aEnA && bEnB) || (aEnB && bEnA))) continue;
    const gagnante = coteGagnante(m);
    if (!gagnante) continue;
    const aGagne = (gagnante === 'A' && aEnA) || (gagnante === 'B' && aEnB);
    bilan += aGagne ? 1 : -1;
  }
  return Math.sign(bilan);
}

export interface Standing {
  id: string;
  played: number;
  wins: number;
  /** Goal-average : points marqués moins points encaissés. */
  diff: number;
  pointsFor: number;
}

/**
 * Classement des rondes : victoires, goal-average, points marqués — puis, entre
 * équipes que cela laisse à égalité, leur **confrontation directe** (manuel
 * §3.D.15 : « si confrontation directe, l'équipe victorieuse passe devant »).
 *
 * Ce dernier critère existait déjà, mais seulement dans `classementFinales`,
 * celui qui amorce les phases finales. L'écran des rondes, l'affichage public et
 * les résultats s'arrêtaient aux trois premiers : l'organisateur lisait un rang
 * et le panneau des phases finales en produisait un autre. Le critère est donc
 * remonté ici, au classement dont tout le monde part.
 *
 * En mêlée chaque joueur d'un camp est crédité individuellement.
 */
export function rondeStandings(entrants: Team[], matches: Match[]): Standing[] {
  const map = new Map<string, Standing>(
    entrants.map((t) => [t.id, { id: t.id, played: 0, wins: 0, diff: 0, pointsFor: 0 }]),
  );
  /**
   * `scored`/`conceded` à -1 signalent une partie sans score : la victoire
   * compte, mais rien n'alimente le goal-average ni les points marqués.
   */
  const credit = (id: string, scored: number, conceded: number): void => {
    const s = map.get(id);
    if (!s) return;
    s.played += 1;
    if (scored > conceded) s.wins += 1;
    if (scored < 0 || conceded < 0) return;
    s.diff += scored - conceded;
    s.pointsFor += scored;
  };

  for (const m of matches) {
    if (m.stage !== 'ronde' || !m.done) continue;
    const sideA = m.playersA ?? (m.teamAId ? [m.teamAId] : []);
    const sideB = m.playersB ?? (m.teamBId ? [m.teamBId] : []);
    if (m.scoreA !== null && m.scoreB !== null) {
      for (const id of sideA) credit(id, m.scoreA, m.scoreB);
      for (const id of sideB) credit(id, m.scoreB, m.scoreA);
      continue;
    }
    // Vainqueur désigné sans score : la victoire compte, le goal-average
    // n'existe pas. On ne l'invente pas — un 13-0 fictif fausserait le
    // départage de tout le monde.
    if (!m.vainqueur) continue;
    const gagnants = m.vainqueur === 'A' ? sideA : sideB;
    const perdants = m.vainqueur === 'A' ? sideB : sideA;
    for (const id of gagnants) credit(id, 0, -1);
    for (const id of perdants) credit(id, -1, 0);
  }

  const classement = [...map.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.diff - a.diff ||
      b.pointsFor - a.pointsFor ||
      // Dernier recours : l'identifiant. Sans lui, deux équipes strictement à
      // égalité se classent dans l'ordre où la base les a rendues — le même
      // concours affichait un classement différent d'un appareil à l'autre.
      a.id.localeCompare(b.id),
  );

  // Réordonnancement des tranches d'ex æquo par leur confrontation directe.
  // Fait par tranches et non dans le comparateur principal : la confrontation
  // n'est pas transitive (A bat B bat C bat A existe), et un comparateur non
  // transitif rend un ordre imprévisible. La tranche arrive déjà rangée par
  // identifiant et le tri est stable : le résultat reste le même quel que soit
  // l'ordre d'arrivée des équipes, y compris sur un cycle.
  for (let debut = 0; debut < classement.length; ) {
    let fin = debut + 1;
    while (fin < classement.length && memeNiveau(classement[debut]!, classement[fin]!)) fin += 1;
    if (fin - debut >= 2) {
      const tranche = classement
        .slice(debut, fin)
        .sort((a, b) => -confrontationDirecte(a.id, b.id, matches));
      for (const [i, s] of tranche.entries()) classement[debut + i] = s;
    }
    debut = fin;
  }
  return classement;
}

/** Égalité sur tous les critères chiffrés : c'est là que la confrontation parle. */
export const memeNiveau = (a: Standing, b: Standing): boolean =>
  a.wins === b.wins && a.diff === b.diff && a.pointsFor === b.pointsFor;

/** Nombre de rondes déjà tirées. */
export function rondesTirees(matches: Match[]): number {
  const rondes = matches.filter((m) => m.stage === 'ronde');
  if (rondes.length === 0) return 0;
  return Math.max(...rondes.map((m) => m.round)) + 1;
}

/** Une ronde est complète quand toutes ses parties sont saisies. */
export function rondeComplete(matches: Match[], round: number): boolean {
  const ms = matches.filter((m) => m.stage === 'ronde' && m.round === round);
  return ms.length > 0 && ms.every((m) => m.done);
}
