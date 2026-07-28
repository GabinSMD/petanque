import { describe, expect, it } from 'vitest';
import { chercherEquipeParLicence, depotStats, type EtatDepot } from '../depot';
import type { Team } from '../../types';

function equipe(number: number, licences: (string | undefined)[], depose?: string): Team {
  return {
    id: 't' + number,
    concoursId: 'c1',
    number,
    players: licences.map((l, i) => ({ name: `Joueur ${number}-${i}`, licence: l })),
    forfait: false,
    licencesDeposees: depose,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const T = '2026-07-28T08:00:00.000Z';

describe('statistiques du dépôt des licences', () => {
  const teams = [
    equipe(1, ['1', '2'], T),
    equipe(2, ['3', '4'], T),
    equipe(3, ['5', '6']),
    equipe(4, ['7', '8']),
    equipe(5, ['9', '10'], T),
  ];
  const etats: EtatDepot[] = [
    { teamId: 't1', conforme: true },
    { teamId: 't2', conforme: false },
    { teamId: 't3', conforme: true },
    { teamId: 't4', conforme: false },
    { teamId: 't5', conforme: true },
  ];

  it('compte les équipes déposées, restantes et non conformes', () => {
    const s = depotStats(teams, etats);
    expect(s.total).toBe(5);
    expect(s.deposees).toBe(3);
    expect(s.restantes).toBe(2);
    expect(s.nonConformes).toBe(2);
  });

  it('les équipes non conformes déposées sont comptées à part', () => {
    // L'équipe 2 a déposé mais reste non conforme : c'est le cas à traiter.
    expect(depotStats(teams, etats).deposeesNonConformes).toBe(1);
  });

  it('ignore les équipes déclarées forfait', () => {
    const avecForfait = [...teams, { ...equipe(6, ['11', '12']), forfait: true }];
    expect(depotStats(avecForfait, etats).total).toBe(5);
  });

  it('un concours vide ne divise par rien', () => {
    const s = depotStats([], []);
    expect(s).toMatchObject({ total: 0, deposees: 0, restantes: 0, nonConformes: 0 });
    expect(s.pourcentage).toBe(0);
  });

  it('rend un pourcentage de progression', () => {
    expect(depotStats(teams, etats).pourcentage).toBe(60);
  });
});

describe('recherche d une équipe par licence', () => {
  const teams = [equipe(1, ['02635624', '02634059']), equipe(2, ['04232786', undefined])];

  it('trouve l équipe qui porte la licence scannée', () => {
    expect(chercherEquipeParLicence(teams, '02634059')?.number).toBe(1);
    expect(chercherEquipeParLicence(teams, '04232786')?.number).toBe(2);
  });

  it('rend rien pour une licence absente', () => {
    expect(chercherEquipeParLicence(teams, '09999999')).toBeUndefined();
  });

  it('ignore une licence vide', () => {
    expect(chercherEquipeParLicence(teams, '')).toBeUndefined();
  });
});
