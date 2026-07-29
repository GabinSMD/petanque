import { describe, expect, it } from 'vitest';
import { lireSauvegarde, renommerIdentifiants, type Sauvegarde } from '../sauvegarde';
import type { Match, Poule, Team } from '../../types';

const T = '2026-07-28T00:00:00.000Z';

function exemple(): Sauvegarde {
  const teams: Team[] = [1, 2, 3, 4].map((n) => ({
    id: 't' + n,
    concoursId: 'c1',
    number: n,
    players: [{ name: 'J' + n, licence: '0000000' + n }],
    forfait: false,
    updatedAt: T,
  }));
  const poules: Poule[] = [
    { id: 'p1', concoursId: 'c1', index: 1, teamIds: ['t1', 't2', 't3', 't4'], terrain: 1, updatedAt: T },
  ];
  const matches: Match[] = [
    { id: 'm1', concoursId: 'c1', stage: 'poule', pouleId: 'p1', pouleSlot: 'M1', round: 0,
      position: 0, teamAId: 't1', teamBId: 't2', scoreA: 13, scoreB: 7, done: true, terrain: 1, updatedAt: T },
    { id: 'm2', concoursId: 'c1', stage: 'principal', round: 0, position: 0,
      teamAId: 't1', teamBId: 't3', scoreA: null, scoreB: null, done: false, terrain: null, updatedAt: T },
    { id: 'm3', concoursId: 'c1', stage: 'consolante', round: 0, position: 0, teamAId: null, teamBId: null,
      loserFromA: 'm2', scoreA: null, scoreB: null, done: false, terrain: null, updatedAt: T },
    { id: 'm4', concoursId: 'c1', stage: 'ronde', round: 0, position: 0, teamAId: null, teamBId: null,
      playersA: ['t1', 't2'], playersB: ['t3'], scoreA: null, scoreB: null, done: false, terrain: null, updatedAt: T },
  ];
  return {
    concours: {
      id: 'c1', name: 'Concours test', date: '2026-07-28', format: 'doublette', mode: 'poules',
      consolante: true, scoreMax: 13, nbTerrains: 4, status: 'poules', createdAt: T, updatedAt: T,
    },
    teams,
    poules,
    matches,
  };
}

function fichier(over: Record<string, unknown> = {}): string {
  return JSON.stringify({ app: 'petanque-concours', version: 1, exportedAt: T, ...exemple(), ...over });
}

