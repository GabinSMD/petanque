import { describe, expect, it } from 'vitest';
import { formeCadrage, toursCadragePossibles } from '../cadrage';
import { drawElimination } from '../bracket';
import { buildFormuleBrackets } from '../formules';
import { isByeMatch, winnerOf } from '../match';
import { makeTeams, playStageRound, testCtx } from './helpers';

describe('forme d\'un tableau selon le tour de cadrage (§3.D.2, §3.D.11)', () => {
  it('cadrage au premier tour : c\'est la forme d\'aujourd\'hui', () => {
    // 48 équipes, tableau de 64 : 16 exempts d'entrée, 16 parties réelles.
    expect(formeCadrage(48, 0)).toEqual([
      { reelles: 16, exempts: 16 },
      { reelles: 16, exempts: 0 },
      { reelles: 8, exempts: 0 },
      { reelles: 4, exempts: 0 },
      { reelles: 2, exempts: 0 },
      { reelles: 1, exempts: 0 },
    ]);
  });

  it('cadrage différé d\'un tour : tout le monde joue une partie', () => {
    // 48 équipes : 24 parties au premier tour, puis 24 → 16 au second.
    expect(formeCadrage(48, 1)).toEqual([
      { reelles: 24, exempts: 0 },
      { reelles: 8, exempts: 8 },
      { reelles: 8, exempts: 0 },
      { reelles: 4, exempts: 0 },
      { reelles: 2, exempts: 0 },
      { reelles: 1, exempts: 0 },
    ]);
  });

  it('un effectif en puissance de deux n\'a pas de cadrage à placer', () => {
    expect(formeCadrage(32, 0)).toEqual([
      { reelles: 16, exempts: 0 },
      { reelles: 8, exempts: 0 },
      { reelles: 4, exempts: 0 },
      { reelles: 2, exempts: 0 },
      { reelles: 1, exempts: 0 },
    ]);
    expect(toursCadragePossibles(32)).toEqual([]);
  });

  it('énumère les tours où le cadrage peut tomber', () => {
    // 48 = 16 × 3 : on peut jouer 0, 1, 2, 3 ou 4 tours pleins avant de cadrer.
    // Au-delà, l'effectif ne se divise plus en deux.
    expect(toursCadragePossibles(48)).toEqual([0, 1, 2, 3, 4]);
    // 24 = 8 × 3 : trois tours pleins possibles.
    expect(toursCadragePossibles(24)).toEqual([0, 1, 2, 3]);
    // 12 : deux.
    expect(toursCadragePossibles(12)).toEqual([0, 1, 2]);
    // Un effectif impair ne permet aucun tour plein avant cadrage.
    expect(toursCadragePossibles(13)).toEqual([0]);
  });

  it('refuse un tour de cadrage impossible', () => {
    // 48 équipes : au 5e tour il ne resterait que 3 équipes, un tour plein
    // n'existe pas.
    expect(() => formeCadrage(48, 5)).toThrow(/cadrage/i);
    expect(() => formeCadrage(13, 1)).toThrow(/cadrage/i);
    expect(() => formeCadrage(1, 0)).toThrow(/équipe/i);
  });

  it('conserve le nombre de parties réelles, quel que soit le cadrage', () => {
    // Un tableau à élimination directe de n équipes compte toujours n-1
    // parties réelles : une équipe sort à chaque partie.
    for (const tour of toursCadragePossibles(48)) {
      const total = formeCadrage(48, tour).reduce((n, r) => n + r.reelles, 0);
      expect(total).toBe(47);
    }
  });

  it('chaque équipe joue au moins une partie dès qu\'on diffère', () => {
    // C'est la raison d'être du cadrage différé : personne ne passe un tour
    // gratuitement.
    expect(formeCadrage(48, 1)[0]!.exempts).toBe(0);
    expect(formeCadrage(48, 0)[0]!.exempts).toBeGreaterThan(0);
  });
});

describe('tirage d\'un tableau à cadrage différé', () => {
  it('fait jouer tout le monde au premier tour', () => {
    const teams = makeTeams(48);
    const matches = drawElimination('c1', 'principal', teams, testCtx(), { tourCadrage: 1 });
    const premierTour = matches.filter((m) => m.round === 0);
    expect(premierTour.filter((m) => isByeMatch(m))).toHaveLength(0);
    expect(premierTour.filter((m) => !isByeMatch(m))).toHaveLength(24);
    // Chaque équipe est engagée une fois, et une seule.
    const engagees = premierTour.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean);
    expect(new Set(engagees).size).toBe(48);
  });

  it('place le cadrage au tour demandé', () => {
    const matches = drawElimination('c1', 'principal', makeTeams(48), testCtx(), {
      tourCadrage: 1,
    });
    const tour = (r: number) => matches.filter((m) => m.round === r);
    expect(tour(1).filter((m) => isByeMatch(m))).toHaveLength(8);
    expect(tour(1).filter((m) => !isByeMatch(m))).toHaveLength(8);
    // Après le cadrage, plus aucun exempt : le tableau est plein.
    for (const r of [2, 3, 4, 5]) {
      expect(tour(r).filter((m) => isByeMatch(m))).toHaveLength(0);
    }
  });

  it('se joue jusqu\'à une finale unique', () => {
    // La preuve que le squelette tient : aucune partie ne reste bloquée avec un
    // seul camp connu, et il sort un vainqueur.
    const teams = makeTeams(48);
    let matches = drawElimination('c1', 'principal', teams, testCtx(), { tourCadrage: 1 });
    for (const r of [0, 1, 2, 3, 4, 5]) matches = playStageRound(matches, 'principal', r);
    const finale = matches.filter((m) => m.round === 5);
    expect(finale).toHaveLength(1);
    expect(winnerOf(finale[0]!)).toBeTruthy();
    expect(matches.every((m) => m.done)).toBe(true);
  });

  it('sans l\'option, le tableau d\'aujourd\'hui est inchangé', () => {
    const teams = makeTeams(48);
    const avant = drawElimination('c1', 'principal', teams, testCtx());
    const apres = drawElimination('c1', 'principal', teams, testCtx(), { tourCadrage: 0 });
    expect(apres.map((m) => `${m.round}:${m.position}:${m.teamAId}:${m.teamBId}`)).toEqual(
      avant.map((m) => `${m.round}:${m.position}:${m.teamAId}:${m.teamBId}`),
    );
    expect(avant.filter((m) => m.round === 0 && isByeMatch(m))).toHaveLength(16);
  });

  it('refuse un cadrage que l\'effectif ne permet pas', () => {
    expect(() =>
      drawElimination('c1', 'principal', makeTeams(13), testCtx(), { tourCadrage: 1 }),
    ).toThrow(/cadrage/i);
  });

  it('le concours B reçoit les perdants du premier tour, plus nombreux', () => {
    // C'est l'effet attendu du cadrage différé sur la formule A-B : 24 équipes
    // perdent leur première partie au lieu de 16.
    const teams = makeTeams(48);
    const direct = drawElimination('c1', 'principal', teams, testCtx());
    const differe = drawElimination('c1', 'principal', teams, testCtx(), { tourCadrage: 1 });
    const bDirect = buildFormuleBrackets('c1', direct, 'ab', testCtx());
    const bDiffere = buildFormuleBrackets('c1', differe, 'ab', testCtx());
    const entrants = (ms: typeof direct) =>
      ms
        .filter((m) => m.round === 0)
        .flatMap((m) => [m.loserFromA, m.loserFromB])
        .filter(Boolean).length;
    expect(entrants(bDirect)).toBe(16);
    expect(entrants(bDiffere)).toBe(24);
  });
});
