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
import type { EtatMise, Team } from '../types';

export type { EtatMise };

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

/**
 * Bilan des mises. Les forfaits sont comptés à part et n'entrent dans aucun
 * montant : ce qu'il advient de leur engagement — remboursé ou gardé — est une
 * décision d'organisateur, pas une règle que le logiciel puisse deviner.
 */
export function bilanMises(teams: Team[], miseParEquipe: number): BilanMises {
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
    encaisse: parEtat.paye * miseParEquipe,
    aFacturer: parEtat.facturation * miseParEquipe,
    restantDu: parEtat.non_paye * miseParEquipe,
    forfaits,
  };
}
