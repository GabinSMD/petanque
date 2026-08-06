import { describe, expect, it } from 'vitest';
import { ecartPartie } from '../match';
import { rondeStandings } from '../rondes';
import type { Match, Team } from '../../types';

/**
 * « Différence de points de la partie indiquée à coté de l'équipe » — la formule
 * du manuel (§3.D.14, texte p.101 ; l'orthographe sans accent est la sienne).
 *
 * Les cases du graphique portent le dossard suivi de l'écart **signé** de la
 * partie : `15 (7)` a gagné de 7, `16 (-7)` a perdu de 7. Les huit colonnes de la
 * planche p.98 sont opposées deux à deux — `9 (-11)`/`1 (11)`, `13 (13)`/`5
 * (-13)` — ce qui confirme que l'écart est celui de la partie, vu de chaque camp.
 *
 * Les tours à venir portent `(0)` et non un vide : c'est le choix du manuel,
 * attesté sur trois panneaux de la planche p.97-98.
 */
const partie = (over: Partial<Match> = {}): Match =>
  ({
    id: 'm',
    concoursId: 'c',
    stage: 'ronde',
    round: 0,
    position: 0,
    teamAId: 'tA',
    teamBId: 'tB',
    scoreA: null,
    scoreB: null,
    done: false,
    ...over,
  }) as Match;

describe('écart de points d une partie', () => {
  it('est signé, et opposé d un camp à l autre', () => {
    const m = partie({ scoreA: 13, scoreB: 6, done: true });
    expect(ecartPartie(m, 'A')).toBe(7);
    expect(ecartPartie(m, 'B')).toBe(-7);
  });

  it('rend les valeurs de la planche', () => {
    // `13 (13)` / `5 (-13)` : un 13-0. `6 (-12)` / `10 (12)` : un 13-1.
    expect(ecartPartie(partie({ scoreA: 13, scoreB: 0, done: true }), 'A')).toBe(13);
    expect(ecartPartie(partie({ scoreA: 13, scoreB: 0, done: true }), 'B')).toBe(-13);
    expect(ecartPartie(partie({ scoreA: 1, scoreB: 13, done: true }), 'A')).toBe(-12);
    expect(ecartPartie(partie({ scoreA: 12, scoreB: 13, done: true }), 'B')).toBe(1);
  });

  it('vaut zéro sur une partie sans score — comme le manuel', () => {
    // Les tours à venir de la planche affichent `15 (0)`, `13 (0)`… Un zéro, pas
    // un tiret : on prend la notation telle quelle.
    expect(ecartPartie(partie(), 'A')).toBe(0);
    expect(ecartPartie(partie(), 'B')).toBe(0);
  });

  it('vaut zéro sur un vainqueur désigné sans score', () => {
    // `rondeStandings` ne crédite aucun goal-average dans ce cas : « un 13-0
    // fictif fausserait le départage de tout le monde ». L'affichage doit dire
    // la même chose que le classement.
    const m = partie({ vainqueur: 'A', done: true });
    expect(ecartPartie(m, 'A')).toBe(0);
    expect(ecartPartie(m, 'B')).toBe(0);
  });

  it('porte l écart d office d un exempt', () => {
    // L'exempt est crédité 13-7 et **compte** au goal-average du classement.
    // L'escamoter ici ferait que la somme des écarts ne fait plus le `+/-`.
    const bye = partie({ teamBId: null, byeB: true, scoreA: 13, scoreB: 7, done: true });
    expect(ecartPartie(bye, 'A')).toBe(6);
  });

  it('rend zéro sur une partie nulle', () => {
    expect(ecartPartie(partie({ scoreA: 7, scoreB: 7, done: true }), 'A')).toBe(0);
  });

  it('donne l écart courant d une partie en cours', () => {
    // Le `(0)` du manuel vise les parties **sans score**. Une partie commencée
    // est réellement à cet écart-là : l'afficher est plus vrai qu'un zéro.
    const m = partie({ scoreA: 7, scoreB: 3, done: false });
    expect(ecartPartie(m, 'A')).toBe(4);
    expect(ecartPartie(m, 'B')).toBe(-4);
  });
});

describe('l invariant qui fait l intérêt du chiffre', () => {
  const equipe = (n: number): Team =>
    ({ id: `t${n}`, concoursId: 'c', number: n, players: [], forfait: false, updatedAt: '' }) as Team;

  it('la somme des écarts d une équipe fait le +/- de son classement', () => {
    // C'est la raison d'être de l'affichage : comprendre d'où vient le
    // goal-average sans refaire l'addition. Si les deux ne concordaient pas,
    // le chiffre affiché induirait en erreur.
    const teams = [1, 2, 3, 4].map(equipe);
    const matches: Match[] = [
      partie({ id: 'r0a', round: 0, teamAId: 't1', teamBId: 't2', scoreA: 13, scoreB: 6, done: true }),
      partie({ id: 'r0b', round: 0, teamAId: 't3', teamBId: 't4', scoreA: 2, scoreB: 13, done: true }),
      partie({ id: 'r1a', round: 1, teamAId: 't1', teamBId: 't4', scoreA: 11, scoreB: 13, done: true }),
      partie({ id: 'r1b', round: 1, teamAId: 't2', teamBId: 't3', scoreA: 13, scoreB: 12, done: true }),
    ];
    const classement = rondeStandings(teams, matches);
    for (const s of classement) {
      const somme = matches
        .filter((m) => m.teamAId === s.id || m.teamBId === s.id)
        .reduce((n, m) => n + ecartPartie(m, m.teamAId === s.id ? 'A' : 'B'), 0);
      expect(somme).toBe(s.diff);
    }
    // Et le test n'est pas vide de sens : les écarts ne sont pas tous nuls.
    expect(classement.some((s) => s.diff !== 0)).toBe(true);
  });

  it('concorde encore quand un exempt entre dans le compte', () => {
    const teams = [1, 2, 3].map(equipe);
    const matches: Match[] = [
      partie({ id: 'r0a', round: 0, teamAId: 't1', teamBId: 't2', scoreA: 13, scoreB: 9, done: true }),
      partie({ id: 'r0b', round: 0, teamAId: 't3', teamBId: null, byeB: true, scoreA: 13, scoreB: 7, done: true }),
    ];
    const classement = rondeStandings(teams, matches);
    const t3 = classement.find((s) => s.id === 't3')!;
    expect(ecartPartie(matches[1]!, 'A')).toBe(6);
    expect(t3.diff).toBe(6);
  });
});
