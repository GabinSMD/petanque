import { describe, expect, it } from 'vitest';
import {
  BYE_SCORE,
  buildChampionnat,
  championnatRondes,
  drawMeleeRonde,
  drawSwissRonde,
  rondeComplete,
  rondeStandings,
  rondesTirees,
} from '../rondes';
import type { Match, RolePetanque, Team } from '../../types';
import { makeTeam, makeTeams, testCtx } from './helpers';

function play(matches: Match[], id: string, scoreA: number, scoreB: number): Match[] {
  return matches.map((m) => (m.id === id ? { ...m, scoreA, scoreB, done: true } : m));
}

/** Participants avec un rôle de jeu déclaré, dans l'ordre donné. */
function makeRoles(roles: (RolePetanque | undefined)[]): Team[] {
  return roles.map((role, i) => {
    const t = makeTeam(i + 1);
    return { ...t, players: [{ ...t.players[0]!, role }] };
  });
}

/** Rôle d'un camp, joueur par joueur. */
function rolesDuCamp(players: Team[], ids: string[]): (RolePetanque | undefined)[] {
  return ids.map((id) => players.find((p) => p.id === id)!.players[0]!.role);
}

describe('mêlée : rôles de jeu', () => {
  /** Douze graines : une règle de tirage doit tenir quel que soit le hasard. */
  const GRAINES = [1, 2, 3, 5, 8, 13, 21, 34, 42, 55, 89, 144];

  it('deux pointeurs et deux tireurs : chaque doublette a un de chaque', () => {
    const players = makeRoles(['pointeur', 'pointeur', 'tireur', 'tireur']);
    for (const graine of GRAINES) {
      const matches = drawMeleeRonde('c1', players, 0, 2, testCtx(graine));
      expect(matches).toHaveLength(1);
      for (const ids of [matches[0]!.playersA!, matches[0]!.playersB!]) {
        expect(rolesDuCamp(players, ids).sort()).toEqual(['pointeur', 'tireur']);
      }
    }
  });

  it('triplettes : chaque camp reçoit un pointeur, un milieu et un tireur', () => {
    const players = makeRoles([
      'pointeur', 'pointeur', 'milieu', 'milieu', 'tireur', 'tireur',
    ]);
    for (const graine of GRAINES) {
      const matches = drawMeleeRonde('c1', players, 0, 3, testCtx(graine));
      expect(matches).toHaveLength(1);
      for (const ids of [matches[0]!.playersA!, matches[0]!.playersB!]) {
        expect(rolesDuCamp(players, ids).sort()).toEqual(['milieu', 'pointeur', 'tireur']);
      }
    }
  });

  it('quatre doublettes : les huit rôles se répartissent un par camp', () => {
    const players = makeRoles([
      'pointeur', 'pointeur', 'pointeur', 'pointeur',
      'tireur', 'tireur', 'tireur', 'tireur',
    ]);
    for (const graine of GRAINES) {
      const camps = drawMeleeRonde('c1', players, 0, 2, testCtx(graine)).flatMap((m) => [
        m.playersA!,
        m.playersB!,
      ]);
      expect(camps).toHaveLength(4);
      for (const ids of camps) {
        expect(rolesDuCamp(players, ids).sort()).toEqual(['pointeur', 'tireur']);
      }
    }
  });

  it('rôles déséquilibrés : on place quand même tout le monde', () => {
    // Trois pointeurs pour un seul tireur : une doublette sera à deux pointeurs.
    const players = makeRoles(['pointeur', 'pointeur', 'pointeur', 'tireur']);
    for (const graine of GRAINES) {
      const matches = drawMeleeRonde('c1', players, 0, 2, testCtx(graine));
      const tous = matches.flatMap((m) => [...m.playersA!, ...m.playersB!]);
      expect(new Set(tous).size).toBe(4);
    }
  });

  it('rôles partiellement renseignés : jamais deux pointeurs dans le même camp', () => {
    const players = makeRoles(['pointeur', 'tireur', 'pointeur', undefined]);
    for (const graine of GRAINES) {
      const camps = drawMeleeRonde('c1', players, 0, 2, testCtx(graine)).flatMap((m) => [
        m.playersA!,
        m.playersB!,
      ]);
      for (const ids of camps) {
        const roles = rolesDuCamp(players, ids);
        expect(roles.filter((r) => r === 'pointeur')).toHaveLength(1);
      }
      expect(new Set(camps.flat()).size).toBe(4);
    }
  });

  it('reste aléatoire : les camps changent d\'une graine à l\'autre', () => {
    const players = makeRoles([
      'pointeur', 'pointeur', 'pointeur', 'pointeur',
      'tireur', 'tireur', 'tireur', 'tireur',
    ]);
    const empreinte = (graine: number): string =>
      drawMeleeRonde('c1', players, 0, 2, testCtx(graine))
        .map((m) => [...m.playersA!].sort().join('+'))
        .sort()
        .join(' | ');
    expect(new Set(GRAINES.map(empreinte)).size).toBeGreaterThan(1);
  });

  it('sans aucun rôle déclaré : le tirage reste purement aléatoire', () => {
    const players = makeTeams(8);
    const empreinte = (graine: number): string =>
      drawMeleeRonde('c1', players, 0, 2, testCtx(graine))
        .map((m) => [...m.playersA!].sort().join('+'))
        .sort()
        .join(' | ');
    expect(new Set(GRAINES.map(empreinte)).size).toBeGreaterThan(1);
  });
});

