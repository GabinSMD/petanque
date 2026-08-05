import { describe, expect, it } from 'vitest';
import { controlerEquipe, type CriteresLicence } from '../licences';
import type { Licencie, Player } from '../../types';

/** Aucun critère fédéral : le contrôle du club d'équipe doit jouer quand même. */
const SANS_CRITERE: CriteresLicence = { annee: 2026, dateConcours: '2026-08-05' };

const joueur = (name: string, club?: string, licence?: string): Player => ({
  name,
  ...(club ? { club } : {}),
  ...(licence ? { licence } : {}),
});

function fiche(licence: string, club?: string): Licencie {
  return { id: `l${licence}`, name: `J${licence}`, licence, club, updatedAt: '2026-08-05T00:00:00.000Z' };
}

const anomalies = (
  players: Player[],
  clubEquipe?: string,
  criteres: CriteresLicence = SANS_CRITERE,
  fiches = new Map<string, Licencie>(),
): string[] => controlerEquipe(players, fiches, criteres, clubEquipe).anomaliesEquipe;

describe('cohérence du club d équipe', () => {
  it('signale « devrait être N.H. » quand l équipe déclare un club et n est pas homogène', () => {
    // Le rapport fédéral (p.28) : « Equipe 3 : Club Equipe Incorrect : devrait
    // être NH ». Le club déclaré ne peut pas être celui d'une équipe mélangée.
    expect(
      anomalies([joueur('A', 'CLUB A'), joueur('B', 'CLUB B')], 'CLUB A'),
    ).toContain('clubEquipeNonHomogene');
  });

  it('signale un club d équipe qui n est pas celui des joueurs', () => {
    // Variante non montrée par le manuel, mais c'est la même contradiction et
    // les mêmes conséquences : le rapport d'arbitrage, le tri par club et la
    // répartition multisite lisent tous `Team.club` directement.
    expect(anomalies([joueur('A', 'CLUB A'), joueur('B', 'CLUB A')], 'CLUB Z')).toContain(
      'clubEquipeErrone',
    );
  });

  it('ne signale rien quand le club déclaré est bien celui des joueurs', () => {
    expect(anomalies([joueur('A', 'CLUB A'), joueur('B', 'CLUB A')], 'CLUB A')).toEqual([]);
  });

  it('compare sans se soucier de la casse ni des espaces', () => {
    expect(anomalies([joueur('A', ' club a ')], 'CLUB A')).toEqual([]);
  });

  it('ne signale rien quand aucun joueur ne porte de club', () => {
    // Le club d'équipe est alors la valeur par défaut de tout le monde : rien ne
    // le contredit.
    expect(anomalies([joueur('A'), joueur('B')], 'CLUB A')).toEqual([]);
  });

  it('ne signale rien quand l équipe ne déclare pas de club', () => {
    // Sans club déclaré, il n'y a rien d'incorrect à corriger — l'affichage
    // montrera « CLUB A / CLUB B », ce qui est la vérité.
    expect(anomalies([joueur('A', 'CLUB A'), joueur('B', 'CLUB B')])).toEqual([]);
  });

  it('une chaîne vide ne déclare pas un club', () => {
    // Le cas discriminant, trouvé par sabotage : `addTeam` normalise déjà `''` en
    // `undefined`, mais un import ou une réplication peut porter la chaîne vide —
    // et notre propre écran vide ce champ quand les clubs divergent. Une garde
    // sur `!== undefined` aurait alors signalé une équipe qui ne déclare rien.
    expect(anomalies([joueur('A', 'CLUB A'), joueur('B', 'CLUB B')], '')).toEqual([]);
    expect(anomalies([joueur('A', 'CLUB A')], '   ')).toEqual([]);
  });

  it('joue même quand le concours n exige pas l homogénéité', () => {
    // C'est tout l'enjeu : `homogeneite` est un **critère du concours**, la
    // cohérence du club d'équipe est une **erreur de saisie**. La seconde est
    // fausse même sur un concours ouvert à tous.
    const sansCritere = anomalies([joueur('A', 'CLUB A'), joueur('B', 'CLUB B')], 'CLUB A');
    expect(sansCritere).toContain('clubEquipeNonHomogene');
    expect(sansCritere).not.toContain('homogeneite');

    const avecCritere = anomalies(
      [joueur('A', 'CLUB A'), joueur('B', 'CLUB B')],
      'CLUB A',
      { ...SANS_CRITERE, homogene: true },
    );
    expect(avecCritere).toContain('clubEquipeNonHomogene');
    expect(avecCritere).toContain('homogeneite');
  });

  it('préfère le club de la fiche fédérale à celui saisi', () => {
    // Comme le contrôle d'homogénéité : la fiche fait foi quand elle existe.
    const fiches = new Map([['1', fiche('1', 'CLUB REEL')]]);
    expect(
      anomalies([joueur('A', 'CLUB SAISI', '1')], 'CLUB SAISI', SANS_CRITERE, fiches),
    ).toContain('clubEquipeErrone');
  });

  it('un club connu seulement par son numéro ne contredit rien', () => {
    // « le numéro de club ne se compare pas à un nom » : un joueur dont on ne
    // connaît que le numéro fédéral ne peut ni confirmer ni démentir un nom
    // d'équipe. L'ignorer vaut mieux qu'une fausse anomalie.
    const fiches = new Map([
      ['1', { ...fiche('1'), clubNumero: '0380423' } as Licencie],
    ]);
    expect(anomalies([joueur('A', undefined, '1')], 'CLUB A', SANS_CRITERE, fiches)).toEqual([]);
  });
});
