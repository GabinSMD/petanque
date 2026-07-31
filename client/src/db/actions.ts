import {
  buildChampionnat,
  buildConsolanteFromSources,
  buildFormuleBrackets,
  buildStagedBracket,
  buildTableauVide,
  creerSerieTir,
  defaultCtx,
  drawElimination,
  drawMainFromPoules,
  drawMeleeRonde,
  drawGroupesABC,
  drawPoules,
  drawSwissRonde,
  firstRoundSources,
  formuleOf,
  isByeMatch,
  nbToursQualification,
  numeroPremiereEquipe,
  pouleGroupOutcome,
  pouleOutcome,
  placerQualifie,
  pouleSizes,
  propagate,
  qualifiesManquants,
  recomputePoule,
  renommerIdentifiants,
  autoAssignTerrains,
  rondeComplete,
  rondesTirees,
  seriesTirees,
  terrainNumeros,
  tronquerTableau,
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
  type LicencieEtranger,
  type SaisieFicheEtrangere,
  normaliserFicheEtrangere,
  type LicencieRow,
  type Match,
  type Player,
  type Poule,
  type Sauvegarde,
  type Team,
  type TeamFormat,
  CONFIGS_FINALES,
  archiver,
  buildFinales,
  feuilleDepuisMemoire,
  modificationApresTirage,
  feuilleVierge,
  lireFeuilleFichier,
  lireInscritsCsv,
  desarchiver,
  repartirEntreSites,
  classementFinales,
  renumeroterPourInsertion,
  eliminesManquants,
  marquerRetirage,
  placerVainqueur,
  vainqueursManquants,
  photoAcceptable,
} from '@shared';
import type { EmplacementPhoto, FeuilleMatch, Site } from '@shared';
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
  ggStrict?: boolean;
  tirageDiffere?: boolean;
  retirageParTour?: boolean;
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

/**
 * Range un concours (manuel §3.F.3) : il sort des listes courantes sans rien
 * perdre — ni ses équipes, ni ses parties, ni ses résultats. C'est l'inverse
 * de la suppression, pas une variante.
 */
export async function archiverConcours(concours: Concours): Promise<void> {
  await putEntity('concours', archiver(concours, monotonicNow()));
}

/** Remet un concours dans les listes courantes. */
export async function desarchiverConcours(concours: Concours): Promise<void> {
  await putEntity('concours', desarchiver(concours));
}

/**
 * Fractionne un concours en un concours par site (manuel §3.B.10.D).
 *
 * Les équipes sont réparties proportionnellement aux terrains de chaque site,
 * clubs gardés ensemble. Chaque site devient un concours autonome, avec son
 * lieu et ses terrains ; le concours d'origine est archivé — il garde la trace
 * du fractionnement sans encombrer la liste courante.
 *
 * Les dossards sont conservés : les listes d'inscrits déjà imprimées restent
 * valables. Un site peut donc avoir des numéros non contigus.
 */