describe('lecture d une sauvegarde', () => {
  it('accepte un fichier produit par l application', () => {
    const r = lireSauvegarde(fichier());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sauvegarde.concours.name).toBe('Concours test');
      expect(r.sauvegarde.teams).toHaveLength(4);
      expect(r.sauvegarde.matches).toHaveLength(4);
    }
  });

  it('refuse ce qui n est pas du JSON', () => {
    const r = lireSauvegarde('ceci n est pas du json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/lisible|JSON/i);
  });

  it('refuse un fichier étranger à l application', () => {
    const r = lireSauvegarde(JSON.stringify({ app: 'autre-chose', version: 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/sauvegarde/i);
  });

  it('refuse un format plus récent que ce qu on sait relire', () => {
    const r = lireSauvegarde(fichier({ version: 99 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/version/i);
  });

  it('refuse un fichier sans concours exploitable', () => {
    expect(lireSauvegarde(fichier({ concours: null })).ok).toBe(false);
    expect(lireSauvegarde(fichier({ concours: { id: 'x' } })).ok).toBe(false);
  });

  it('tolère l absence de poules ou de parties', () => {
    const r = lireSauvegarde(fichier({ poules: undefined, matches: undefined }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sauvegarde.poules).toEqual([]);
      expect(r.sauvegarde.matches).toEqual([]);
    }
  });

  it('écarte les entités rattachées à un autre concours', () => {
    const s = exemple();
    const r = lireSauvegarde(
      JSON.stringify({
        app: 'petanque-concours',
        version: 1,
        ...s,
        teams: [...s.teams, { ...s.teams[0]!, id: 'intrus', concoursId: 'autre' }],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sauvegarde.teams.map((t) => t.id)).not.toContain('intrus');
  });
});

describe('une équipe malformée dans un fichier', () => {
  it('est écartée, les autres sont restaurées', () => {
    // Un fichier d'une version bancale, ou retouché à la main. L'écarter à la
    // lecture vaut mieux que faire échouer toute la restauration — ou, pire,
    // écrire en base une équipe qui blanchit l'écran des inscriptions.
    const base = exemple();
    const teams: unknown[] = [
      ...base.teams,
      { id: 't5', concoursId: 'c1', number: 5, players: { players: [{ name: 'J5' }] }, forfait: false, updatedAt: T },
      { id: 't6', concoursId: 'c1', number: 6, players: [], forfait: false, updatedAt: T },
      { id: 't7', concoursId: 'c1', number: 0, players: [{ name: 'J7' }], forfait: false, updatedAt: T },
    ];
    const res = lireSauvegarde(fichier({ teams }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sauvegarde.teams.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
  });
});

describe('réécriture des identifiants', () => {
  it('renomme tout et ne laisse aucune référence à l ancien', () => {
    const s = exemple();
    let n = 0;
    const renomme = renommerIdentifiants(s, () => `neuf-${++n}`);

    const json = JSON.stringify(renomme);
    for (const ancien of ['c1', 't1', 't2', 't3', 't4', 'p1', 'm1', 'm2', 'm3', 'm4']) {
      expect(json.includes(`"${ancien}"`), `${ancien} subsiste`).toBe(false);
    }
  });

  it('garde la cohérence des références', () => {
    const s = exemple();
    let n = 0;
    const r = renommerIdentifiants(s, () => `neuf-${++n}`);

    const idsEquipes = new Set(r.teams.map((t) => t.id));
    const idsPoules = new Set(r.poules.map((p) => p.id));
    const idsParties = new Set(r.matches.map((m) => m.id));

    // Toutes les équipes et parties pointent sur le nouveau concours.
    expect(r.teams.every((t) => t.concoursId === r.concours.id)).toBe(true);
    expect(r.matches.every((m) => m.concoursId === r.concours.id)).toBe(true);
    // Les poules pointent sur des équipes existantes.
    for (const p of r.poules) {
      for (const id of p.teamIds) expect(idsEquipes.has(id)).toBe(true);
    }
    // Les parties pointent sur des équipes, poules et parties existantes.
    for (const m of r.matches) {
      if (m.pouleId) expect(idsPoules.has(m.pouleId)).toBe(true);
      for (const id of [m.teamAId, m.teamBId]) if (id) expect(idsEquipes.has(id)).toBe(true);
      for (const id of [...(m.playersA ?? []), ...(m.playersB ?? [])]) {
        expect(idsEquipes.has(id)).toBe(true);
      }
      for (const ref of [m.loserFromA, m.loserFromB]) if (ref) expect(idsParties.has(ref)).toBe(true);
    }
  });

  it('conserve tout ce qui n est pas un identifiant', () => {
    const s = exemple();
    const r = renommerIdentifiants(s, (a) => 'x' + a);
    expect(r.concours.name).toBe('Concours test');
    expect(r.teams.map((t) => t.number)).toEqual([1, 2, 3, 4]);
    expect(r.teams[0]!.players[0]!.licence).toBe('00000001');
    expect(r.matches.find((m) => m.done)).toMatchObject({ scoreA: 13, scoreB: 7 });
    expect(r.poules[0]!.terrain).toBe(1);
  });

  it('ne modifie pas la sauvegarde d origine', () => {
    const s = exemple();
    renommerIdentifiants(s, () => 'zzz');
    expect(s.concours.id).toBe('c1');
    expect(s.teams[0]!.id).toBe('t1');
  });
});
