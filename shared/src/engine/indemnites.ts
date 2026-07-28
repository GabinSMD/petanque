/**
 * Répartition du pot entre les équipes classées.
 *
 * Le poids double à chaque rang en montant : le vainqueur touche deux fois le
 * finaliste, qui touche deux fois un demi-finaliste, etc. Un club peut aussi
 * n'indemniser que jusqu'à un certain rang — les suivants repartent avec des
 * lots ou des tickets, pas avec de l'argent. Dans ce cas tout le pot va aux
 * rangs payés : rien ne se perd en route.
 */
import type { RankGroup } from './bracket';

export interface LigneIndemnite {
  rank: number;
  label: string;
  nbEquipes: number;
  /** Faux quand le rang est au-delà du seuil de paiement. */
  paye: boolean;
  parEquipe: number;
  sousTotal: number;
}

export interface Repartition {
  lignes: LigneIndemnite[];
  totalDistribue: number;
  /** Montant moyen par équipe engagée, forfaits compris s'ils sont comptés. */
  parEquipeEngagee: number;
}

/** Arrondi à 0,10 € : on ne fait pas la monnaie au centime sur un boulodrome. */
const arrondi = (n: number): number => Math.round(n * 10) / 10;

export function repartitionIndemnites(
  groups: RankGroup[],
  pot: number,
  jusquAuRang: number | undefined,
  nbEquipesEngagees = 0,
): Repartition {
  const payes = groups.map((g) => jusquAuRang === undefined || g.rank <= jusquAuRang);

  // Poids : le dernier rang payé vaut 1, et double à chaque rang au-dessus.
  const nbPayes = payes.filter(Boolean).length;
  let rangPaye = 0;
  const poids = groups.map((_, i) => {
    if (!payes[i]) return 0;
    const p = 2 ** Math.max(0, nbPayes - 1 - rangPaye);
    rangPaye += 1;
    return p;
  });

  const poidsTotal = groups.reduce((s, g, i) => s + poids[i]! * g.teamIds.length, 0);

  const lignes = groups.map((g, i) => {
    const parEquipe =
      poidsTotal > 0 && payes[i] ? arrondi((pot * poids[i]!) / poidsTotal) : 0;
    return {
      rank: g.rank,
      label: g.label,
      nbEquipes: g.teamIds.length,
      paye: Boolean(payes[i]) && parEquipe > 0,
      parEquipe,
      sousTotal: arrondi(parEquipe * g.teamIds.length),
    };
  });

  const totalDistribue = arrondi(lignes.reduce((s, l) => s + l.sousTotal, 0));
  return {
    lignes,
    totalDistribue,
    parEquipeEngagee: nbEquipesEngagees > 0 ? totalDistribue / nbEquipesEngagees : 0,
  };
}
