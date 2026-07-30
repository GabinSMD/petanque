import { describe, expect, it } from 'vitest';
import { controlerEquipe } from '../licences';
import type { Licencie, Player } from '../../types';

const CRITERES = { annee: 2026, homogene: false as const };

const fiches = new Map<string, Licencie>();

describe('licence étrangère (§3.B.1, zone 21)', () => {
  it('un joueur licencié à l\'étranger n\'est pas « sans licence »', () => {
    // « permet d'inscrire un joueur étranger affilié à la fédération de son
    // pays » : il a une licence, elle n'est simplement pas française. Le
    // signaler comme manquante ferait chercher un numéro qui n'existe pas.
    const joueurs: Player[] = [
      { name: 'DUPOND Jean', licence: '02600100' },
      { name: 'VAN DAMME Luc', licenceEtrangere: 'BE' },
    ];
    const controle = controlerEquipe(joueurs, fiches, CRITERES);
    expect(controle.joueurs[1]!.anomalies).toEqual([]);
  });

  it('un joueur sans licence du tout reste en anomalie', () => {
    const controle = controlerEquipe([{ name: 'SANS Rien' }], fiches, CRITERES);
    expect(controle.joueurs[0]!.anomalies).toContain('licence');
  });

  it('compte dans le contingent hors UE quand le pays y est', () => {
    // §3.C : « 1 seul joueur étranger Hors UE par équipe ». Une licence suisse
    // est étrangère et hors UE ; une licence belge est étrangère mais dans l'UE.
    const deuxSuisses: Player[] = [
      { name: 'MEIER Hans', licenceEtrangere: 'CH' },
      { name: 'MULLER Fritz', licenceEtrangere: 'CH' },
    ];
    const controle = controlerEquipe(deuxSuisses, fiches, { ...CRITERES, maxHorsUE: 1 });
    expect(controle.anomaliesEquipe).toContain('horsUE');

    const deuxBelges: Player[] = [
      { name: 'VAN DAMME Luc', licenceEtrangere: 'BE' },
      { name: 'PEETERS Jan', licenceEtrangere: 'BE' },
    ];
    expect(
      controlerEquipe(deuxBelges, fiches, { ...CRITERES, maxHorsUE: 1 }).anomaliesEquipe,
    ).not.toContain('horsUE');
  });

  it('un pays qu\'on ne sait pas lire ne disqualifie personne', () => {
    // Même prudence qu'ailleurs : l'incertitude se signale, elle ne tranche pas.
    const joueurs: Player[] = [
      { name: 'X Untel', licenceEtrangere: 'Zzzz' },
      { name: 'Y Untel', licenceEtrangere: 'Zzzz' },
    ];
    expect(
      controlerEquipe(joueurs, fiches, { ...CRITERES, maxHorsUE: 1 }).anomaliesEquipe,
    ).not.toContain('horsUE');
  });

  it('s\'ajoute au contingent des fiches fédérales, sans doubler', () => {
    // Un hors-UE du fichier fédéral et un licencié hors UE à l'étranger font
    // deux : le contingent est bien dépassé.
    const avecFiche = new Map<string, Licencie>([
      [
        '02600200',
        { id: 'l1', name: 'BEN ALI Karim', licence: '02600200', nationalite: 'MA', updatedAt: '' },
      ],
    ]);
    const joueurs: Player[] = [
      { name: 'BEN ALI Karim', licence: '02600200' },
      { name: 'MEIER Hans', licenceEtrangere: 'CH' },
    ];
    const controle = controlerEquipe(joueurs, avecFiche, { ...CRITERES, maxHorsUE: 1 });
    expect(controle.anomaliesEquipe).toContain('horsUE');
  });

  it('ne touche pas au contrôle d\'homogénéité', () => {
    // Le club d'un joueur étranger est ce qu'on a saisi : il compte comme les
    // autres pour l'homogénéité.
    const joueurs: Player[] = [
      { name: 'DUPOND Jean', licence: '02600100', club: 'Crest' },
      { name: 'VAN DAMME Luc', licenceEtrangere: 'BE', club: 'Bruxelles PC' },
    ];
    const controle = controlerEquipe(joueurs, fiches, { ...CRITERES, homogene: true });
    expect(controle.anomaliesEquipe).toContain('homogeneite');
  });
});
