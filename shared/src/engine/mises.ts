/**
 * Mises des équipes (manuel « Gestion Concours » §3.B.1, zone 19, et bilan des
 * paiements §3.B.9.D).
 *
 * Le texte du manuel dit seulement « permet d'indiquer le paiement ou
 * non-paiement de l'équipe inscrite », ce qui décrit exactement le booléen que
 * nous avions. La copie d'écran de la p.19, extraite en pleine résolution, en
 * montre trois : le cadre jaune **« Mises »** porte *Non Payé*, *Payé* et
 * **Facturation**, plus un champ **« Commentaire: »** juste en dessous, dans le
 * même cadre.
 *
 * Le troisième état n'est pas un raffinement : c'est la distinction dont un
 * trésorier a besoin en fin de journée. « Facturation » veut dire que l'équipe
 * joue et que le club paiera sur facture — l'argent n'est pas dans la caisse,
 * mais il n'est pas perdu non plus. Le confondre avec « non payé » fait courir
 * après un règlement déjà réglé ; le confondre avec « payé » fait un compte de
 * caisse faux.
 *
 * D'où trois montants distincts dans le bilan, et aucun total « recette » qui
 * mélangerait les trois.
 */
import type { Concours, EtatMise, Licencie, Team } from '../types';
import { clubDuJoueur } from './clubs';
import { TAILLE_FORMATION } from './formations';

export type { EtatMise };

/**
 * Ce que l'équipe doit, en euros — ou `undefined` si aucune mise n'est fixée.
 *
 * La mise fédérale est **par joueur** : le champ de la fenêtre de création
 * s'appelle `Mise/Joueur` et vaut `4.00 €` (planche p.12). Le total d'équipe est
 * ce montant multiplié par la **formation**, et non par les joueurs présents —
 * le bilan de la p.33 écrit `Nbre Equipe : 16 = 192 €`, un prix unitaire
 * constant qu'il ne pourrait pas afficher comme un produit s'il comptait les
 * joueurs équipe par équipe. Un engagement ne baisse pas parce qu'un joueur
 * manque à l'appel.
 *
 * `miseParEquipe` est l'ancien champ, qui portait déjà un total d'équipe : on le
 * relit **tel quel**, sans le multiplier. Le multiplier ferait payer 36 € à des
 * équipes inscrites pour 12 — c'est le genre de réinterprétation silencieuse
 * qu'un changement d'unité rend possible, et qu'il faut refuser.
 *
 * Le `!== undefined` n'est pas décoratif : avec un `||`, un concours gratuit
 * (`miseParJoueur: 0`) retomberait sur son ancien total.
 */
export function miseEquipe(
  c: Pick<Concours, 'format' | 'miseParJoueur' | 'miseParEquipe'>,
): number | undefined {
  if (c.miseParJoueur !== undefined) return c.miseParJoueur * TAILLE_FORMATION[c.format];
  return c.miseParEquipe;
}

/** Les trois positions du cadre « Mises », dans son ordre. */
export const ETATS_MISE: EtatMise[] = ['non_paye', 'paye', 'facturation'];

/**
 * État de la mise d'une équipe.
 *
 * Les équipes inscrites avant ce lot n'ont que le booléen `paid` : elles se
 * relisent « payé » ou « non payé » plutôt que de repasser impayées. Le nouvel
 * état prime quand il existe — sinon une équipe passée en facturation
 * redeviendrait « payée » à la relecture.
 */
export function etatMise(equipe: Pick<Team, 'mise' | 'paid'>): EtatMise {
  if (equipe.mise && ETATS_MISE.includes(equipe.mise)) return equipe.mise;
  return equipe.paid ? 'paye' : 'non_paye';
}

/**
 * Pose un état de mise, en gardant l'ancien booléen en accord.
 *
 * Ce n'est pas de la redondance mais une précaution de synchronisation : une
 * tablette restée sur la version précédente ne lit que `paid`. Sans cette mise à
 * jour, elle afficherait toute la liste comme impayée après avoir reçu les
 * équipes d'un appareil à jour. « Facturation » y apparaît comme non réglée, ce
 * qui est le moins faux des deux.
 */
