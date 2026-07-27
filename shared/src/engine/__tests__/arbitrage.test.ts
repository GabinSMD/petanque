import { describe, expect, it } from 'vitest';
import { drawElimination } from '../bracket';
import { arbitrageReport } from '../arbitrage';
import { makeTeams, playStageRound, testCtx } from './helpers';
import type { Match, Team } from '../../types';

/** Joue un tableau jusqu'au bout (le côté A gagne 13-7). */
function playAll(all: Match[], stage = 'principal'): Match[] {
  const rounds = Math.max(...all.filter((m) => m.stage === stage).map((m) => m.round));
  let out = all;
  for (let r = 0; r <= rounds; r++) out = playStageRound(out, stage, r);
  return out;
}

function labels(matches: Match[], teams: Team[]): string[] {
  return arbitrageReport(teams, matches).sections.map((s) => s.label);
}

describe('rapport d arbitrage : sections', () => {
  it('8 équipes : vainqueur, finaliste, perdants des demies et des quarts', () => {
    const teams = makeTeams(8);
    const matches = playAll(drawElimination('c1', 'principal', teams, testCtx()));
    const report = arbitrageReport(teams, matches);

    expect(report.sections.map((s) => s.label)).toEqual([
      'Vainqueur',
      'Finaliste',
      'Perdants 1/2 finale',
      'Perdants 1/4 de finale',
    ]);
    expect(report.sections[0]!.teams).toHaveLength(1);
    expect(report.sections[1]!.teams).toHaveLength(1);
    expect(report.sections[2]!.teams).toHaveLength(2);
    expect(report.sections[3]!.teams).toHaveLength(4);
  });

  it('16 équipes : la section la plus profonde est celle des 8èmes', () => {
    const teams = makeTeams(16);
    const matches = playAll(drawElimination('c1', 'principal', teams, testCtx()));
    expect(labels(matches, teams)).toEqual([
      'Vainqueur',
      'Finaliste',
      'Perdants 1/2 finale',
      'Perdants 1/4 de finale',
      'Perdants 8ème de finale',
    ]);
  });

  it('32 équipes : les perdants du 1er tour ne sont pas reportés', () => {
    const teams = makeTeams(32);
    const matches = playAll(drawElimination('c1', 'principal', teams, testCtx()));
    const report = arbitrageReport(teams, matches);
    // La fédération ne collecte que jusqu'aux 8èmes : 1 + 1 + 2 + 4 + 8 = 16 équipes.
    expect(labels(matches, teams)).toEqual([
      'Vainqueur',
      'Finaliste',
      'Perdants 1/2 finale',
      'Perdants 1/4 de finale',
      'Perdants 8ème de finale',
    ]);
    const reported = report.sections.reduce((n, s) => n + s.teams.length, 0);
    expect(reported).toBe(16);
  });

  it('concours inachevé : pas de vainqueur, mais les tours joués sont là', () => {
    const teams = makeTeams(8);
    let matches = drawElimination('c1', 'principal', teams, testCtx());
    matches = playStageRound(matches, 'principal', 0); // quarts seulement
    const ls = labels(matches, teams);
    expect(ls).not.toContain('Vainqueur');
    expect(ls).toContain('Perdants 1/4 de finale');
  });
});

describe('rapport d arbitrage : lignes joueurs', () => {
  const withLicences: Team[] = [
    {
      id: 'a',
      concoursId: 'c1',
      number: 12,
      players: [
        { name: 'Durand Blandine', licence: '02635624' },
        { name: 'Soeur Christelle', licence: '02634059' },
      ],
      club: 'Pétanque de Valensolles',
      forfait: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'b',
      concoursId: 'c1',
      number: 7,
      players: [{ name: 'Gache Kelly', licence: '04232786' }, { name: 'Ouillon Isabelle' }],
      club: 'Petq Envol Andrezieux',
      forfait: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('porte le n° de dossard, le club, la licence et le nom de chaque joueur', () => {
    const matches = playAll(drawElimination('c1', 'principal', withLicences, testCtx()));
    const report = arbitrageReport(withLicences, matches);

    const vainqueur = report.sections[0]!.teams[0]!;
    expect([7, 12]).toContain(vainqueur.number);
    expect(vainqueur.players).toHaveLength(2);
    expect(vainqueur.club).toBeTruthy();

    const all = report.sections.flatMap((s) => s.teams).flatMap((t) => t.players);
    const blandine = all.find((p) => p.name === 'Durand Blandine');
    expect(blandine?.licence).toBe('02635624');
    // Licence facultative : la ligne existe quand même.
    expect(all.find((p) => p.name === 'Ouillon Isabelle')).toBeTruthy();
    expect(all.find((p) => p.name === 'Ouillon Isabelle')?.licence).toBeUndefined();
  });
});

describe('rapport d arbitrage : bilan des engagés', () => {
  it('compte équipes, joueurs, licences manquantes et forfaits', () => {
    const teams = makeTeams(8);
    teams[0]!.players = [{ name: 'Avec licence', licence: '0123' }, { name: 'Sans licence' }];
    teams[1]!.forfait = true;
    const matches = playAll(drawElimination('c1', 'principal', teams, testCtx()));
    const { stats } = arbitrageReport(teams, matches);

    expect(stats.equipes).toBe(8);
    expect(stats.forfaits).toBe(1);
    expect(stats.joueurs).toBe(9); // 7 équipes à 1 joueur + 1 équipe à 2
    expect(stats.joueursSansLicence).toBe(8); // seule « Avec licence » en a une
  });
});
