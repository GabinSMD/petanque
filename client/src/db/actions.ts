import {
  buildConsolanteFromSources,
  defaultCtx,
  drawElimination,
  drawMainFromPoules,
  drawPoules,
  isByeMatch,
  pouleOutcome,
  pouleSizes,
  propagate,
  recomputePoule,
  validateScore,
  type Concours,
  type ConcoursMode,
  type Match,
  type Player,
  type Poule,
  type Team,
  type TeamFormat,
} from '@shared';
import { db } from './local';
import {
  bulkPutEntities,
  getEntity,
  listByConcours,
  monotonicNow,
  putEntity,
  softDeleteMany,
} from './repo';

const ctx = () => defaultCtx();

/* ------------------------------------------------------------------ */
/* Concours                                                            */
/* ------------------------------------------------------------------ */

export interface ConcoursInput {
  name: string;
  date: string;
  lieu?: string;
  format: TeamFormat;
  mode: ConcoursMode;
  consolante: boolean;
  scoreMax: number;
  nbTerrains: number;
}

export async function createConcours(input: ConcoursInput): Promise<string> {
  const now = monotonicNow();
  const concours: Concours = {
    id: crypto.randomUUID(),
    ...input,
    status: 'inscriptions',
    createdAt: now,
    updatedAt: now,
  };
  await putEntity('concours', concours);
  return concours.id;
}

export async function updateConcours(concours: Concours): Promise<void> {
  await putEntity('concours', concours);
}

/** Supprime le concours et tout ce qui s'y rattache (pierres tombales). */
export async function deleteConcours(concoursId: string): Promise<void> {
  const children = await db.entities.where('concoursId').equals(concoursId).toArray();
  await softDeleteMany(
    children
      .filter((r) => r.deleted === 0)
      .map((r) => ({ type: r.type, id: r.id })),
  );
}

/* ------------------------------------------------------------------ */
/* Équipes                                                             */
/* ------------------------------------------------------------------ */

export async function addTeam(
  concoursId: string,
  players: Player[],
  club?: string,
): Promise<void> {
  const teams = await listByConcours('team', concoursId);
  const number = teams.reduce((max, t) => Math.max(max, t.number), 0) + 1;
  const team: Team = {
    id: crypto.randomUUID(),
    concoursId,
    number,
    players,
    club: club?.trim() || undefined,
    forfait: false,
    updatedAt: monotonicNow(),
  };
  await putEntity('team', team);
}

export async function updateTeam(team: Team): Promise<void> {
  await putEntity('team', team);
}

export async function deleteTeam(team: Team): Promise<void> {
  await softDeleteMany([{ type: 'team', id: team.id }]);
}

/* ------------------------------------------------------------------ */
/* Poules                                                              */
/* ------------------------------------------------------------------ */

export function pouleSummary(teamCount: number): string | null {
  const sizes = pouleSizes(teamCount);
  if (!sizes) return null;
  const fours = sizes.filter((s) => s === 4).length;
  const threes = sizes.filter((s) => s === 3).length;
  const parts: string[] = [];
  if (fours > 0) parts.push(`${fours} poule${fours > 1 ? 's' : ''} de 4`);
  if (threes > 0) parts.push(`${threes} poule${threes > 1 ? 's' : ''} de 3`);
  return parts.join(' et ');
}

export async function generatePoules(
  concours: Concours,
  avoidSameClub: boolean,
): Promise<void> {
  const teams = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  const draw = drawPoules(concours.id, teams, ctx(), { avoidSameClub });
  if (!draw) {
    throw new Error(
      `Effectif incompatible avec des poules (${teams.length} équipes). ` +
        'Ajoutez ou retirez une équipe.',
    );
  }
  // Terrains par défaut : les premières parties de chaque poule.
  let terrain = 1;
  for (const m of draw.matches) {
    if ((m.pouleSlot === 'M1' || m.pouleSlot === 'M2') && terrain <= concours.nbTerrains) {
      m.terrain = terrain++;
    }
  }
  await bulkPutEntities('poule', draw.poules);
  await bulkPutEntities('match', draw.matches);
  await putEntity('concours', { ...concours, status: 'poules' });
}

/** Annule le tirage des poules (et tout tableau éventuel). */
export async function cancelPoules(concours: Concours): Promise<void> {
  const poules = await listByConcours('poule', concours.id);
  const matches = await listByConcours('match', concours.id);
  await softDeleteMany([
    ...poules.map((p) => ({ type: 'poule' as const, id: p.id })),
    ...matches.map((m) => ({ type: 'match' as const, id: m.id })),
  ]);
  await putEntity('concours', { ...concours, status: 'inscriptions' });
}