export function poserMise(equipe: Team, mise: EtatMise): Team {
  return { ...equipe, mise, paid: mise === 'paye' };
}

/**
 * Relit une mise depuis une cellule de fichier.
 *
 * Deux formats à reconnaître : les trois états en clair, et les anciens exports
 * où la colonne s'appelait « Réglé » et valait « oui » ou rien.
 *
 * Le piège est que « non payé » **contient** « payé ». C'est `startsWith` qui
 * protège, et rien d'autre : une reconnaissance par sous-chaîne marquerait
 * réglées toutes les équipes qui ne le sont pas. J'avais d'abord ajouté un garde
 * explicite sur « non » — le sabotage a montré qu'il ne servait à rien, puisque
 * « non payé » ne commence par aucun des motifs reconnus et retombe déjà sur
 * « non payé ». Code mort retiré plutôt que test inventé pour le justifier.
 */
export function etatMiseDepuisTexte(valeur: string | undefined): EtatMise {
  const n = (valeur ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!n) return 'non_paye';
  if (n.startsWith('factur')) return 'facturation';
  if (n.startsWith('paye') || ['oui', 'o', 'x', '1', 'true'].includes(n)) return 'paye';
  return 'non_paye';
}

export interface BilanMises {
  /** Nombre d'équipes par état, forfaits exclus. */
  parEtat: Record<EtatMise, number>;
  /** Montant en caisse : les équipes payées. */
  encaisse: number;
  /** Montant à facturer : ni encaissé, ni perdu. */
  aFacturer: number;
  /** Montant qu'il reste à réclamer. */
  restantDu: number;
  /** Équipes forfait, comptées à part : elles ne jouent pas. */
  forfaits: number;
}

/** Une ligne de la « Synthèse Non Payé » : un club et ce qu'il doit. */
export interface LigneSyntheseNonPaye {
  /** « 0380423/P C PIERRE SEMARD », « BOULE JOYEUSE », « N.H. ». */
  libelle: string;
  /** Numéro de club fédéral, quand il est connu. Sert au tri. */
  clubNumero?: string;
  /**
   * Nombre d'équipes **impayées** de ce club.
   *
   * Le libellé fédéral dit « Nbre d'équipe inscrite(s) », mais l'arithmétique de
   * la planche le dément : le club `0380423` y a deux équipes inscrites (n°2 et
   * n°16) dont une seule impayée, et la Synthèse annonce « 1 » ; `N.H.` y a huit
   * équipes et la Synthèse annonce « 1 ». On suit le calcul, pas l'étiquette.
   */
  equipes: number;
  /** Ce que ce club doit : `equipes × mise d'équipe`. */
  montant: number;
}

export interface SyntheseNonPaye {
  lignes: LigneSyntheseNonPaye[];
  /** Total des équipes impayées — le `Nbre Equipe : 4` de la planche. */
  equipes: number;
  /** Total dû — le `= 48 €` de la planche. */
  montant: number;
}

/** Groupe des équipes dont les joueurs ne viennent pas tous du même club. */
const GROUPE_NON_HOMOGENE = 'N.H.';
/**
 * Groupe des équipes dont on ne connaît aucun club. Distinct de `N.H.` : celui-ci
 * affirme des clubs différents, celui-là n'affirme rien. `estHomogene` ne conclut
 * pas sans club renseigné, et il faut pourtant bien relancer quelqu'un.
 */
const GROUPE_SANS_CLUB = 'Club non renseigné';

