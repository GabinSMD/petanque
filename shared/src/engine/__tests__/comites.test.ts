import { describe, expect, it } from 'vitest';
import { codeComiteAffiche, comiteDuJoueur, comitesEquipe, libelleComites } from '../comites';
import type { Licencie, Player } from '../../types';

const fiche = (over: Partial<Licencie> & { licence: string }): Licencie => ({
  id: over.licence,
  name: 'Joueur ' + over.licence,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('comité d\'un joueur', () => {
  it('prend la valeur saisie avant tout', () => {
    // La copie d'écran p.25 montre une équipe à trois comités différents dont les
    // clubs viennent de deux départements : le comité n'est pas une propriété de
    // l'équipe, et une saisie explicite doit primer.
    expect(comiteDuJoueur({ name: 'A', comite: '074', licence: '03812345' })).toBe('074');
  });

  it('sinon celui de la fiche du licencié, même s\'il contredit la licence', () => {
    // La fiche dit 074 quand le numéro commencerait par 038 : c'est le cas réel de
    // la p.25, un joueur rattaché à un autre comité que celui de son numéro. Un
    // test où les deux valeurs coïncident ne prouverait rien — le sabotage l'a
    // montré en retirant la lecture de la fiche sans faire tomber le test.
    const fiches = new Map([['03812345', fiche({ licence: '03812345', comite: '074' })]]);
    expect(comiteDuJoueur({ name: 'A', licence: '03812345' }, fiches)).toBe('074');
  });

  it('sinon les trois premiers chiffres de la licence', () => {
    // `departementDeLicence` existe depuis le rapport du délégué (#100) : on la
    // réutilise plutôt que d'écrire une seconde règle qui pourrait diverger.
    expect(comiteDuJoueur({ name: 'A', licence: '07411559' })).toBe('074');
  });

  it('ne devine rien sur un numéro qui n\'en est pas un', () => {
    expect(comiteDuJoueur({ name: 'A', licence: '123' })).toBeUndefined();
    expect(comiteDuJoueur({ name: 'A' })).toBeUndefined();
  });
});

describe('comités d\'une équipe', () => {
  const equipe: Player[] = [
    { name: 'CLAUDI KEVIN', comite: '038' },
    { name: 'CAILLOCE DIDIER', comite: '074' },
    { name: 'COLLETTA CHRISTOPHE', comite: '074' },
  ];

  it('liste les comités distincts, dans l\'ordre des joueurs', () => {
    // L'équipe exacte de la copie d'écran p.25.
    expect(comitesEquipe(equipe)).toEqual(['038', '074']);
  });

  it('une équipe d\'un seul comité n\'en rend qu\'un', () => {
    expect(comitesEquipe([{ name: 'A', comite: '038' }, { name: 'B', comite: '038' }])).toEqual([
      '038',
    ]);
  });

  it('sans comité connu, la liste est vide plutôt qu\'inventée', () => {
    expect(comitesEquipe([{ name: 'A' }, { name: 'B' }])).toEqual([]);
  });

  it('s\'écrit comme les clubs, séparés par une barre', () => {
    expect(libelleComites(equipe)).toBe('CD38 / CD74');
  });
});

describe('affichage d\'un code de comité', () => {
  it('écrit « CD38 » pour le code fédéral 038', () => {
    // La liste imprimée de ligue (p.51) écrit `CD01`, `CD38`, `CD69` là où la
    // grille de saisie porte `038`. Même comité, deux écritures.
    expect(codeComiteAffiche('038')).toBe('CD38');
    expect(codeComiteAffiche('069')).toBe('CD69');
    expect(codeComiteAffiche('074')).toBe('CD74');
  });

  it('garde deux chiffres pour les départements à un chiffre', () => {
    // `001` s'écrit `CD01` sur la liste, pas `CD1`.
    expect(codeComiteAffiche('001')).toBe('CD01');
    expect(codeComiteAffiche('007')).toBe('CD07');
  });

  it('laisse les codes d\'outre-mer tels quels', () => {
    // 971 à 976 : trois chiffres significatifs, rien à retirer. Aucune capture ne
    // les montre, donc on ne les réécrit pas.
    expect(codeComiteAffiche('971')).toBe('CD971');
  });

  it('ne préfixe pas ce qui n\'est pas un code', () => {
    expect(codeComiteAffiche(undefined)).toBeUndefined();
    expect(codeComiteAffiche('')).toBeUndefined();
    expect(codeComiteAffiche('Isère')).toBeUndefined();
  });
});