/* ------------------------------------------------------------------ */
/* Tableaux                                                            */
/* ------------------------------------------------------------------ */

export async function generateTableauFromPoules(concours: Concours): Promise<void> {
  const poules = await listByConcours('poule', concours.id);
  const matches = await listByConcours('match', concours.id);
  const outcomes = poules
    .sort((a, b) => a.index - b.index)
    .map((p) => pouleOutcome(p, matches.filter((m) => m.pouleId === p.id)));
  if (outcomes.length === 0) throw new Error('Aucune poule à exploiter');
  if (outcomes.some((o) => !o.complete)) {
    throw new Error('Toutes les poules doivent être terminées');
  }

  const main = drawMainFromPoules(concours.id, outcomes, ctx());
  let conso: Match[] = [];
  if (concours.consolante) {
    const eliminatedIds = outcomes.flatMap((o) => o.eliminated);
    const teams = await listByConcours('team', concours.id);
    const eliminated = teams.filter((t) => eliminatedIds.includes(t.id));
    if (eliminated.length >= 2) {
      conso = drawElimination(concours.id, 'consolante', eliminated, ctx());
    }
  }
  await bulkPutEntities('match', [...main, ...conso]);
  await putEntity('concours', { ...concours, status: 'tableau' });
}

export async function generateTableauDirect(
  concours: Concours,
  avoidSameClub: boolean,
): Promise<void> {
  const teams = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  if (teams.length < 2) throw new Error('Il faut au moins 2 équipes');
  const main = drawElimination(concours.id, 'principal', teams, ctx(), { avoidSameClub });
  let conso: Match[] = [];
  if (concours.consolante) {
    const sources = main
      .filter((m) => m.round === 0 && !isByeMatch(m))
      .sort((a, b) => a.position - b.position)
      .map((m) => m.id);
    conso = buildConsolanteFromSources(concours.id, sources, ctx());
  }
  await bulkPutEntities('match', [...main, ...conso]);
  await putEntity('concours', { ...concours, status: 'tableau' });
}

/** Annule le tableau (principal + consolante), retour à l'étape précédente. */
export async function cancelTableau(concours: Concours): Promise<void> {
  const matches = await listByConcours('match', concours.id);
  const bracket = matches.filter((m) => m.stage !== 'poule');
  await softDeleteMany(bracket.map((m) => ({ type: 'match' as const, id: m.id })));
  await putEntity('concours', {
    ...concours,
    status: concours.mode === 'poules' ? 'poules' : 'inscriptions',
  });
}

/* ------------------------------------------------------------------ */
/* Scores                                                              */
/* ------------------------------------------------------------------ */

export async function setScore(
  concours: Concours,
  match: Match,
  scoreA: number,
  scoreB: number,
): Promise<void> {
  const check = validateScore(scoreA, scoreB, concours.scoreMax);
  if (!check.ok) throw new Error(check.error);
  await putEntity('match', { ...match, scoreA, scoreB, done: true });
  await recomputeAfter(concours, match);
}

export async function clearScore(concours: Concours, match: Match): Promise<void> {
  await putEntity('match', { ...match, scoreA: null, scoreB: null, done: false });
  await recomputeAfter(concours, match);
}

/** Répercute une saisie : poule ou tableau, corrections en cascade comprises. */
async function recomputeAfter(concours: Concours, match: Match): Promise<void> {
  if (match.stage === 'poule' && match.pouleId) {
    const poule = await getEntity('poule', match.pouleId);
    if (!poule) return;
    const pouleMatches = (await listByConcours('match', concours.id)).filter(
      (m) => m.pouleId === poule.id,
    );
    const changed = recomputePoule(poule, pouleMatches);
    await bulkPutEntities('match', changed);
  } else {
    const all = (await listByConcours('match', concours.id)).filter(
      (m) => m.stage !== 'poule',
    );
    const changed = propagate(all);
    await bulkPutEntities('match', changed);
  }
}

export async function setMatchTerrain(match: Match, terrain: number | null): Promise<void> {
  await putEntity('match', { ...match, terrain });
}

export async function setPouleTerrain(poule: Poule, terrain: number | null): Promise<void> {
  await putEntity('poule', { ...poule, terrain });
}
