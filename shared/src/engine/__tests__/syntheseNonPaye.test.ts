import { describe, expect, it } from 'vitest';
import { syntheseNonPaye } from '../mises';
import type { EtatMise, Licencie, Player, Team } from '../../types';

/**
 * « Synthèse Non Payé » (planche p.33) : les impayés groupés par club, avec le
 * compte, le montant dû et un total.
 *
 * La planche donne un jeu de données complet et vérifiable, puisque le « Bilan
 * Paiement » de la même page liste les seize équipes une par une. Les tests
 * ci-dessous en rejouent l'arithmétique.
 */
const fiche = (licence: string, club?: string, clubNumero?: string): Licencie => ({
  id: licence,
  name: `J${licence}`,
  licence,
  ...(club ? { club } : {}),
  ...(clubNumero ? { clubNumero } : {}),
  updatedAt: '2026-01-25T00:00:00.000Z',
});

const joueur = (licence?: string, club?: string): Player => ({
  name: licence ? `J${licence}` : 'Anonyme',
  ...(licence ? { licence } : {}),
  ...(club ? { club } : {}),
});

const equipe = (number: number, players: Player[], mise: EtatMise, over: Partial<Team> = {}): Team =>
  ({ id: `t${number}`, concoursId: 'c', number, players, mise, ...over }) as Team;

