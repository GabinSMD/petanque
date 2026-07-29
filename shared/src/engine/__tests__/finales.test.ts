import { describe, expect, it } from 'vitest';
import {
  CONFIGS_FINALES,
  buildFinales,
  classementFinales,
  configsPossibles,
} from '../finales';
// La confrontation directe a rejoint le classement des rondes : elle sert
// désormais aussi à l'écran des rondes et à l'affichage public.
import { confrontationDirecte } from '../rondes';
import type { Match, Team } from '../../types';
import { makeTeams, testCtx } from './helpers';

/** Partie de ronde jouée : `a` bat `b` sur ce score. */
function ronde(
  round: number,
  position: number,
  a: string,
  b: string,
  scoreA: number,
  scoreB: number,
): Match {
  return {
    id: `r${round}-${position}`,
    concoursId: 'c1',
    stage: 'ronde',
    round,
    position,
    teamAId: a,
    teamBId: b,
    scoreA,
    scoreB,
    done: true,
    terrain: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const config = (id: string) => CONFIGS_FINALES.find((c) => c.id === id)!;

/**
 * Deux équipes à égalité **parfaite** — mêmes victoires, même goal-average,
 * mêmes points marqués — que seule leur confrontation directe sépare.
 *
 *   t1 : perd 7-13 contre t2, gagne 13-7 contre t3  → 1 v, 0, 20 pts
 *   t2 : gagne 13-7 contre t1, perd 7-13 contre t4  → 1 v, 0, 20 pts
 */
const EGALITE_PARFAITE: Match[] = [
  ronde(0, 0, 't1', 't2', 7, 13),
  ronde(0, 1, 't1', 't3', 13, 7),
  ronde(1, 0, 't2', 't4', 7, 13),
];

/** t1 et t2 à égalité parfaite et **jamais rencontrées** : rien ne les départage. */
const EGALITE_INSOLUBLE: Match[] = [
  ronde(0, 0, 't1', 't3', 13, 7),
  ronde(0, 1, 't2', 't4', 13, 7),
  ronde(1, 0, 't3', 't4', 13, 1),
];

describe('classement des rondes pour les phases finales', () => {
  it('départage deux équipes à égalité par leur confrontation directe', () => {
    const lignes = classementFinales(makeTeams(4), EGALITE_PARFAITE);
    const t1 = lignes.find((l) => l.id === 't1')!;
    const t2 = lignes.find((l) => l.id === 't2')!;
    // Le test n'a de valeur que si l'égalité est bien parfaite.
    expect([t1.wins, t1.diff, t1.pointsFor]).toEqual([t2.wins, t2.diff, t2.pointsFor]);
    // t2 a battu t1 : elle passe devant, et il n'y a plus d'ex æquo.
    expect(t2.rang).toBeLessThan(t1.rang);
    expect(t1.exAequo).toBe(false);
    expect(t2.exAequo).toBe(false);
    expect(lignes.map((l) => l.id).indexOf('t2')).toBeLessThan(
      lignes.map((l) => l.id).indexOf('t1'),
    );
  });

  it('signale l\'égalité que rien ne départage', () => {
    const lignes = classementFinales(makeTeams(4), EGALITE_INSOLUBLE);
    const t1 = lignes.find((l) => l.id === 't1')!;
    const t2 = lignes.find((l) => l.id === 't2')!;
    expect([t1.wins, t1.diff, t1.pointsFor]).toEqual([t2.wins, t2.diff, t2.pointsFor]);
    expect(t1.exAequo).toBe(true);
    expect(t2.exAequo).toBe(true);
    // Égalité non résolue : les deux portent le même rang.
    expect(t1.rang).toBe(t2.rang);
    // Et personne d'autre n'est signalé à tort.
    expect(lignes.filter((l) => l.exAequo).map((l) => l.id).sort()).toEqual(['t1', 't2']);
  });

  it('confrontation directe : sans rencontre, personne ne passe devant', () => {
    expect(confrontationDirecte('t1', 't2', EGALITE_INSOLUBLE)).toBe(0);
    expect(confrontationDirecte('t1', 't3', EGALITE_INSOLUBLE)).toBe(1);
    expect(confrontationDirecte('t3', 't1', EGALITE_INSOLUBLE)).toBe(-1);
  });

  it('affiche les ex æquo dans le même ordre quel que soit l\'ordre des inscrits', () => {
    // Sans cette garantie, une interversion à la main porterait sur une autre
    // ligne que celle que l'organisateur voit.
    const teams = makeTeams(4);
    const attendu = classementFinales(teams, EGALITE_INSOLUBLE).map((l) => l.id);
    const melange = classementFinales([...teams].reverse(), EGALITE_INSOLUBLE).map((l) => l.id);
    expect(melange).toEqual(attendu);
  });

  it('respecte l\'ordre imposé à la main entre ex æquo', () => {
    const teams = makeTeams(4);
    const spontane = classementFinales(teams, EGALITE_INSOLUBLE).map((l) => l.id);
    const i1 = spontane.indexOf('t1');
    const i2 = spontane.indexOf('t2');
    const premier = i1 < i2 ? 't1' : 't2';
    const second = i1 < i2 ? 't2' : 't1';
    const inverse = classementFinales(teams, EGALITE_INSOLUBLE, [second, premier]);
    const ordre = inverse.map((l) => l.id);
    expect(ordre.indexOf(second)).toBeLessThan(ordre.indexOf(premier));
  });

  it('n\'intervertit jamais deux équipes qui ne sont pas à égalité', () => {
    const teams = makeTeams(4);
    // t1 gagne deux fois, t2 une seule : aucune main ne doit les échanger.
    const matches = [
      ronde(0, 0, 't1', 't3', 13, 7),
      ronde(0, 1, 't2', 't4', 13, 7),
      ronde(1, 0, 't1', 't4', 13, 7),
      ronde(1, 1, 't2', 't3', 7, 13),
    ];
    const lignes = classementFinales(teams, matches, ['t2', 't1']);
    expect(lignes[0]!.id).toBe('t1');
  });
});

describe('configurations de phases finales', () => {
  it('les deux configurations du manuel existent', () => {
    expect(config('huitiemes_ab').blocs).toEqual([16, 16]);
    expect(config('quarts_abc').blocs).toEqual([8, 8, 8]);
  });

  it('ne propose que ce que l\'effectif permet', () => {
    const ids = (n: number) => configsPossibles(n).map((c) => c.id);
    expect(ids(2)).toEqual(['finale']);
    expect(ids(6)).toEqual(['finale', 'demies']);
    expect(ids(16)).toContain('huitiemes');
    expect(ids(16)).not.toContain('huitiemes_ab');
    expect(ids(32)).toContain('huitiemes_ab');
    expect(ids(24)).toContain('quarts_abc');
    expect(ids(1)).toEqual([]);
  });
});

describe('génération du tableau final', () => {
  const classement = (n: number): { teams: Team[]; matches: Match[] } => {
    const teams = makeTeams(n);
    // Une seule ronde en cascade : t1 finit premier, tn dernier.
    const matches: Match[] = [];
    for (let i = 0; i < n; i += 1) {
      matches.push(ronde(0, i, `t${i + 1}`, `x${i}`, 13, i));
    }
    return { teams, matches };
  };

  it('16 qualifiés : le 1er affronte le 16e, le 8e le 9e', () => {
    const { teams, matches } = classement(16);
    const lignes = classementFinales(teams, matches);
    const finales = buildFinales('c1', lignes, config('huitiemes'), teams, testCtx());

    const premierTour = finales.filter((m) => m.stage === 'principal' && m.round === 0);
    expect(premierTour).toHaveLength(8);
    const rangDe = new Map(lignes.map((l, i) => [l.id, i + 1]));
    const paires = premierTour
      .map((m) => [rangDe.get(m.teamAId!)!, rangDe.get(m.teamBId!)!].sort((a, b) => a - b))
      .sort((x, y) => x[0]! - y[0]!);
    expect(paires).toEqual([
      [1, 16], [2, 15], [3, 14], [4, 13], [5, 12], [6, 11], [7, 10], [8, 9],
    ]);
  });

  it('les mieux classés se rencontrent le plus tard possible', () => {
    const { teams, matches } = classement(8);
    const lignes = classementFinales(teams, matches);
    const finales = buildFinales('c1', lignes, config('quarts'), teams, testCtx());
    const rangDe = new Map(lignes.map((l, i) => [l.id, i + 1]));
    const quarts = finales
      .filter((m) => m.round === 0)
      .sort((a, b) => a.position - b.position);
    // Le 1er et le 2e doivent être dans deux moitiés différentes.
    const moitieDu = (rang: number): number =>
      quarts.findIndex((m) => [m.teamAId, m.teamBId].some((id) => rangDe.get(id!) === rang)) < 2
        ? 0
        : 1;
    expect(moitieDu(1)).not.toBe(moitieDu(2));
  });

  it('deux tableaux : le concours A prend les 16 premiers, le B les suivants', () => {
    const { teams, matches } = classement(32);
    const lignes = classementFinales(teams, matches);
    const finales = buildFinales('c1', lignes, config('huitiemes_ab'), teams, testCtx());

    const ids = (stage: string): string[] =>
      finales
        .filter((m) => m.stage === stage && m.round === 0)
        .flatMap((m) => [m.teamAId, m.teamBId])
        .filter((x): x is string => Boolean(x));
    const rangDe = new Map(lignes.map((l, i) => [l.id, i + 1]));
    expect(ids('principal').map((i) => rangDe.get(i)!).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
    expect(ids('consolante').map((i) => rangDe.get(i)!).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 17),
    );
  });

  it('trois tableaux de 8, dernier incomplet : il s\'adapte à ses qualifiés', () => {
    const { teams, matches } = classement(20);
    const lignes = classementFinales(teams, matches);
    const finales = buildFinales('c1', lignes, config('quarts_abc'), teams, testCtx());
    const rangDe = new Map(lignes.map((l, i) => [l.id, i + 1]));

    // Quatre qualifiés restants : un tableau de 4 (demies), pas un tableau de
    // 8 à moitié vide — un tour fantôme n'apporte rien.
    const premierTour = finales.filter((m) => m.stage === 'complementaire' && m.round === 0);
    expect(premierTour).toHaveLength(2);
    expect(premierTour.filter((m) => m.byeA || m.byeB)).toHaveLength(0);
    const dedans = premierTour
      .flatMap((m) => [m.teamAId, m.teamBId])
      .map((id) => rangDe.get(id!)!)
      .sort((a, b) => a - b);
    expect(dedans).toEqual([17, 18, 19, 20]);
  });

  it('tableau incomplet : les exempts reviennent aux mieux classés', () => {
    // 22 inscrits en 1/4 A+B+C : le C reçoit 6 qualifiés dans un tableau de 8.
    const { teams, matches } = classement(22);
    const lignes = classementFinales(teams, matches);
    const finales = buildFinales('c1', lignes, config('quarts_abc'), teams, testCtx());
    const rangDe = new Map(lignes.map((l, i) => [l.id, i + 1]));

    const premierTour = finales.filter((m) => m.stage === 'complementaire' && m.round === 0);
    const exempts = premierTour
      .filter((m) => m.byeA || m.byeB)
      .map((m) => rangDe.get(m.teamAId ?? m.teamBId!)!)
      .sort((a, b) => a - b);
    expect(exempts).toEqual([17, 18]);
  });

  it('ne fabrique aucun tableau à partir d\'un seul qualifié', () => {
    const { teams, matches } = classement(1);
    const lignes = classementFinales(teams, matches);
    expect(() => buildFinales('c1', lignes, config('finale'), teams, testCtx())).toThrow();
  });
});
