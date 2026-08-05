import { describe, expect, it } from 'vitest';
import { inverserResultat } from '../match';
import type { Match } from '../../types';

/**
 * « Inverser Résultat » — le troisième outil de rectification, nommé sur la
 * planche p.97 à côté de `Modifier Score` et `Gommer`, et confirmé par le texte
 * p.101 : « Pour Changer le Score / Inverser le Résultat / Voir la Composition
 * de l'équipe : Clic Droit sur l'équipe ou match ».
 *
 * L'erreur la plus courante à la table de marque est d'avoir cliqué le mauvais
 * camp. La corriger demandait de ressaisir le score à l'envers, alors que c'est
 * un échange de deux nombres déjà saisis.
 *
 * Le manuel dit « inverser le **résultat** », pas les équipes : on échange les
 * scores, jamais `teamAId`/`teamBId`. Échanger les équipes casserait les
 * références de propagation du tableau (`vainqueurDeA`).
 */
const partie = (over: Partial<Match> = {}): Match =>
  ({
    id: 'm1',
    concoursId: 'c',
    stage: 'principal',
    round: 0,
    position: 0,
    teamAId: 'tA',
    teamBId: 'tB',
    scoreA: null,
    scoreB: null,
    done: false,
    ...over,
  }) as Match;

describe('inverser le résultat', () => {
  it('échange les deux scores', () => {
    const m = inverserResultat(partie({ scoreA: 13, scoreB: 6, done: true }));
    expect(m.scoreA).toBe(6);
    expect(m.scoreB).toBe(13);
  });

  it('laisse les équipes à leur place', () => {
    // C'est le résultat qu'on inverse, pas l'appariement : `vainqueurDeA` et
    // `vainqueurDeB` désignent des **places**, et les échanger enverrait les
    // équipes dans les mauvaises cases du tour suivant.
    const m = inverserResultat(partie({ scoreA: 13, scoreB: 6, done: true }));
    expect(m.teamAId).toBe('tA');
    expect(m.teamBId).toBe('tB');
  });

  it('reflète les mènes plutôt que de les jeter', () => {
    // Échanger les camps de chaque mène produit exactement le score miroir :
    // l'historique reste vrai. `setScore` écarte un historique qui ne fait plus
    // le score ; ici il n'y a rien à écarter.
    const m = inverserResultat(
      partie({
        scoreA: 13,
        scoreB: 2,
        done: true,
        menes: [
          { camp: 'a', points: 6 },
          { camp: 'b', points: 2 },
          { camp: 'a', points: 6 },
          { camp: 'a', points: 1 },
        ],
      }),
    );
    expect(m.menes).toEqual([
      { camp: 'b', points: 6 },
      { camp: 'a', points: 2 },
      { camp: 'b', points: 6 },
      { camp: 'b', points: 1 },
    ]);
    // Et le total des mènes fait bien le nouveau score.
    const total = (camp: 'a' | 'b') =>
      (m.menes ?? []).filter((x) => x.camp === camp).reduce((n, x) => n + x.points, 0);
    expect(total('a')).toBe(m.scoreA);
    expect(total('b')).toBe(m.scoreB);
  });

  it('échange un vainqueur désigné sans score', () => {
    // Concours au vainqueur seul : il n'y a pas de score à échanger, mais c'est
    // exactement là que se trompe le doigt.
    expect(inverserResultat(partie({ vainqueur: 'A', done: true })).vainqueur).toBe('B');
    expect(inverserResultat(partie({ vainqueur: 'B', done: true })).vainqueur).toBe('A');
  });

  it('ne touche pas à une partie exempte', () => {
    // Un exempt n'a pas d'adversaire : inverser affirmerait que personne a
    // gagné. Le score d'office reste tel quel.
    const bye = partie({ teamBId: null, byeB: true, scoreA: 13, scoreB: 7, done: true });
    expect(inverserResultat(bye)).toBe(bye);
  });

  it('ne touche pas à une partie sans résultat', () => {
    const vierge = partie();
    expect(inverserResultat(vierge)).toBe(vierge);
  });

  it('deux inversions rendent la partie d origine', () => {
    const depart = partie({
      scoreA: 13,
      scoreB: 6,
      done: true,
      menes: [
        { camp: 'a', points: 6 },
        { camp: 'a', points: 6 },
        { camp: 'a', points: 1 },
        { camp: 'b', points: 6 },
      ],
    });
    expect(inverserResultat(inverserResultat(depart))).toEqual(depart);
  });

  it('garde la partie terminée, et son terrain', () => {
    const m = inverserResultat(partie({ scoreA: 13, scoreB: 6, done: true, terrain: 7 }));
    expect(m.done).toBe(true);
    expect(m.terrain).toBe(7);
  });

  it('inverse aussi une partie en cours', () => {
    // Le mauvais camp crédité en cours de partie se corrige du même geste ;
    // l'échange est symétrique, donc sans danger.
    const m = inverserResultat(partie({ scoreA: 7, scoreB: 3, done: false }));
    expect([m.scoreA, m.scoreB]).toEqual([3, 7]);
    expect(m.done).toBe(false);
  });

  it('un score nul des deux côtés se laisse inverser sans rien changer', () => {
    const m = inverserResultat(partie({ scoreA: 0, scoreB: 0, done: true }));
    expect([m.scoreA, m.scoreB]).toEqual([0, 0]);
  });
});
