import { describe, expect, it } from 'vitest';
import { NIVEAUX_FEDERAUX, estNiveauChampionnat, nomConcoursFederal } from '../federal';
import { codeNiveauFederal } from '../championnatCDF';

describe('liste « Niveau » du manuel (§3.A, copie d\'écran p.13)', () => {
  it('porte les huit valeurs, dans l\'ordre de la liste déroulante', () => {
    expect(NIVEAUX_FEDERAUX).toEqual([
      'departemental',
      'regional',
      'championnat_departemental_honorifique',
      'national',
      'international',
      'qualificatif_departemental',
      'championnat_departemental',
      'championnat_regional',
    ]);
  });

  it('distingue les quatre championnats que nous confondions', () => {
    // Un seul `championnat` fourre-tout ne permettait pas de dire lequel, donc
    // pas de code de niveau, donc pas de numéro de concours.
    const championnats = NIVEAUX_FEDERAUX.filter(estNiveauChampionnat);
    expect(championnats).toEqual([
      'championnat_departemental_honorifique',
      'qualificatif_departemental',
      'championnat_departemental',
      'championnat_regional',
    ]);
  });

  it('un concours n\'est pas un championnat', () => {
    expect(estNiveauChampionnat('departemental')).toBe(false);
    expect(estNiveauChampionnat('regional')).toBe(false);
    expect(estNiveauChampionnat('national')).toBe(false);
    expect(estNiveauChampionnat('international')).toBe(false);
    expect(estNiveauChampionnat('club')).toBe(false);
    expect(estNiveauChampionnat(undefined)).toBe(false);
  });

  it('l\'ancien « championnat » reste un championnat', () => {
    // Les concours déjà en base le portent : le retirer du type les casserait,
    // et cesser de le reconnaître leur retirerait leur liste de championnats.
    expect(estNiveauChampionnat('championnat')).toBe(true);
  });
});

describe('codes de niveau du numéro, après la distinction', () => {
  it('porte les trois codes attestés', () => {
    expect(codeNiveauFederal('departemental')).toBe('DEPT');
    expect(codeNiveauFederal('championnat_departemental')).toBe('CD');
    expect(codeNiveauFederal('qualificatif_departemental')).toBe('QUALIF_CD');
  });

  it('l\'ancien « championnat » garde le code départemental', () => {
    // C'est ce que faisait le lot #111 avant la distinction, et c'est le seul
    // championnat dont le code soit attesté.
    expect(codeNiveauFederal('championnat')).toBe('CD');
  });

  it('les cinq niveaux sans code attesté n\'en reçoivent pas', () => {
    expect(codeNiveauFederal('regional')).toBeUndefined();
    expect(codeNiveauFederal('championnat_regional')).toBeUndefined();
    expect(codeNiveauFederal('championnat_departemental_honorifique')).toBeUndefined();
    expect(codeNiveauFederal('national')).toBeUndefined();
    expect(codeNiveauFederal('international')).toBeUndefined();
    expect(codeNiveauFederal('club')).toBeUndefined();
    expect(codeNiveauFederal('coupe_de_france')).toBeUndefined();
  });
});

describe('nom fédéral : les nouveaux niveaux ont leur mot', () => {
  it('écrit le niveau en toutes lettres', () => {
    // Ce nom-là n'est pas le numéro : c'est notre repli quand il manque un code
    // (voir #111). Il doit rester lisible pour les quatre championnats.
    const nom = (niveau: (typeof NIVEAUX_FEDERAUX)[number]): string =>
      nomConcoursFederal({ date: '2026-01-07', niveau, format: 'triplette' });
    expect(nom('championnat_departemental')).toContain('CHAMPIONNAT-DEPARTEMENTAL');
    expect(nom('championnat_regional')).toContain('CHAMPIONNAT-REGIONAL');
    expect(nom('qualificatif_departemental')).toContain('QUALIFICATIF-DEPARTEMENTAL');
    expect(nom('championnat_departemental_honorifique')).toContain('HONORIFIQUE');
  });
});
