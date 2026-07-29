/**
 * Modification d'une équipe après le tirage (manuel « Gestion Concours » §3.B.8).
 *
 * Le logiciel fédéral ouvre un « Mode Modification » qui déverrouille les
 * compositions une fois le tirage fait : « nous pourrons changer un nom s'il y a
 * un remplacement de joueur après tirage ». C'est le cas qui arrive à chaque
 * concours — un joueur se blesse, un autre arrive en retard, une licence pose
 * problème.
 *
 * Ce qui peut changer, c'est **qui joue**. Ce qui ne peut pas, c'est ce sur quoi
 * le tirage repose : l'identité de l'équipe et son numéro de dossard, écrits sur
 * le tableau et sur les listes déjà imprimées. Cette règle est ici plutôt que
 * dans l'écran, pour être vérifiée au point d'écriture et non seulement suggérée
 * par des champs masqués.
 */
import type { Team } from '../types';

export type ModificationEquipe = { ok: true } | { ok: false; raison: string };

export function modificationApresTirage(avant: Team, apres: Team): ModificationEquipe {
  if (apres.id !== avant.id) {
    return {
      ok: false,
      raison: "On ne remplace pas une équipe par une autre après le tirage : le tableau la désigne par son identité.",
    };
  }
  if (apres.number !== avant.number) {
    return {
      ok: false,
      raison:
        'Le numéro de dossard ne change pas après le tirage : le tableau et les listes imprimées en dépendent.',
    };
  }
  const joueurs = apres.players ?? [];
  if (joueurs.length === 0) {
    return { ok: false, raison: 'Une équipe sans joueur ne peut pas jouer.' };
  }
  if (joueurs.some((p) => !p.name?.trim())) {
    return { ok: false, raison: 'Chaque joueur doit porter un nom : un nom vide ne remplace personne.' };
  }
  return { ok: true };
}
