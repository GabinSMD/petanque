import {
  buildChampionnat,
  buildConsolanteFromSources,
  creerSerieTir,
  defaultCtx,
  drawElimination,
  drawMainFromPoules,
  drawMeleeRonde,
  drawPoules,
  drawSwissRonde,
  isByeMatch,
  pouleOutcome,
  pouleSizes,
  propagate,
  recomputePoule,
  autoAssignTerrains,
  rondeComplete,
  rondesTirees,
  seriesTirees,
  validateScore,
  validateTirScore,
  type Concours,
  type ConcoursMode,
  type Licencie,
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
  category?: string;
  consolante: boolean;
  scoreMax: number;
  nbTerrains: number;
  nbRondes?: number;
  tempsLimite?: number;
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

/** Concours pré-rempli pour découvrir l'application sans risque. */
export async function createDemoConcours(): Promise<string> {
  const id = await createConcours({
    name: 'Concours d\'exemple — doublettes',
    date: new Date().toISOString().slice(0, 10),
    lieu: 'Boulodrome de démonstration',
    format: 'doublette',
    mode: 'poules',
    consolante: true,
    scoreMax: 13,
    nbTerrains: 8,
  });
  const demo: [string, string, string][] = [
    ['Marius Ferrand', 'Fernand Gasquet', 'La Boule Joyeuse'],
    ['Odette Blanc', 'Lucien Roux', 'La Boule Joyeuse'],
    ['Paul Escartefigue', 'César Olive', 'Pétanque du Port'],
    ['Honoré Panisse', 'Baptiste Cabris', 'Pétanque du Port'],
    ['Jeannette Micoulin', 'Rosa Torres', 'Les Boulistes du Moulin'],
    ['Ange Leandri', 'Toinou Garcia', 'Les Boulistes du Moulin'],
    ['Mireille Fabre', 'Norbert Long', 'Amicale des Platanes'],
    ['Étienne Brun', 'Félix Imbert', 'Amicale des Platanes'],
  ];
  for (const [a, b, club] of demo) {
    await addTeam(id, [{ name: a }, { name: b }], club);
  }
  return id;
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
/* Licenciés                                                           */
/* ------------------------------------------------------------------ */

export async function listLicencies(): Promise<Licencie[]> {
  const rows = await db.entities
    .where('[type+concoursId]')
    .equals(['licencie', ''])
    .toArray();
  return rows
    .filter((r) => r.deleted === 0 && r.data)
    .map((r) => r.data as Licencie);
}

/** Import en masse : met à jour par n° de licence, sinon par nom+club. */
export async function importLicencies(
  incoming: { name: string; licence?: string; club?: string }[],
): Promise<{ added: number; updated: number }> {
  const existing = await listLicencies();
  const byLicence = new Map(
    existing.filter((l) => l.licence).map((l) => [l.licence!, l]),
  );
  const byNameClub = new Map(
    existing.map((l) => [`${l.name.toLowerCase()}|${(l.club ?? '').toLowerCase()}`, l]),
  );

  const toPut: Licencie[] = [];
  let added = 0;
  let updated = 0;
  for (const row of incoming) {
    const match =
      (row.licence && byLicence.get(row.licence)) ||
      byNameClub.get(`${row.name.toLowerCase()}|${(row.club ?? '').toLowerCase()}`);
    if (match) {
      if (
        match.name !== row.name ||
        match.licence !== row.licence ||
        match.club !== row.club
      ) {
        toPut.push({ ...match, ...row });
        updated += 1;
      }
    } else {
      const licencie: Licencie = {
        id: crypto.randomUUID(),
        name: row.name,
        licence: row.licence,
        club: row.club,
        updatedAt: monotonicNow(),
      };
      toPut.push(licencie);
      byNameClub.set(
        `${row.name.toLowerCase()}|${(row.club ?? '').toLowerCase()}`,
        licencie,
      );
      if (row.licence) byLicence.set(row.licence, licencie);
      added += 1;
    }
  }
  await bulkPutEntities('licencie', toPut);
  return { added, updated };
}

export async function deleteLicencie(id: string): Promise<void> {
  await softDeleteMany([{ type: 'licencie', id }]);
}

export async function deleteAllLicencies(): Promise<void> {
  const all = await listLicencies();
  await softDeleteMany(all.map((l) => ({ type: 'licencie' as const, id: l.id })));
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
/* Rondes (mêlée, système suisse, championnat)                         */
/* ------------------------------------------------------------------ */

const TEAM_SIZE: Record<TeamFormat, number> = {
  tete_a_tete: 1,
  doublette: 2,
  triplette: 3,
};

/**
 * Tire la ronde suivante (mêlée / suisse) ou génère le calendrier
 * complet (championnat).
 */
export async function tirerRonde(concours: Concours): Promise<void> {
  const entrants = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  if (entrants.length < 2) throw new Error('Il faut au moins 2 inscrits');
  const matches = await listByConcours('match', concours.id);
  const round = rondesTirees(matches);

  let created: Match[];
  if (concours.mode === 'championnat') {
    if (round > 0) throw new Error('Le calendrier du championnat est déjà généré');
    created = buildChampionnat(concours.id, entrants, ctx());
  } else if (concours.mode === 'melee') {
    if (round > 0 && !rondeComplete(matches, round - 1)) {
      throw new Error('Terminez la ronde en cours avant d\'en tirer une nouvelle');
    }
    created = drawMeleeRonde(concours.id, entrants, round, TEAM_SIZE[concours.format], ctx());
  } else if (concours.mode === 'suisse') {
    if (round > 0 && !rondeComplete(matches, round - 1)) {
      throw new Error('Terminez la ronde en cours avant d\'en tirer une nouvelle');
    }
    created = drawSwissRonde(concours.id, entrants, matches, round, ctx());
  } else {
    throw new Error('Cette formule ne se joue pas en rondes');
  }

  // Terrains par défaut, dans la limite du disponible.
  let terrain = 1;
  for (const m of created) {
    if (!m.byeB && terrain <= concours.nbTerrains) m.terrain = terrain++;
  }
  await bulkPutEntities('match', created);
  if (concours.status !== 'rondes') {
    await putEntity('concours', { ...concours, status: 'rondes' });
  }
}

/**
 * Annule la dernière ronde tirée (mêlée / suisse) ou tout le calendrier
 * (championnat). Retour aux inscriptions s'il ne reste plus de ronde.
 */
export async function annulerDerniereRonde(concours: Concours): Promise<void> {
  const matches = (await listByConcours('match', concours.id)).filter(
    (m) => m.stage === 'ronde',
  );
  if (matches.length === 0) return;
  const last = Math.max(...matches.map((m) => m.round));
  const toDelete =
    concours.mode === 'championnat' ? matches : matches.filter((m) => m.round === last);
  await softDeleteMany(toDelete.map((m) => ({ type: 'match' as const, id: m.id })));
  const remaining = matches.length - toDelete.length;
  if (remaining === 0) {
    await putEntity('concours', { ...concours, status: 'inscriptions' });
  }
}

/* ------------------------------------------------------------------ */
/* Tir de précision                                                    */
/* ------------------------------------------------------------------ */

/** Ouvre une nouvelle série : une feuille de tir par participant. */
export async function ajouterSerieTir(concours: Concours): Promise<void> {
  const tireurs = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  if (tireurs.length < 1) throw new Error('Inscrivez au moins un tireur');
  const matches = await listByConcours('match', concours.id);
  const serie = seriesTirees(matches);
  const created = creerSerieTir(concours.id, tireurs, serie, ctx());
  await bulkPutEntities('match', created);
  if (concours.status !== 'rondes') {
    await putEntity('concours', { ...concours, status: 'rondes' });
  }
}

export async function annulerDerniereSerie(concours: Concours): Promise<void> {
  const matches = (await listByConcours('match', concours.id)).filter(
    (m) => m.stage === 'ronde',
  );
  if (matches.length === 0) return;
  const last = Math.max(...matches.map((m) => m.round));
  const toDelete = matches.filter((m) => m.round === last);
  await softDeleteMany(toDelete.map((m) => ({ type: 'match' as const, id: m.id })));
  if (matches.length === toDelete.length) {
    await putEntity('concours', { ...concours, status: 'inscriptions' });
  }
}

export async function setTirScore(match: Match, score: number): Promise<void> {
  const check = validateTirScore(score);
  if (!check.ok) throw new Error(check.error);
  await putEntity('match', { ...match, scoreA: score, done: true });
}

export async function clearTirScore(match: Match): Promise<void> {
  await putEntity('match', { ...match, scoreA: null, done: false });
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
  if (match.stage === 'ronde') return; // les rondes sont plates : rien à propager
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

/** Affecte automatiquement les parties en attente aux terrains libres. */
export async function autoAssignTerrainsAction(concours: Concours): Promise<number> {
  const matches = await listByConcours('match', concours.id);
  const assignments = autoAssignTerrains(matches, concours.nbTerrains);
  if (assignments.length === 0) return 0;
  const byId = new Map(matches.map((m) => [m.id, m]));
  const updated: Match[] = [];
  for (const a of assignments) {
    const m = byId.get(a.matchId);
    if (m) updated.push({ ...m, terrain: a.terrain });
  }
  await bulkPutEntities('match', updated);
  return updated.length;
}

export async function setPouleTerrain(poule: Poule, terrain: number | null): Promise<void> {
  await putEntity('poule', { ...poule, terrain });
}