describe('synthèse des impayés, groupée par club', () => {
  // Les quatre clubs de la planche, avec leurs numéros fédéraux.
  const FICHES = new Map<string, Licencie>([
    ['a', fiche('a', 'P C PIERRE SEMARD', '0380423')],
    ['b', fiche('b', 'APL FIRMINY VERT', '0422013')],
    ['c', fiche('c', 'AMICALE PET MERANDAISE', '0730010')],
    ['x', fiche('x', 'CANNES AERO SPORTS', '0061020')],
    ['y', fiche('y', 'PALAVAS PETANQUE', '0340214')],
  ]);

  it('rejoue les quatre lignes de la planche, et son total', () => {
    // Le Bilan Paiement de la p.33 : 16 équipes, 4 impayées — n°16 (P C PIERRE
    // SEMARD), n°7 (APL FIRMINY VERT), n°3 (AMICALE PET MERANDAISE) et n°11
    // (N.H.). Le club 0380423 a **deux** équipes inscrites (n°2 et n°16) mais
    // une seule impayée : la Synthèse annonce pourtant « 1 ».
    const teams = [
      equipe(2, [joueur('a')], 'paye'),
      equipe(16, [joueur('a')], 'non_paye'),
      equipe(7, [joueur('b')], 'non_paye'),
      equipe(3, [joueur('c')], 'non_paye'),
      equipe(11, [joueur('x'), joueur('y')], 'non_paye'), // deux clubs → N.H.
      equipe(10, [joueur('x')], 'paye'),
    ];
    const s = syntheseNonPaye(teams, FICHES, 12);
    expect(s.lignes.map((l) => `${l.libelle} · ${l.equipes} · ${l.montant} €`)).toEqual([
      '0380423/P C PIERRE SEMARD · 1 · 12 €',
      '0422013/APL FIRMINY VERT · 1 · 12 €',
      '0730010/AMICALE PET MERANDAISE · 1 · 12 €',
      'N.H. · 1 · 12 €',
    ]);
    expect(s.equipes).toBe(4);
    expect(s.montant).toBe(48);
  });

  it('compte les équipes **impayées**, pas les inscriptions du club', () => {
    // Le libellé fédéral dit « Nbre d'équipe inscrite(s) », mais l'arithmétique
    // de la planche le dément : N.H. y a huit équipes au Bilan et la Synthèse
    // en annonce une. On suit le calcul, pas l'étiquette.
    const teams = [
      equipe(1, [joueur('a')], 'non_paye'),
      equipe(2, [joueur('a')], 'non_paye'),
      equipe(3, [joueur('a')], 'paye'),
      equipe(4, [joueur('a')], 'facturation'),
    ];
    const s = syntheseNonPaye(teams, FICHES, 12);
    expect(s.lignes).toHaveLength(1);
    expect(s.lignes[0]!.equipes).toBe(2);
    expect(s.lignes[0]!.montant).toBe(24);
    // Le total somme les **équipes**, pas les lignes. Trouvé par sabotage :
    // `lignes.length` passait tous les autres cas, où chaque club n'avait qu'une
    // équipe impayée — y compris celui de la planche.
    expect(s.equipes).toBe(2);
    expect(s.montant).toBe(24);
  });

  it('trie par numéro de club croissant, N.H. en dernier', () => {
    // Par **nom**, l'ordre de la planche serait AMICALE / APL / P C : ce n'est
    // pas celui qu'elle montre. C'est donc le numéro qui trie.
    const teams = [
      equipe(1, [joueur('c')], 'non_paye'), // 0730010
      equipe(2, [joueur('a'), joueur('b')], 'non_paye'), // N.H.
      equipe(3, [joueur('a')], 'non_paye'), // 0380423
      equipe(4, [joueur('b')], 'non_paye'), // 0422013
    ];
    const lignes = syntheseNonPaye(teams, FICHES, 12).lignes;
    expect(lignes.map((l) => l.libelle)).toEqual([
      '0380423/P C PIERRE SEMARD',
      '0422013/APL FIRMINY VERT',
      '0730010/AMICALE PET MERANDAISE',
      'N.H.',
    ]);
    // On verrouille aussi la suite des **numéros**, et pas seulement celle des
    // libellés. Trier par libellé donnerait aujourd'hui le même résultat — le
    // libellé commence par le numéro, et `/` se classe avant les chiffres, ce
    // que j'ai vérifié — mais changer un jour le format du libellé ferait
    // dériver l'ordre sans qu'aucun test s'en aperçoive.
    expect(lignes.map((l) => l.clubNumero)).toEqual([
      '0380423',
      '0422013',
      '0730010',
      undefined,
    ]);
  });

  it('n oublie ni les payées ni les facturées : elles ne doivent rien', () => {
    const teams = [
      equipe(1, [joueur('a')], 'paye'),
      equipe(2, [joueur('b')], 'facturation'),
    ];
    const s = syntheseNonPaye(teams, FICHES, 12);
    expect(s.lignes).toEqual([]);
    expect(s.equipes).toBe(0);
    expect(s.montant).toBe(0);
  });

  it('écarte les forfaits, comme le bilan des mises', () => {
    // `bilanMises` les compte à part et ne les met dans aucun montant : ce qu'il
    // advient de leur engagement est une décision d'organisateur. La synthèse
    // sert à relancer — on ne relance pas une équipe qui ne joue pas.
    const teams = [
      equipe(1, [joueur('a')], 'non_paye', { forfait: true }),
      equipe(2, [joueur('b')], 'non_paye'),
    ];
    const s = syntheseNonPaye(teams, FICHES, 12);
    expect(s.lignes.map((l) => l.libelle)).toEqual(['0422013/APL FIRMINY VERT']);
    expect(s.equipes).toBe(1);
  });

  it('la fiche fédérale fait foi sur le club saisi', () => {
    // Même règle que le contrôle des licences : un club saisi à la main ne
    // contredit pas le fichier.
    const teams = [equipe(1, [joueur('a', 'CLUB INVENTE')], 'non_paye')];
    expect(syntheseNonPaye(teams, FICHES, 12).lignes[0]!.libelle).toBe(
      '0380423/P C PIERRE SEMARD',
    );
  });

  it('un club sans numéro s affiche par son seul nom', () => {
    // La planche ne montre que des clubs numérotés ; hors fichier fédéral, on a
    // le nom sans le numéro. L'inventer serait pire que de s'en passer.
    const teams = [equipe(1, [joueur(undefined, 'BOULE JOYEUSE')], 'non_paye')];
    const s = syntheseNonPaye(teams, new Map(), 12);
    expect(s.lignes[0]!.libelle).toBe('BOULE JOYEUSE');
    expect(s.lignes[0]!.clubNumero).toBeUndefined();
  });

  it('place les clubs sans numéro après les numérotés, et avant N.H.', () => {
    // Décision nôtre : la planche ne montre pas ce cas. Les numéros d'abord
    // parce qu'ils ordonnent, les sans-numéro par nom, N.H. en dernier parce
    // que ce n'est pas un club.
    const teams = [
      equipe(1, [joueur('a'), joueur('b')], 'non_paye'), // N.H.
      equipe(2, [joueur(undefined, 'ZORRO PETANQUE')], 'non_paye'),
      equipe(3, [joueur(undefined, 'ABC BOULES')], 'non_paye'),
      equipe(4, [joueur('a')], 'non_paye'), // 0380423
    ];
    expect(syntheseNonPaye(teams, FICHES, 12).lignes.map((l) => l.libelle)).toEqual([
      '0380423/P C PIERRE SEMARD',
      'ABC BOULES',
      'ZORRO PETANQUE',
      'N.H.',
    ]);
  });

  it('regroupe deux orthographes du même club', () => {
    // « boule joyeuse » et « Boule Joyeuse » sont un seul club à relancer. Le
    // libellé garde la première graphie rencontrée.
    const teams = [
      equipe(1, [joueur(undefined, 'Boule Joyeuse')], 'non_paye'),
      equipe(2, [joueur(undefined, ' boule joyeuse ')], 'non_paye'),
    ];
    const s = syntheseNonPaye(teams, new Map(), 12);
    expect(s.lignes).toHaveLength(1);
    expect(s.lignes[0]!.libelle).toBe('Boule Joyeuse');
    expect(s.lignes[0]!.equipes).toBe(2);
  });

  it('une équipe sans aucun club connu n est pas N.H. mais sans club', () => {
    // `estHomogene` ne conclut pas sans club renseigné, et on ne peut pas
    // reprocher une non-homogénéité qu'on ignore. Mais il faut bien la relancer
    // quelqu'un : elle forme son propre groupe, distinct de N.H.
    const teams = [equipe(1, [joueur(), joueur()], 'non_paye')];
    const s = syntheseNonPaye(teams, new Map(), 12);
    expect(s.lignes).toHaveLength(1);
    expect(s.lignes[0]!.libelle).toBe('Club non renseigné');
    expect(s.equipes).toBe(1);
    expect(s.montant).toBe(12);
  });

  it('sans mise fixée, les montants sont à zéro mais les clubs restent', () => {
    // Un concours gratuit n'a pas d'impayés en euros ; la liste des équipes non
    // réglées garde pourtant son sens à la table de marque.
    const teams = [equipe(1, [joueur('a')], 'non_paye')];
    const s = syntheseNonPaye(teams, FICHES, 0);
    expect(s.lignes[0]!.equipes).toBe(1);
    expect(s.lignes[0]!.montant).toBe(0);
    expect(s.montant).toBe(0);
  });
});