describe('mêlée tournante', () => {
  it('8 joueurs en doublettes : 2 parties de 2 contre 2', () => {
    const matches = drawMeleeRonde('c1', makeTeams(8), 0, 2, testCtx());
    expect(matches).toHaveLength(2);
    for (const m of matches) {
      expect(m.playersA).toHaveLength(2);
      expect(m.playersB).toHaveLength(2);
    }
    const all = matches.flatMap((m) => [...m.playersA!, ...m.playersB!]);
    expect(new Set(all).size).toBe(8);
  });

  it('9 joueurs en doublettes : une triplette contre doublette, personne d\'exempt', () => {
    const matches = drawMeleeRonde('c1', makeTeams(9), 0, 2, testCtx());
    expect(matches).toHaveLength(2);
    const sizes = matches
      .flatMap((m) => [m.playersA!.length, m.playersB!.length])
      .sort()
      .join(',');
    expect(sizes).toBe('2,2,2,3');
    const all = matches.flatMap((m) => [...m.playersA!, ...m.playersB!]);
    expect(new Set(all).size).toBe(9);
  });

  it('7 joueurs en triplettes : une seule partie 4 contre 3', () => {
    const matches = drawMeleeRonde('c1', makeTeams(7), 0, 3, testCtx());
    expect(matches).toHaveLength(1);
    expect(matches[0]!.playersA!.length + matches[0]!.playersB!.length).toBe(7);
  });

  it('crédite chaque joueur individuellement au classement', () => {
    const players = makeTeams(8);
    let matches = drawMeleeRonde('c1', players, 0, 2, testCtx());
    matches = play(matches, matches[0]!.id, 13, 5);
    matches = play(matches, matches[1]!.id, 13, 9);

    const standings = rondeStandings(players, matches);
    expect(standings.filter((s) => s.wins === 1)).toHaveLength(4);
    expect(standings.filter((s) => s.wins === 0)).toHaveLength(4);
    // Les vainqueurs 13-5 devancent les vainqueurs 13-9 au goal-average.
    expect(standings[0]!.diff).toBe(8);
    const winners = new Set([...matches[0]!.playersA!]);
    expect(winners.has(standings[0]!.id)).toBe(true);
  });
});