/**
 * « Synthèse Non Payé » (manuel §3.B.9.D, planche p.33) : les impayés groupés
 * par club, avec le compte, le montant dû et un total.
 *
 * On ne relance pas une équipe, on relance un club. Six lignes éparpillées dans
 * une liste triée par dossard sont un travail de recoupement ; ici c'est un
 * appel téléphonique et une somme.
 *
 * Le tri suit la planche : par **numéro** de club croissant. Par nom, son ordre
 * serait AMICALE / APL / P C — ce n'est pas celui qu'elle montre. Les clubs sans
 * numéro viennent ensuite, par nom ; `N.H.` et « club non renseigné » ferment la
 * liste, n'étant pas des clubs.
 *
 * Les forfaits sont écartés, comme dans `bilanMises` : on ne relance pas une
 * équipe qui ne joue pas, et ce qu'il advient de son engagement est une décision
 * d'organisateur.
 */
export function syntheseNonPaye(
  teams: Team[],
  fiches: Map<string, Licencie>,
  totalParEquipe: number,
): SyntheseNonPaye {
  const groupes = new Map<string, { libelle: string; numero?: string; equipes: number }>();

  for (const equipe of teams) {
    if (equipe.forfait) continue;
    if (etatMise(equipe) !== 'non_paye') continue;

    const clubs = equipe.players.map((p) => clubDuJoueur(p, fiches)).filter((c) => c.cle);
    const distincts = new Map(clubs.map((c) => [c.cle!, c]));

    let cle: string;
    let libelle: string;
    let numero: string | undefined;
    if (distincts.size === 0) {
      cle = GROUPE_SANS_CLUB;
      libelle = GROUPE_SANS_CLUB;
    } else if (distincts.size > 1) {
      cle = GROUPE_NON_HOMOGENE;
      libelle = GROUPE_NON_HOMOGENE;
    } else {
      const club = [...distincts.values()][0]!;
      cle = club.cle!;
      numero = club.numero;
      // « 0380423/P C PIERRE SEMARD » quand le numéro est connu ; sinon le seul
      // nom — inventer un numéro serait pire que de s'en passer.
      libelle = club.nom
        ? numero
          ? `${numero}/${club.nom}`
          : club.nom
        : (numero ?? cle);
    }

    const dejaVu = groupes.get(cle);
    if (dejaVu) dejaVu.equipes += 1;
    // La première graphie rencontrée fait le libellé : « boule joyeuse » et
    // « Boule Joyeuse » sont un seul club à relancer.
    else groupes.set(cle, { libelle, ...(numero ? { numero } : {}), equipes: 1 });
  }

  const rang = (g: { libelle: string; numero?: string }): number => {
    if (g.libelle === GROUPE_NON_HOMOGENE || g.libelle === GROUPE_SANS_CLUB) return 2;
    return g.numero ? 0 : 1;
  };

  const lignes = [...groupes.values()]
    .sort((a, b) => {
      const ra = rang(a);
      const rb = rang(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return a.numero!.localeCompare(b.numero!);
      return a.libelle.localeCompare(b.libelle, 'fr');
    })
    .map((g) => ({
      libelle: g.libelle,
      ...(g.numero ? { clubNumero: g.numero } : {}),
      equipes: g.equipes,
      montant: g.equipes * totalParEquipe,
    }));

  return {
    lignes,
    equipes: lignes.reduce((n, l) => n + l.equipes, 0),
    montant: lignes.reduce((n, l) => n + l.montant, 0),
  };
}

/**
 * Bilan des mises. Les forfaits sont comptés à part et n'entrent dans aucun
 * montant : ce qu'il advient de leur engagement — remboursé ou gardé — est une
 * décision d'organisateur, pas une règle que le logiciel puisse deviner.
 */
export function bilanMises(teams: Team[], totalParEquipe: number): BilanMises {
  const parEtat: Record<EtatMise, number> = { non_paye: 0, paye: 0, facturation: 0 };
  let forfaits = 0;
  for (const equipe of teams) {
    if (equipe.forfait) {
      forfaits += 1;
      continue;
    }
    parEtat[etatMise(equipe)] += 1;
  }
  return {
    parEtat,
    encaisse: parEtat.paye * totalParEquipe,
    aFacturer: parEtat.facturation * totalParEquipe,
    restantDu: parEtat.non_paye * totalParEquipe,
    forfaits,
  };
}
