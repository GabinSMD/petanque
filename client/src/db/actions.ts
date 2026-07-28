import {
  buildChampionnat,
  buildConsolanteFromSources,
  buildFormuleBrackets,
  buildStagedBracket,
  creerSerieTir,
  defaultCtx,
  drawElimination,
  drawMainFromPoules,
  drawMeleeRonde,
  drawPoules,
  drawSwissRonde,
  firstRoundSources,
  formuleOf,
  isByeMatch,
  numeroPremiereEquipe,
  pouleOutcome,
  pouleSizes,
  propagate,
  recomputePoule,
  renommerIdentifiants,
  autoAssignTerrains,
  rondeComplete,
  rondesTirees,
  seriesTirees,
  terrainNumeros,
  terrainsPoule,
  validateScore,
  validateTirScore,
  type Concours,
  type CategorieAge,
  type ConcoursMode,
  type CritereClassification,
  type CritereSexe,
  type Discipline,
  type Formule,
  type NiveauConcours,
  type Licencie,
  type LicencieRow,
  type Match,
  type Player,
  type Poule,
  type Sauvegarde,
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
  discipline?: Discipline;
  category?: string;
  nbQualifies?: number;
  consolante: boolean;
  complementaire?: boolean;
  /** Formule fédérale du tableau (élimination directe). */
  formule?: Formule;
  /** Poules : perdants du 1er tour du tableau reversés au cadrage de la consolante. */
  recupCadrage?: boolean;
  /** Désigner le vainqueur sans saisir le score. */
  vainqueurSeul?: boolean;
  /** Paramètres fédéraux. */
  niveau?: NiveauConcours;
  comiteOrganisateur?: string;
  clubOrganisateur?: string;
  decalageEquipe?: number;
  decalageTerrain?: number;
  /** Critères de contrôle des licences. */
  categorieAge?: CategorieAge;
  strict?: boolean;
  critereSexe?: CritereSexe;
  critereClassification?: CritereClassification;
  homogene?: boolean;
  scoreMax: number;
  nbTerrains: number;
  nbRondes?: number;
  tempsLimite?: number;
  miseParEquipe?: number;
  planTerrains?: boolean;
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

/**
 * Réimporte une sauvegarde (manuel §3.F.2).
 *
 * `nouveau` réécrit tous les identifiants : la sauvegarde arrive à côté de
 * l'existant, sans rien écraser. `remplacer` restaure à l'identique, ce qui
 * détruit l'état actuel du concours — y compris les entités absentes du
 * fichier, sans quoi on obtiendrait un mélange des deux.
 */
export async function importSauvegarde(
  sauvegarde: Sauvegarde,
  mode: 'nouveau' | 'remplacer',
): Promise<string> {
  const s =
    mode === 'nouveau' ? renommerIdentifiants(sauvegarde, () => crypto.randomUUID()) : sauvegarde;

  if (mode === 'remplacer') {
    // Ce que le concours contient aujourd'hui et que la sauvegarde ignore doit
    // disparaître : une restauration n'est pas une fusion.
    const gardes = new Set([
      ...s.teams.map((t) => t.id),
      ...s.poules.map((p) => p.id),
      ...s.matches.map((m) => m.id),
    ]);
    const existants = await db.entities.where('concoursId').equals(s.concours.id).toArray();
    const aSupprimer = existants
      .filter((r) => r.deleted === 0 && r.type !== 'concours' && !gardes.has(r.id))
      .map((r) => ({ type: r.type, id: r.id }));
    if (aSupprimer.length > 0) await softDeleteMany(aSupprimer);
  }

  await putEntity('concours', s.concours);
  await bulkPutEntities('team', s.teams);
  await bulkPutEntities('poule', s.poules);
  await bulkPutEntities('match', s.matches);
  return s.concours.id;
}

/** Un concours de cet identifiant existe-t-il déjà sur cet appareil ? */
export async function concoursExiste(id: string): Promise<boolean> {
  return Boolean(await getEntity('concours', id));
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
  const concours = await getEntity('concours', concoursId);
  const number = numeroPremiereEquipe(
    teams.map((t) => t.number),
    concours?.decalageEquipe,
  );
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
  incoming: LicencieRow[],
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
      // Un import partiel ne doit pas effacer ce qu'on sait déjà : on ne
      // remplace un champ que si le fichier en apporte une valeur.
      const merged: Licencie = { ...match };
      let changed = false;
      for (const [k, v] of Object.entries(row) as [keyof LicencieRow, unknown][]) {
        if (v === undefined || v === '') continue;
        if (merged[k as keyof Licencie] !== v) {
          (merged as unknown as Record<string, unknown>)[k] = v;
          changed = true;
        }
      }
      if (changed) {
        toPut.push(merged);
        updated += 1;
      }
    } else {
      const licencie: Licencie = {
        ...row,
        id: crypto.randomUUID(),
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

export function pouleSummary(teamCount: number, nbTerrains?: number): string | null {
  const sizes = pouleSizes(teamCount, nbTerrains);
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
  sansProtection: boolean,
  seeds: string[] = [],
): Promise<void> {
  const teams = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  const draw = drawPoules(concours.id, teams, ctx(), {
    nbTerrains: concours.nbTerrains,
    sansProtection,
    protections: concours.protections ?? [],
    seeds,
  });
  if (!draw) {
    throw new Error(
      `Effectif incompatible avec des poules (${teams.length} équipes). ` +
        'Ajoutez ou retirez une équipe.',
    );
  }
  /**
   * Terrains des poules. Avec au moins deux jeux par poule, on applique la
   * convention fédérale rappelée au §3.D.1.A : chaque poule occupe deux jeux
   * voisins, les gagnants sur l'impair (« du haut »), les perdants et le
   * barrage sur le pair. Sinon on distribue simplement les premières parties.
   */
  const numeros = terrainNumeros(concours.nbTerrains, concours.decalageTerrain);
  const conventionPossible = concours.nbTerrains >= draw.poules.length * 2;
  if (conventionPossible) {
    const pouleIndexById = new Map(draw.poules.map((p) => [p.id, p.index]));
    for (const m of draw.matches) {
      const index = m.pouleId ? pouleIndexById.get(m.pouleId) : undefined;
      if (!index) continue;
      const { haut, bas } = terrainsPoule(index, concours.decalageTerrain);
      if (m.pouleSlot === 'M1' || m.pouleSlot === 'GAGNANTS') m.terrain = haut;
      else m.terrain = bas;
    }
  } else {
    let i = 0;
    for (const m of draw.matches) {
      if ((m.pouleSlot === 'M1' || m.pouleSlot === 'M2') && i < numeros.length) {
        m.terrain = numeros[i++]!;
      }
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
  let comp: Match[] = [];
  if (concours.consolante) {
    const eliminatedIds = outcomes.flatMap((o) => o.eliminated);
    const teams = await listByConcours('team', concours.id);
    const eliminated = teams.filter((t) => eliminatedIds.includes(t.id));
    if (eliminated.length >= 2) {
      if (concours.recupCadrage) {
        // §3.D.4 : les éliminés de poules ouvrent la consolante, les perdants
        // du 1er tour du tableau principal les rejoignent au cadrage.
        conso = buildStagedBracket(
          concours.id,
          'consolante',
          [
            ...eliminated.map((t) => ({ teamId: t.id, round: 0 })),
            ...firstRoundSources(main, 'principal').map((id) => ({ loserFrom: id, round: 1 })),
          ],
          ctx(),
        );
      } else {
        conso = drawElimination(concours.id, 'consolante', eliminated, ctx());
      }
      if (concours.complementaire) {
        const sources = firstRoundSources(conso, 'consolante');
        comp = buildConsolanteFromSources(concours.id, sources, ctx(), 'complementaire');
      }
    }
  }
  await bulkPutEntities('match', [...main, ...conso, ...comp]);
  await putEntity('concours', { ...concours, status: 'tableau' });
}

export async function generateTableauDirect(
  concours: Concours,
  sansProtection: boolean,
  seeds: string[] = [],
): Promise<void> {
  const teams = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  if (teams.length < 2) throw new Error('Il faut au moins 2 équipes');
  const main = drawElimination(concours.id, 'principal', teams, ctx(), {
    sansProtection,
    protections: concours.protections ?? [],
    seeds,
  });
  // Tableaux B et C selon la formule fédérale (perdants reversés d'un
  // tableau à l'autre) — voir `buildFormuleBrackets`.
  const secondary = buildFormuleBrackets(concours.id, main, formuleOf(concours), ctx());
  await bulkPutEntities('match', [...main, ...secondary]);
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
  const numeros = terrainNumeros(concours.nbTerrains, concours.decalageTerrain);
  let i = 0;
  for (const m of created) {
    if (!m.byeB && i < numeros.length) m.terrain = numeros[i++]!;
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

/**
 * Désigne le vainqueur d'une partie sans saisir le score (concours « ouvert à
 * tous »). On efface les scores éventuels : garder les deux serait ambigu, et
 * le score primerait silencieusement sur le clic.
 */
export async function setMatchVainqueur(
  concours: Concours,
  match: Match,
  cote: 'A' | 'B',
): Promise<void> {
  await putEntity('match', { ...match, vainqueur: cote, scoreA: null, scoreB: null, done: true });
  await recomputeAfter(concours, match);
}

export async function setScore(
  concours: Concours,
  match: Match,
  scoreA: number,
  scoreB: number,
): Promise<void> {
  const check = validateScore(scoreA, scoreB, concours.scoreMax);
  if (!check.ok) throw new Error(check.error);
  // Le score prime : on retire le vainqueur désigné pour n'avoir qu'une vérité.
  await putEntity('match', { ...match, scoreA, scoreB, vainqueur: undefined, done: true });
  await recomputeAfter(concours, match);
}

export async function clearScore(concours: Concours, match: Match): Promise<void> {
  await putEntity('match', {
    ...match,
    scoreA: null,
    scoreB: null,
    vainqueur: undefined,
    done: false,
  });
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
/**
 * Bloque ou libère un terrain pendant le concours (manuel §3.D.1.B.5.2).
 * Bloquer ne déplace pas la partie en cours : le terrain cesse simplement
 * d'être attribué ensuite.
 */
export async function setTerrainBloque(
  concours: Concours,
  terrain: number,
  bloque: boolean,
): Promise<void> {
  const actuels = new Set(concours.terrainsBloques ?? []);
  if (bloque) actuels.add(terrain);
  else actuels.delete(terrain);
  const liste = [...actuels].sort((a, b) => a - b);
  await putEntity('concours', {
    ...concours,
    terrainsBloques: liste.length > 0 ? liste : undefined,
  });
}

/** Ajoute ou retire des terrains en cours de concours. */
export async function setNbTerrains(concours: Concours, nbTerrains: number): Promise<void> {
  const n = Math.max(1, Math.min(200, Math.round(nbTerrains)));
  await putEntity('concours', { ...concours, nbTerrains: n });
}

/** Enregistre (ou annule) le dépôt des licences d'une équipe (manuel §3.C). */
export async function setLicencesDeposees(team: Team, depose: boolean): Promise<void> {
  await putEntity('team', {
    ...team,
    licencesDeposees: depose ? monotonicNow() : undefined,
  });
}

/**
 * Certificat médical validé à la main, sur présentation du papier. La liste
 * vit sur le concours : la validation ne vaut que pour cette compétition.
 */
export async function setCertificatValide(
  concours: Concours,
  licence: string,
  valide: boolean,
): Promise<void> {
  const actuels = new Set(concours.certificatsValides ?? []);
  if (valide) actuels.add(licence);
  else actuels.delete(licence);
  const liste = [...actuels].sort();
  await putEntity('concours', {
    ...concours,
    certificatsValides: liste.length > 0 ? liste : undefined,
  });
}

/**
 * Signale (ou lève) un retard sur une partie : l'équipe gagnante n'est pas
 * venue annoncer son résultat à la table de marque (manuel §3.D.1.D).
 */
export async function setMatchRetard(match: Match, retard: boolean): Promise<void> {
  await putEntity('match', { ...match, retard: retard || undefined });
}

export async function autoAssignTerrainsAction(concours: Concours): Promise<number> {
  const matches = await listByConcours('match', concours.id);
  const assignments = autoAssignTerrains(
    matches,
    concours.nbTerrains,
    concours.decalageTerrain,
    concours.terrainsBloques ?? [],
  );
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
