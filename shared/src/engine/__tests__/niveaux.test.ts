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

describe('nom fédéral : chaque niveau fédéral a son code', () => {
  it('écrit le code du niveau, comme le fait le numéro', () => {
    // Ce test exigeait autrefois le niveau **en toutes lettres**
    // (`CHAMPIONNAT-DEPARTEMENTAL`), au motif que ce nom était « notre repli
    // quand il manque un code ». Les copies d'écran disent l'inverse : le nom
    // porte les mêmes codes que le numéro. Ce qui compte donc ici, c'est que les
    // huit niveaux fédéraux **aient** un code — et le moteur seul en décide.
    // Ma première version de ce test exigeait un code pour **les huit** niveaux
    // fédéraux. C'était faux : seuls trois en ont un d'attesté (`DEPT`, `CD`,
    // `QUALIF_CD`) — le manuel ne montre pas les autres, et #111 s'était déjà
    // trompé en les inventant. On parcourt donc ceux qui en ont, lus du moteur,
    // et on vérifie qu'il en reste — sans quoi la boucle prouverait le vide.
    const avecCode = NIVEAUX_FEDERAUX.filter((n) => codeNiveauFederal(n));
    expect(avecCode.length).toBeGreaterThan(0);
    for (const niveau of avecCode) {
      const code = codeNiveauFederal(niveau)!;
      expect(
        nomConcoursFederal({ date: '2026-01-07', codeNiveau: code, jeu: 'petanque' }),
      ).toContain(`_${code}_PET_`);
    }
  });
});