describe('système suisse', () => {
  it('effectif impair : un exempt gagnant 13-7, jamais deux fois le même', () => {
    const teams = makeTeams(5);
    const ctx = testCtx(9);
    let all: Match[] = [];

    const byed: string[] = [];
    for (let r = 0; r < 3; r++) {
      const ronde = drawSwissRonde('c1', teams, all, r, ctx);
      expect(ronde).toHaveLength(3); // 2 parties + 1 exempt
      const bye = ronde.find((m) => m.byeB)!;
      expect(bye.done).toBe(true);
      expect(bye.scoreA).toBe(BYE_SCORE[0]);
      expect(bye.scoreB).toBe(BYE_SCORE[1]);
      byed.push(bye.teamAId!);
      all = [
        ...all,
        ...ronde.map((m) => (m.byeB ? m : { ...m, scoreA: 13, scoreB: 7, done: true })),
      ];
    }
    expect(new Set(byed).size).toBe(3);
  });

  it('apparie par classement en évitant les revanches', () => {
    const teams = makeTeams(4);
    const ctx = testCtx(3);
    const r1 = drawSwissRonde('c1', teams, [], 0, ctx);
    expect(r1).toHaveLength(2);
    // t1 et t3 gagnent largement, t2 gagne petit… impossible avec 2 matches :
    // scores distincts pour créer un classement net.
    const done1 = [
      { ...r1[0]!, scoreA: 13, scoreB: 2, done: true },
      { ...r1[1]!, scoreA: 13, scoreB: 10, done: true },
    ];
    const r2 = drawSwissRonde('c1', teams, done1, 1, ctx);
    expect(r2).toHaveLength(2);
    // Les deux vainqueurs se rencontrent, les deux perdants aussi.
    const winners = new Set([done1[0]!.teamAId, done1[1]!.teamAId]);
    const matchOfWinners = r2.find((m) => winners.has(m.teamAId));
    expect(winners.has(matchOfWinners!.teamBId)).toBe(true);
    // Pas de revanche de la ronde 1.
    for (const m of r2) {
      const prev = done1.find(
        (p) =>
          (p.teamAId === m.teamAId && p.teamBId === m.teamBId) ||
          (p.teamAId === m.teamBId && p.teamBId === m.teamAId),
      );
      expect(prev).toBeUndefined();
    }
  });
});

describe('championnat toutes rondes', () => {
  it('4 équipes : 3 rondes, chacun rencontre chacun une fois', () => {
    const teams = makeTeams(4);
    const matches = buildChampionnat('c1', teams, testCtx());
    expect(championnatRondes(4)).toBe(3);
    expect(matches).toHaveLength(6);
    expect(rondesTirees(matches)).toBe(3);

    const pairs = new Set(
      matches.map((m) => [m.teamAId, m.teamBId].sort().join('|')),
    );
    expect(pairs.size).toBe(6);
    // Chaque équipe joue exactement une fois par ronde.
    for (let r = 0; r < 3; r++) {
      const ids = matches
        .filter((m) => m.round === r)
        .flatMap((m) => [m.teamAId, m.teamBId]);
      expect(new Set(ids).size).toBe(4);
    }
  });

  it('5 équipes : 5 rondes, chacun se repose une fois, 10 parties', () => {
    const teams = makeTeams(5);
    const matches = buildChampionnat('c1', teams, testCtx());
    expect(championnatRondes(5)).toBe(5);
    expect(matches).toHaveLength(10);
    expect(rondesTirees(matches)).toBe(5);
    for (const t of teams) {
      const count = matches.filter((m) => m.teamAId === t.id || m.teamBId === t.id).length;
      expect(count).toBe(4);
    }
  });

  it('classe par victoires puis goal-average', () => {
    const teams = makeTeams(4);
    let matches = buildChampionnat('c1', teams, testCtx());
    for (const m of matches) {
      // t plus petit numéro gagne toujours 13-7 → classement net t1 > t2 > t3 > t4.
      const aNum = Number(m.teamAId!.slice(1));
      const bNum = Number(m.teamBId!.slice(1));
      matches = play(matches, m.id, aNum < bNum ? 13 : 7, aNum < bNum ? 7 : 13);
    }
    expect(rondeComplete(matches, 0)).toBe(true);
    const standings = rondeStandings(teams, matches);
    expect(standings.map((s) => s.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(standings[0]!.wins).toBe(3);
    expect(standings[0]!.played).toBe(3);
  });
});
