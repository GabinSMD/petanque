import { describe, expect, it } from 'vitest';
import { parseLicenciesCsv, parsePosition } from '../licencesImport';

describe('colonne « Position » du fichier fédéral (#134)', () => {
  it('MUT.OK : pas de mutation', () => {
    // L'ancienne lecture prenait tout ce qui commence par « mut » pour une
    // mutation : chaque MUT.OK comptait au contingent.
    expect(parsePosition('MUT.OK')).toEqual({ etat: 'aucune', mute: false });
  });

  it('MUT.INT et MUT.EXT', () => {
    expect(parsePosition('MUT.INT')).toEqual({ etat: 'interne', mute: true });
    expect(parsePosition('MUT.EXT')).toEqual({ etat: 'externe', mute: true });
    expect(parsePosition('Mutation externe')).toEqual({ etat: 'externe', mute: true });
  });

  it('un fichier fait à la main qui dit seulement « muté »', () => {
    expect(parsePosition('Muté')).toEqual({ mute: true });
    expect(parsePosition('oui')).toEqual({ mute: true });
    expect(parsePosition('non')).toEqual({ etat: 'aucune', mute: false });
  });

  it('une valeur illisible ou absente ne dit rien', () => {
    expect(parsePosition(undefined)).toEqual({});
    expect(parsePosition('   ')).toEqual({});
    expect(parsePosition('???')).toEqual({});
  });

  it('l\'import remplit les deux champs', () => {
    const csv = 'Nom;Prénom;Licence;Position\nEVRARD;René;03807307;MUT.OK\nFIGUS;Daniel;03814838;MUT.INT';
    const { rows } = parseLicenciesCsv(csv);
    expect(rows[0]).toMatchObject({ etatMutation: 'aucune', mutation: false });
    expect(rows[1]).toMatchObject({ etatMutation: 'interne', mutation: true });
  });
});

describe('colonne de suspension (#136)', () => {
  it('une valeur non négative vaut suspension', () => {
    const csv = 'Nom;Prénom;Licence;Suspension\nA;a;1;Oui\nB;b;2;31/12/2026\nC;c;3;Non\nD;d;4;';
    const { rows } = parseLicenciesCsv(csv);
    expect(rows.map((r) => r.suspendu)).toEqual([true, true, false, false]);
  });

  it('sans colonne de suspension, rien n\'est affirmé', () => {
    // Un import partiel ne doit pas effacer une suspension connue : le champ
    // reste vide, et la fusion à l'import garde la valeur existante.
    const csv = 'Nom;Prénom;Licence\nA;a;1';
    expect(parseLicenciesCsv(csv).rows[0]!.suspendu).toBeUndefined();
  });
});
