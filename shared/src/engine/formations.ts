/**
 * Combien de joueurs une formation met en jeu.
 *
 * Ce fait n'appartient à aucune fonctionnalité en particulier — il sert au
 * calcul de la mise (§3.B.1 : la mise fédérale est par joueur), au tirage des
 * équipes de mêlée, au dimensionnement de la feuille de match du championnat
 * des clubs, et à plusieurs écrans. Il existait pour cette raison en **cinq
 * copies** : `TAILLE_FORMATION` dans le moteur des mises et dans celui de la
 * feuille de match, `TEAM_SIZE` dans les actions du client, `TAILLE` dans le
 * verso de la feuille, `PLAYERS_PER_TEAM` dans les libellés.
 *
 * Les cinq portaient les mêmes valeurs. Ce n'était donc pas un défaut, mais
 * cinq endroits où une divergence future serait passée inaperçue — et deux
 * d'entre eux n'étaient couverts par aucun test.
 */
import type { TeamFormat } from '../types';

/**
 * Nombre de joueurs par équipe — ou par camp, sur une feuille de match.
 *
 * `TypePartie` (la formation d'une partie de rencontre) est une union de mêmes
 * valeurs que `TeamFormat` sans être le même type : les deux nomment des choses
 * différentes, l'une la formation d'un concours, l'autre celle d'une partie.
 * Cette table s'indexe indifféremment par l'une ou l'autre, et c'est voulu —
 * la question « combien de joueurs ? » a la même réponse dans les deux cas.
 */
export const TAILLE_FORMATION: Record<TeamFormat, number> = {
  tete_a_tete: 1,
  doublette: 2,
  triplette: 3,
};
