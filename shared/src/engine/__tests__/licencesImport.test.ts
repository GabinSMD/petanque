import { describe, expect, it } from 'vitest';
import { parseLicenciesCsv } from '../licencesImport';

describe('import du fichier des licenciés', () => {
  it('lit un fichier complet, en-têtes accentués et dates françaises', () => {
    const csv = [
      'Nom;Prénom;N° Licence;Club;N° Club;Comité;Date de naissance;Sexe;Classification;Année de reprise;Certificat médical;Nationalité;Position',
      'DURAND;Blandine;02635624;Pétanque de Valensolles;0266013;026;04/05/1980;F;Promotion;2026;;FRA;',
      'MARTIN;Léo;02635999;Boule du Port;0266020;026;12/03/2013;M;Élite;2026;31/12/2026;FRA;Muté',
    ].join('\n');

    const { rows, skipped } = parseLicenciesCsv(csv);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({
      name: 'Blandine DURAND',
      licence: '02635624',
      club: 'Pétanque de Valensolles',
      clubNumero: '0266013',
      comite: '026',
      dateNaissance: '1980-05-04',
      sexe: 'F',
      classification: 'P',
      anneeReprise: 2026,
      nationalite: 'FRA',
    });
    expect(rows[0]!.certificatMedical).toBeUndefined();
    expect(rows[0]!.mutation).toBeUndefined();

    expect(rows[1]).toMatchObject({
      classification: 'E',
      sexe: 'M',
      dateNaissance: '2013-03-12',
      certificatMedical: '2026-12-31',
      mutation: true,
    });
  });

  it('accepte les dates ISO telles quelles', () => {
    const csv = 'Nom;Prénom;Licence;Naissance\nDURAND;Blandine;123;1980-05-04';
    expect(parseLicenciesCsv(csv).rows[0]!.dateNaissance).toBe('1980-05-04');
  });

  it('tolère les variantes de sexe et de classification', () => {
    const csv = [
      'Nom;Prénom;Licence;Sexe;Classement',
      'A;A;1;Homme;Honneur',
      'B;B;2;femme;promotion',
      'C;C;3;H;E',
      'D;D;4;F;h',
    ].join('\n');
    const rows = parseLicenciesCsv(csv).rows;
    expect(rows.map((r) => r.sexe)).toEqual(['M', 'F', 'M', 'F']);
    expect(rows.map((r) => r.classification)).toEqual(['H', 'P', 'E', 'H']);
  });

  it('reste compatible avec l ancien fichier à quatre colonnes', () => {
    const csv = 'Nom;Prénom;Licence;Club\nDupont;Marie;012345678;La Boule Joyeuse';
    const rows = parseLicenciesCsv(csv).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Marie Dupont',
      licence: '012345678',
      club: 'La Boule Joyeuse',
    });
    expect(rows[0]!.sexe).toBeUndefined();
  });

  it('sans en-tête, garde l ordre supposé Nom Prénom Licence Club', () => {
    const rows = parseLicenciesCsv('Dupont;Marie;012345678;La Boule Joyeuse').rows;
    expect(rows[0]).toMatchObject({ name: 'Marie Dupont', licence: '012345678' });
  });

  it('accepte la virgule et la tabulation comme séparateurs', () => {
    expect(parseLicenciesCsv('Nom,Prénom,Licence\nA,B,9').rows[0]!.licence).toBe('9');
    expect(parseLicenciesCsv('Nom\tPrénom\tLicence\nA\tB\t9').rows[0]!.licence).toBe('9');
  });

  it('ignore les lignes sans nom exploitable', () => {
    const csv = 'Nom;Prénom;Licence\nDURAND;Blandine;1\n;;\n;;42';
    const { rows, skipped } = parseLicenciesCsv(csv);
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it('ne confond pas « année de naissance » avec l année de reprise', () => {
    const csv = 'Nom;Prénom;Licence;Année de naissance\nA;B;1;1980';
    const row = parseLicenciesCsv(csv).rows[0]!;
    expect(row.anneeReprise).toBeUndefined();
  });

  it('distingue le club de son numéro, quel que soit l ordre des colonnes', () => {
    const csv = 'Nom;Prénom;Licence;N° Club;Club\nA;B;1;0266013;Pétanque du Port';
    const row = parseLicenciesCsv(csv).rows[0]!;
    expect(row.clubNumero).toBe('0266013');
    expect(row.club).toBe('Pétanque du Port');
  });

  it('ignore une année de reprise ou une date illisible plutôt que d inventer', () => {
    const csv = 'Nom;Prénom;Licence;Année de reprise;Date de naissance\nA;B;1;n/a;32/13/2020';
    const row = parseLicenciesCsv(csv).rows[0]!;
    expect(row.anneeReprise).toBeUndefined();
    expect(row.dateNaissance).toBeUndefined();
  });
});