export async function fractionnerMultisite(
  concours: Concours,
  sites: Site[],
): Promise<string[]> {
  if (concours.status !== 'inscriptions') {
    throw new Error(
      'Fractionnez avant le tirage : le concours doit encore être aux inscriptions',
    );
  }
  // Les forfaits ne prennent pas la place de quelqu'un sur un site ; ils
  // restent dans le concours d'origine, archivé.
  const teams = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  const repartition = repartirEntreSites(teams, sites, ctx());
  const parId = new Map(teams.map((t) => [t.id, t]));
  const now = monotonicNow();

  const crees: string[] = [];
  for (const { site, teamIds } of repartition) {
    const id = crypto.randomUUID();
    const enfant: Concours = {
      ...concours,
      id,
      name: `${concours.name} — ${site.nom}`,
      lieu: site.nom,
      nbTerrains: site.nbTerrains,
      issuDeConcours: concours.id,
      archiveLe: undefined,
      status: 'inscriptions',
      createdAt: now,
      updatedAt: now,
    };
    await putEntity('concours', enfant);
    await bulkPutEntities(
      'team',
      teamIds.map((teamId) => ({
        ...parId.get(teamId)!,
        id: crypto.randomUUID(),
        concoursId: id,
        updatedAt: now,
      })),
    );
    crees.push(id);
  }

  await putEntity('concours', archiver(concours, now));
  return crees;
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

/**
 * Insère une équipe à un dossard donné (manuel §3.B.1, zone 24).
 *
 * Les dossards suivants montent d'un cran. Réservé aux inscriptions : après le
 * tirage, §3.B.8 interdit de toucher aux numéros — le tableau et les listes
 * imprimées en dépendent.
 */
export async function insererEquipe(
  concours: Concours,
  dossard: number,
  players: Player[],
  club?: string,
): Promise<void> {
  if (concours.status !== 'inscriptions') {
    throw new Error('Le tirage est fait : les dossards ne changent plus (§3.B.8).');
  }
  const teams = await listByConcours('team', concours.id);
  const changements = renumeroterPourInsertion(teams, dossard);
  const parId = new Map(teams.map((t) => [t.id, t]));
  const decalees = changements.map((c) => ({ ...parId.get(c.id)!, number: c.number }));
  // Les décalages d'abord : la nouvelle équipe prend une place libérée, jamais
  // un dossard encore occupé.
  if (decalees.length > 0) await bulkPutEntities('team', decalees);
  await putEntity('team', {
    id: crypto.randomUUID(),
    concoursId: concours.id,
    number: dossard,
    players,
    club: club?.trim() || undefined,
    forfait: false,
    updatedAt: monotonicNow(),
  });
}

/**
 * Enregistre une équipe modifiée.
 *
 * Après le tirage, la règle du manuel §3.B.8 s'applique : la composition peut
 * changer — c'est fait pour, un joueur se remplace — mais pas ce sur quoi le
 * tirage repose. La vérification est ici, au point d'écriture, et pas seulement
 * dans l'écran : un champ masqué n'est pas une garantie.
 */
export async function updateTeam(team: Team): Promise<void> {
  const concours = await getEntity('concours', team.concoursId);
  if (concours && concours.status !== 'inscriptions') {
    const avant = await getEntity('team', team.id);
    if (avant) {
      const verdict = modificationApresTirage(avant, team);
      if (!verdict.ok) throw new Error(verdict.raison);
    }
  }
  await putEntity('team', team);
}

/**
 * Insère une liste d'inscrits lue dans un fichier (manuel §3.B.10.B).
 *
 * Les dossards du fichier sont conservés quand c'est possible — un concours
 * vide, des numéros tous présents et sans doublon avec l'existant : c'est le cas
 * du club qui repart de l'export d'un qualificatif, et ses listes papier restent
 * valables. Sinon les équipes sont ajoutées à la suite, avec des numéros neufs.
 */
export async function importerInscrits(
  concours: Concours,
  texte: string,
): Promise<{ ok: true; ajoutees: number; ignorees: number; numerosConserves: boolean } | { ok: false; erreur: string }> {
  if (concours.status !== 'inscriptions') {
    return { ok: false, erreur: 'Importez avant le tirage : les inscriptions sont verrouillées.' };
  }
  const lecture = lireInscritsCsv(texte);
  if (!lecture.ok) return { ok: false, erreur: lecture.erreur };

  const existantes = await listByConcours('team', concours.id);
  const numerosPris = new Set(existantes.map((t) => t.number));
  const numerosDuFichier = lecture.equipes.map((e) => e.number);
  const tousNumerotes = numerosDuFichier.every((n) => typeof n === 'number');
  const sansDoublon = new Set(numerosDuFichier).size === numerosDuFichier.length;
  const libres = numerosDuFichier.every((n) => n === undefined || !numerosPris.has(n));
  const numerosConserves = tousNumerotes && sansDoublon && libres;

  const now = monotonicNow();
  let prochain = numeroPremiereEquipe(
    existantes.map((t) => t.number),
    concours.decalageEquipe,
  );
  const nouvelles: Team[] = lecture.equipes.map((e) => ({
    id: crypto.randomUUID(),
    concoursId: concours.id,
    number: numerosConserves ? e.number! : prochain++,
    players: e.players.map((p) => ({
      name: p.name,
      licence: p.licence,
      club: p.club ?? e.club,
    })),
    club: e.club,
    forfait: e.forfait,
    paid: e.paid || undefined,
    updatedAt: now,
  }));

  try {
    await bulkPutEntities('team', nouvelles);
  } catch (err) {
    // Le fichier a produit une équipe que la base refuse : l'import rend son
    // motif comme les autres refus, plutôt que de remonter une exception nue.
    return {
      ok: false,
      erreur: `Import refusé : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return {
    ok: true,
    ajoutees: nouvelles.length,
    ignorees: lecture.ignorees,
    numerosConserves,
  };
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

/* ------------------------------------------------------------------ */
/* Base personnelle de licenciés étrangers (§3.B.1, zone 21)           */
/* ------------------------------------------------------------------ */

/**
 * Base **personnelle**, distincte du fichier fédéral : ces fiches sont saisies à
 * la main et doivent survivre à un « vider et réimporter » des licenciés.
 */
export async function listLicenciesEtrangers(): Promise<LicencieEtranger[]> {
  const rows = await db.entities
    .where('[type+concoursId]')
    .equals(['licencieEtranger', ''])
    .toArray();
  return rows
    .filter((r) => r.deleted === 0 && r.data)
    .map((r) => r.data as LicencieEtranger)
    .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
}

/**
 * Enregistre une fiche. Une fiche existante est reconnue par son numéro de
 * licence, sinon par nom + prénom + pays : rescanner le même Suisse ne doit pas
 * créer un deuxième exemplaire.
 */
export async function saveLicencieEtranger(
  saisie: SaisieFicheEtrangere,
): Promise<{ ok: true; fiche: LicencieEtranger } | { ok: false; raison: string }> {
  const r = normaliserFicheEtrangere(saisie);
  if (!r.ok) return r;
  const base = await listLicenciesEtrangers();
  const cle = (f: { licence?: string; nom: string; prenom: string; pays: string }): string =>
    f.licence?.trim()
      ? `l:${f.licence.trim().toUpperCase()}`
      : `n:${f.nom}|${f.prenom}|${f.pays}`;
  const existante = base.find((f) => cle(f) === cle(r.fiche));
  const fiche: LicencieEtranger = {
    ...r.fiche,
    id: existante?.id ?? crypto.randomUUID(),
    updatedAt: monotonicNow(),
  };
  await putEntity('licencieEtranger', fiche);
  return { ok: true, fiche };
}

export async function deleteLicencieEtranger(id: string): Promise<void> {
  await softDeleteMany([{ type: 'licencieEtranger', id }]);
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
    sansBarrage: concours.parGroupes === true,
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
  // Formule par groupes : les trois concours se tirent quand les groupes sont
  // finis, chacun recevant une tranche différente. Pas de tableau anticipé.
  if (concours.parGroupes) {
    await bulkPutEntities('poule', draw.poules);
    await bulkPutEntities('match', draw.matches);
    await putEntity('concours', { ...concours, status: 'poules' });
    return;
  }

  // Tableau créé vide dès maintenant : les qualifiés y entreront au fil des
  // poules, sans attendre la dernière (manuel §3.D.1.A).
  const nbAttendus = draw.poules.length * 2;
  const complet = buildTableauVide(concours.id, nbAttendus, ctx());
  // Qualificatif par poules (manuel §3.D.2) : le tableau s'arrête au nombre
  // de qualifiés demandé.
  const toursQualif = concours.nbQualifies
    ? nbToursQualification(nbAttendus, concours.nbQualifies)
    : null;
  const tableauBrut =
    toursQualif !== null && toursQualif > 0 ? tronquerTableau(complet, toursQualif) : complet;
  // Retirage à chaque tour (§3.D.1.A) : les tours au-delà du premier portent la
  // marque, et se rempliront par tirage au lieu de suivre l'arbre.
  const tableau = concours.retirageParTour
    ? marquerRetirage(tableauBrut, 'principal')
    : tableauBrut;

  /**
   * Consolante créée vide elle aussi (manuel §3.D.3) : les éliminés y entrent
   * au fil des poules, comme les qualifiés au tableau principal. Une poule
   * finie fait donc jouer ses sortants sans attendre les autres.
   *
   * Deux cas gardent l'ancien chemin, à la clôture des poules : la
   * récupération au cadrage (§3.D.4), où la consolante mêle éliminés et
   * perdants du tableau, et la formule par groupes (§3.D.5), qui répartit en
   * trois concours. Ils sont plus intriqués et attendent leur propre lot.
   */
  const nbElimines = draw.poules.reduce(
    (n, p) => n + (p.teamIds.length === 4 ? 2 : 1),
    0,
  );
  const consolante =
    concours.consolante && !concours.recupCadrage && nbElimines >= 2
      ? buildTableauVide(concours.id, nbElimines, ctx(), 'consolante')
      : [];

  await bulkPutEntities('poule', draw.poules);
  await bulkPutEntities('match', [...draw.matches, ...tableau, ...consolante]);
  await putEntity('concours', { ...concours, status: 'poules' });
}

/**
 * Tire les trois concours de la formule par groupes (manuel §3.D.5), une fois
 * tous les groupes terminés : A pour les équipes à 2 victoires, B pour celles à
 * 1 — les deux du groupe — et C pour celles à 2 défaites.
 */
export async function generateConcoursGroupes(concours: Concours): Promise<void> {
  const [poules, matches, teams] = await Promise.all([
    listByConcours('poule', concours.id),
    listByConcours('match', concours.id),
    listByConcours('team', concours.id),
  ]);
  if (matches.some((m) => m.stage !== 'poule')) {
    throw new Error('Les concours A, B et C sont déjà tirés');
  }
  const bilans = poules.map((p) =>
    pouleGroupOutcome(
      p,
      matches.filter((m) => m.pouleId === p.id),
    ),
  );
  const created = drawGroupesABC(concours.id, bilans, teams, ctx(), {
    protections: concours.protections ?? [],
  });

  // Terrains par défaut sur les premières parties, dans la limite du disponible.
  const numeros = terrainNumeros(concours.nbTerrains, concours.decalageTerrain);
  let i = 0;
  for (const m of created) {
    if (m.round === 0 && !m.byeA && !m.byeB && i < numeros.length) m.terrain = numeros[i++]!;
  }
  await bulkPutEntities('match', created);
  await putEntity('concours', { ...concours, status: 'tableau' });
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

  // Le tableau principal existe déjà et s'est rempli au fil des poules. On ne
  // le retire pas : les parties déjà jouées le seraient avec. Il n'est tiré
  // ici que pour un concours commencé avant cette façon de faire.
  const existants = await listByConcours('match', concours.id);
  const dejaLa = existants.some((m) => m.stage === 'principal');
  const main = dejaLa ? [] : drawMainFromPoules(concours.id, outcomes, ctx());
  let conso: Match[] = [];
  let comp: Match[] = [];
  // La consolante alimentée au fil des poules (§3.D.3) existe déjà : la tirer
  // ici en créerait une seconde, et les parties déjà jouées se perdraient.
  const consoDejaLa = existants.some((m) => m.stage === 'consolante');
  if (concours.consolante && !consoDejaLa) {
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
            ...firstRoundSources(dejaLa ? existants : main, 'principal').map((id) => ({
              loserFrom: id,
              round: 1,
            })),
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
  /** Tour du cadrage (manuel §3.D.11) : 0 = au premier tour, comme le défaut. */
  tourCadrage = 0,
): Promise<void> {
  const teams = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  if (teams.length < 2) throw new Error('Il faut au moins 2 équipes');
  const complet = drawElimination(concours.id, 'principal', teams, ctx(), {
    sansProtection,
    protections: concours.protections ?? [],
    seeds,
    tourCadrage,
  });
  // Concours qualificatif : on ne crée pas les tours au-delà du nombre de
  // qualifiés voulu (manuel §3.D.7). Le tableau s'arrête là.
  const tours = concours.nbQualifies
    ? nbToursQualification(teams.length, concours.nbQualifies)
    : null;
  const brut = tours !== null && tours > 0 ? tronquerTableau(complet, tours) : complet;
  const main = concours.retirageParTour ? marquerRetirage(brut, 'principal') : brut;
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
    created = buildChampionnat(concours.id, entrants, ctx(), concours.nbRondes);
  } else if (concours.mode === 'melee') {
    if (round > 0 && !rondeComplete(matches, round - 1)) {
      throw new Error('Terminez la ronde en cours avant d\'en tirer une nouvelle');
    }
    created = drawMeleeRonde(concours.id, entrants, round, TEAM_SIZE[concours.format], ctx());
  } else if (concours.mode === 'suisse') {
    if (round > 0 && !rondeComplete(matches, round - 1)) {
      throw new Error('Terminez la ronde en cours avant d\'en tirer une nouvelle');
    }
    created = drawSwissRonde(concours.id, entrants, matches, round, ctx(), {
      strict: concours.ggStrict,
    });
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
/* Phases finales après les rondes (manuel §3.D.15)                    */
/* ------------------------------------------------------------------ */

/**
 * Bascule un concours en rondes vers l'élimination directe. Le classement
 * des rondes détermine entièrement le tableau : aucun tirage au sort.
 */
export async function lancerPhasesFinales(
  concours: Concours,
  configId: string,
): Promise<void> {
  const entrants = (await listByConcours('team', concours.id)).filter((t) => !t.forfait);
  const matches = await listByConcours('match', concours.id);
  if (matches.some((m) => m.stage !== 'ronde')) {
    throw new Error('Les phases finales sont déjà lancées');
  }
  const config = CONFIGS_FINALES.find((c) => c.id === configId);
  if (!config) throw new Error('Configuration de phases finales inconnue');

  const lignes = classementFinales(entrants, matches, concours.ordreClassement ?? []);
  const created = buildFinales(concours.id, lignes, config, entrants, ctx());

  // Terrains par défaut, dans la limite du disponible.
  const numeros = terrainNumeros(concours.nbTerrains, concours.decalageTerrain);
  let i = 0;
  for (const m of created) {
    if (m.round === 0 && !m.byeA && !m.byeB && i < numeros.length) m.terrain = numeros[i++]!;
  }
  await bulkPutEntities('match', created);
  await putEntity('concours', { ...concours, status: 'tableau' });
}

/** Revient aux rondes : les tableaux finaux et leurs scores sont supprimés. */
export async function annulerPhasesFinales(concours: Concours): Promise<void> {
  const finales = (await listByConcours('match', concours.id)).filter(
    (m) => m.stage !== 'ronde',
  );
  await softDeleteMany(finales.map((m) => ({ type: 'match' as const, id: m.id })));
  await putEntity('concours', { ...concours, status: 'rondes' });
}

/**
 * Enregistre l'ordre du classement des rondes voulu par l'organisateur
 * (manuel §3.D.15, « CHANGEMENT DANS LE CLASSEMENT »).
 *
 * C'est l'appelant qui fournit l'ordre, parce que c'est lui qui l'affiche :
 * recalculer le classement ici reviendrait à intervertir deux lignes d'un
 * classement qui n'est pas celui que l'organisateur a sous les yeux.
 *
 * Le moteur ne s'en sert que pour les ex æquo : une correction de score plus
 * tard reclasse quand même tout le monde correctement.
 */
export async function enregistrerOrdreClassement(
  concours: Concours,
  ordre: string[],
): Promise<void> {
  await putEntity('concours', { ...concours, ordreClassement: ordre });
}

/* ------------------------------------------------------------------ */
/* Feuilles de match (championnat des clubs)                           */
/* ------------------------------------------------------------------ */

/** Ancienne mémoire d'appareil, reprise une fois puis effacée. */
const CLE_MEMOIRE_FEUILLE = 'petanque-championnat-clubs';

export async function listFeuillesMatch(): Promise<FeuilleMatch[]> {
  const rows = await db.entities.where('[type+concoursId]').equals(['feuilleMatch', '']).toArray();
  return rows
    .filter((r) => r.deleted === 0 && r.data)
    .map((r) => r.data as FeuilleMatch)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export async function creerFeuilleMatch(): Promise<string> {
  const feuille = feuilleVierge(
    crypto.randomUUID(),
    new Date().toISOString().slice(0, 10),
    'cnc_open',
  );
  await putEntity('feuilleMatch', { ...feuille, updatedAt: monotonicNow() });
  return feuille.id;
}

export async function updateFeuilleMatch(feuille: FeuilleMatch): Promise<void> {
  // L'horodatage est ce qui arbitre entre deux appareils : il se pose ici, au
  // seul point d'écriture, et jamais dans l'écran.
  await putEntity('feuilleMatch', { ...feuille, updatedAt: monotonicNow() });
}

export async function deleteFeuilleMatch(id: string): Promise<void> {
  await softDeleteMany([{ type: 'feuilleMatch', id }]);
}

/**
 * Importe une feuille reçue en fichier. Elle arrive **à côté** des existantes,
 * avec un identifiant neuf : importer ne doit jamais écraser la feuille d'une
 * rencontre déjà jouée.
 */
export async function importerFeuilleMatch(texte: string): Promise<
  { ok: true; id: string } | { ok: false; erreur: string }
> {
  const lecture = lireFeuilleFichier(texte, () => crypto.randomUUID());
  if (!lecture.ok) return { ok: false, erreur: lecture.erreur };
  await putEntity('feuilleMatch', { ...lecture.feuille, updatedAt: monotonicNow() });
  return { ok: true, id: lecture.feuille.id };
}

/**
 * Reprend la feuille que la version précédente gardait dans le navigateur.
 *
 * Appelée une seule fois : la mémoire est effacée dès que la feuille est
 * devenue une entité, sinon un deuxième appareil la reprendrait à son tour et
 * créerait un doublon. Une mémoire illisible ne bloque rien — la reprise rend
 * une feuille vierge plutôt que d'échouer.
 */
export async function reprendreFeuilleLocale(): Promise<string | null> {
  // La clé est lue **et retirée** avant le premier `await`, donc de façon
  // indivisible pour tout autre appelant : sans cela, deux appels concurrents —
  // deux onglets, ou le double appel des effets en développement — liraient tous
  // les deux la même mémoire et créeraient deux feuilles identiques.
  let brut: string | null = null;
  try {
    brut = localStorage.getItem(CLE_MEMOIRE_FEUILLE);
    if (brut !== null) localStorage.removeItem(CLE_MEMOIRE_FEUILLE);
  } catch {
    return null;
  }
  if (!brut) return null;

  let lu: unknown = null;
  try {
    lu = JSON.parse(brut);
  } catch {
    lu = null;
  }
  const feuille = feuilleDepuisMemoire(crypto.randomUUID(), lu);
  try {
    await putEntity('feuilleMatch', { ...feuille, updatedAt: monotonicNow() });
  } catch (err) {
    // Écriture impossible : on remet la mémoire en place plutôt que de perdre
    // la feuille du club.
    try {
      localStorage.setItem(CLE_MEMOIRE_FEUILLE, brut);
    } catch {
      /* stockage indisponible : plus rien à tenter */
    }
    throw err;
  }
  return feuille.id;
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
    // Une poule qui livre un qualifié le fait entrer au tableau sans attendre
    // les autres. Sans objet en formule par groupes : les trois concours se
    // tirent d'un coup, groupes terminés.
    if (!concours.parGroupes) await placerQualifiesAction(concours);
    // Le tableau se remplit aussi : un qualifié entré peut déjà avoir gagné.
    await placerVainqueursAction(concours);
  } else {
    // Toutes les parties, poules comprises : la propagation en a besoin pour
    // résoudre les places réservées à un qualifié de poule. Les écarter les
    // remettrait à vide.
    const all = await listByConcours('match', concours.id);
    const changed = propagate(all);
    await bulkPutEntities('match', changed);
    // Retirage par tour (§3.D.1.A) : le vainqueur qui vient d'être connu prend
    // une place au tour suivant, tirée au sort.
    await placerVainqueursAction(concours);
  }
}

/**
 * Tire les vainqueurs dans les cases du tour suivant (manuel §3.D.1.A), quand le
 * tableau est en retirage. Appelée après chaque saisie : le manuel place la
 * première équipe qui arrive, sans attendre le reste du tour.
 *
 * `force` passe outre le « tirage à la reprise » — c'est le geste explicite de
 * l'organisateur qui tire le tour devant les équipes.
 */
export async function placerVainqueursAction(
  concours: Concours,
  force = false,
): Promise<number> {
  if (!concours.retirageParTour) return 0;
  let matches = await listByConcours('match', concours.id);
  if (!matches.some((m) => m.stage === 'principal' && m.retirage)) return 0;
  if (concours.tirageDiffere && !force) return 0;

  const attente = vainqueursManquants(matches, 'principal');
  if (attente.length === 0) return 0;
  for (const v of attente) matches = placerVainqueur(matches, 'principal', v, ctx());
  const changed = propagate(matches);
  const parId = new Map(changed.map((m) => [m.id, m]));
  const refs = new Set(attente.map((v) => v.matchId));
  const aEcrire = matches
    .filter((m) => m.stage === 'principal')
    .map((m) => parId.get(m.id) ?? m)
    .filter(
      (m) =>
        parId.has(m.id) ||
        (m.vainqueurDeA && refs.has(m.vainqueurDeA)) ||
        (m.vainqueurDeB && refs.has(m.vainqueurDeB)),
    );
  if (aEcrire.length > 0) await bulkPutEntities('match', aEcrire);
  return attente.length;
}

/**
 * Enregistre une photo du podium (manuel §3.D.1.B.5.5).
 *
 * L'accord des personnes est horodaté au moment de l'enregistrement : c'est lui
 * qui autorise la publication, et sans lui rien n'est écrit. L'écran ne propose
 * l'ajout qu'une fois la case cochée ; la règle est répétée ici parce qu'un
 * écran se contourne.
 */
export async function enregistrerPhoto(
  concoursId: string,
  emplacement: EmplacementPhoto,
  image: string,
): Promise<void> {
  const verdict = photoAcceptable(image);
  if (!verdict.ok) throw new Error(verdict.raison);
  await putEntity('photo', {
    id: crypto.randomUUID(),
    concoursId,
    emplacement,
    image,
    consentement: monotonicNow(),
    updatedAt: monotonicNow(),
  });
}

/** Retire une photo : elle disparaît de la page publique à la synchronisation. */
export async function supprimerPhoto(id: string): Promise<void> {
  await softDeleteMany([{ type: 'photo', id }]);
}

export async function setMatchTerrain(match: Match, terrain: number | null): Promise<void> {
  await putEntity('match', { ...match, terrain });
}

/** Affecte automatiquement les parties en attente aux terrains libres. */
/**
 * Fait entrer au tableau les qualifiés désormais connus, puis propage.
 * Appelée après chaque saisie en poule : le concours n'attend pas la poule la
 * plus lente (manuel §3.D.1.A).
 */
export async function placerQualifiesAction(
  concours: Concours,
  /**
   * Tirage explicite : passe outre le « tirage à la reprise ». C'est le geste
   * de l'organisateur, pas l'entrée automatique au fil des poules.
   */
  force = false,
): Promise<number> {
  if (concours.mode !== 'poules') return 0;
  // Tirage différé (§3.D.1.A) : les qualifiés attendent. On propage quand même,
  // pour que les cases déjà placées suivent une correction de poule.
  if (concours.tirageDiffere && !force) {
    const tout = await listByConcours('match', concours.id);
    await bulkPutEntities('match', propagate(tout));
    return 0;
  }
  const poules = await listByConcours('poule', concours.id);
  if (poules.length === 0) return 0;
  let matches = await listByConcours('match', concours.id);
  if (!matches.some((m) => m.stage === 'principal')) return 0;

  const manquants = qualifiesManquants(poules, matches);
  for (const q of manquants) matches = placerQualifie(matches, q, ctx());
  // Consolante alimentée au fil des poules (§3.D.3), quand elle a été créée
  // vide au tirage — sinon elle se tire à la clôture, ancien chemin.
  const sortants = matches.some((m) => m.stage === 'consolante')
    ? eliminesManquants(poules, matches)
    : [];
  for (const e of sortants) matches = placerQualifie(matches, e, ctx(), 'consolante');
  // On propage même sans nouveau qualifié : une correction en poule change qui
  // est 1er ou 2e, et le tableau doit suivre. Sortir tôt laisserait les cases
  // sur l'ancienne équipe.

  // La propagation voit tout, poules comprises : c'est dans les parties de
  // poule qu'elle lit qui est qualifié.
  const changed = propagate(matches);
  const parId = new Map(changed.map((m) => [m.id, m]));
  const refsPlacees = new Set([...manquants, ...sortants].map((q) => q.ref));
  // On écrit les places nouvellement réservées et tout ce que la propagation a
  // touché, sans repasser sur le reste du tableau.
  const aEcrire = matches
    .filter((m) => m.stage !== 'poule')
    .map((m) => parId.get(m.id) ?? m)
    .filter(
      (m) =>
        parId.has(m.id) ||
        (m.qualifFromA && refsPlacees.has(m.qualifFromA)) ||
        (m.qualifFromB && refsPlacees.has(m.qualifFromB)),
    );
  if (aEcrire.length > 0) await bulkPutEntities('match', aEcrire);
  return manquants.length;
}

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
