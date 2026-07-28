import { describe, expect, it } from 'vitest';
import { clesProtection, enConflit, protectionKey } from '../protections';
import { drawPoules } from '../poules';
import { drawElimination } from '../bracket';
import { makeTeam, testCtx } from './helpers';
import type { Team } from '../../types';

const equipe = (n: number, clubs: string[]): Team => ({
  ...makeTeam(n),
  club: clubs[0],
  players: clubs.map((c, i) => ({ name: `J${n}-${i}`, club: c })),
});

describe('clé de protection', () => {
  it('sans groupe, la clé est le club lui-même', () => {
    expect(protectionKey('Boule Joyeuse', [])).toBe('boule joyeuse');
  });

  it('deux clubs du même groupe partagent la clé', () => {
    const groupes = [['Boule Joyeuse', 'Pétanque du Port']];
    expect(protectionKey('Boule Joyeuse', groupes)).toBe(
      protectionKey('Pétanque du Port', groupes),
    );
  });

  it('un club hors groupe garde sa propre clé', () => {
    const groupes = [['Boule Joyeuse', 'Pétanque du Port']];
    expect(protectionKey('Amicale des Platanes', groupes)).not.toBe(
      protectionKey('Boule Joyeuse', groupes),
    );
  });

  it('insensible à la casse et aux espaces', () => {
    const groupes = [[' boule joyeuse ']];
    expect(protectionKey('BOULE JOYEUSE', groupes)).toBe(protectionKey('Boule Joyeuse', groupes));
  });
});

describe('clés d une équipe', () => {
  it('une équipe non homogène porte les clés de tous ses clubs', () => {
    const t = equipe(1, ['Boule Joyeuse', 'Pétanque du Port']);
    expect([...clesProtection(t, [])].sort()).toEqual(['boule joyeuse', 'pétanque du port']);
  });

  it('retombe sur le club de l équipe si les joueurs n en ont pas', () => {
    const t = { ...makeTeam(1, 'Amicale des Platanes'), players: [{ name: 'X' }] };
    expect([...clesProtection(t, [])]).toEqual(['amicale des platanes']);
  });
});

describe('conflit entre deux équipes', () => {
  it('même club : conflit', () => {
    expect(enConflit(equipe(1, ['A']), equipe(2, ['A']), [])).toBe(true);
  });

  it('clubs différents : pas de conflit', () => {
    expect(enConflit(equipe(1, ['A']), equipe(2, ['B']), [])).toBe(false);
  });

  it('clubs différents mais même groupe protégé : conflit', () => {
    expect(enConflit(equipe(1, ['A']), equipe(2, ['B']), [['A', 'B']])).toBe(true);
  });

  it('une équipe non homogène est en conflit dès qu un seul club est partagé', () => {
    expect(enConflit(equipe(1, ['A', 'C']), equipe(2, ['B', 'C']), [])).toBe(true);
  });

  it('sans club connu, pas de conflit inventé', () => {
    const sansClub = { ...makeTeam(9), players: [{ name: 'X' }], club: undefined };
    expect(enConflit(sansClub, equipe(2, ['A']), [])).toBe(false);
  });
});

describe('protection appliquée au tirage des poules', () => {
  it('sépare les équipes d un même club, quel que soit le tirage', () => {
    // 8 équipes, 2 clubs de 4 : chaque poule de 4 doit mélanger les deux.
    // Testé sur plusieurs graines : un seul tirage pourrait passer par chance.
    const teams = [1, 2, 3, 4].map((n) => equipe(n, ['Club A'])).concat(
      [5, 6, 7, 8].map((n) => equipe(n, ['Club B'])),
    );
    for (const graine of [1, 2, 3, 5, 7, 11, 13, 17, 23, 42]) {
      const draw = drawPoules('c1', teams, testCtx(graine), { protections: [] })!;
      const byId = new Map(teams.map((t) => [t.id, t]));
      for (const poule of draw.poules) {
        const clubs = poule.teamIds.map((id) => byId.get(id)!.players[0]!.club);
        const memeClub = clubs.filter((c) => c === 'Club A').length;
        expect(memeClub, `graine ${graine}, poule ${poule.index} : ${clubs.join(', ')}`)
          .toBeLessThanOrEqual(2);
      }
    }
  });

  it('sans protection, le tirage est intégralement aléatoire', () => {
    // La preuve que le test ci-dessus a du pouvoir : sans protection, au moins
    // une graine regroupe trois équipes du même club.
    const teams = [1, 2, 3, 4].map((n) => equipe(n, ['Club A'])).concat(
      [5, 6, 7, 8].map((n) => equipe(n, ['Club B'])),
    );
    const groupements = [1, 2, 3, 5, 7, 11, 13, 17, 23, 42].map((graine) => {
      const draw = drawPoules('c1', teams, testCtx(graine), { sansProtection: true })!;
      const byId = new Map(teams.map((t) => [t.id, t]));
      return Math.max(
        ...draw.poules.map(
          (p) => p.teamIds.filter((id) => byId.get(id)!.players[0]!.club === 'Club A').length,
        ),
      );
    });
    expect(Math.max(...groupements)).toBeGreaterThan(2);
  });

  it('sépare aussi deux clubs d un même groupe protégé', () => {
    const teams = [1, 2, 3, 4].map((n) => equipe(n, ['Club A'])).concat(
      [5, 6, 7, 8].map((n) => equipe(n, ['Club B'])),
    );
    // A et B protégés ensemble : impossible de les séparer complètement,
    // mais le tirage doit rester valide et ne pas planter.
    const draw = drawPoules('c1', teams, testCtx(7), { protections: [['Club A', 'Club B']] })!;
    expect(draw.poules).toHaveLength(2);
    expect(draw.poules.flatMap((p) => p.teamIds)).toHaveLength(8);
  });
});

describe('protection appliquée au 1er tour du tableau', () => {
  it('évite un duel entre deux équipes du même club', () => {
    const teams = [
      equipe(1, ['Club A']),
      equipe(2, ['Club A']),
      equipe(3, ['Club B']),
      equipe(4, ['Club B']),
    ];
    const matches = drawElimination('c1', 'principal', teams, testCtx(3), {
      protections: [],
      teamsById: new Map(teams.map((t) => [t.id, t])),
    });
    const byId = new Map(teams.map((t) => [t.id, t]));
    for (const m of matches.filter((x) => x.round === 0 && x.teamAId && x.teamBId)) {
      const a = byId.get(m.teamAId!)!;
      const b = byId.get(m.teamBId!)!;
      expect(enConflit(a, b, []), `${a.number} contre ${b.number}`).toBe(false);
    }
  });
});
