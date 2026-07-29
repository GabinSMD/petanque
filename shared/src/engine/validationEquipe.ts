/**
 * Validation d'une équipe au point d'écriture.
 *
 * Une équipe malformée n'est pas une donnée inexacte : c'est une donnée qui
 * casse l'écran des inscriptions, et le rechargement avec — elle est en base.
 * Le cas est arrivé pendant le développement, avec un appel qui passait un
 * objet là où un tableau de joueurs était attendu : huit équipes écrites, écran
 * blanc, et rien pour le dire à l'organisateur.
 *
 * La règle est donc ici, en amont de la base, et non dans les écrans : un champ
 * masqué n'est pas une garantie, et une équipe arrive de six chemins différents
 * — saisie, import CSV, lecteur de licences, QR, restauration de sauvegarde,
 * synchronisation.
 *
 * Ce qui est vérifié : ce sans quoi l'équipe est **inexploitable** — son
 * identité, son dossard, des joueurs qui sont des joueurs et qui portent un
 * nom. Les règles de fond ont leur propre place : le contrôle des licences
 * (§3.C) dans `licences.ts`, ce qui peut changer après le tirage (§3.B.8) dans
 * `apresTirage.ts`.
 */
import type { Team } from '../types';

export type ValidationEquipe = { ok: true } | { ok: false; raison: string };

const OK: ValidationEquipe = { ok: true };

const chaineRemplie = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Un dossard est un entier strictement positif : ni 0, ni 2,5, ni « 7 ». */
const dossardValide = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;

export function validerEquipe(candidat: unknown): ValidationEquipe {
  if (typeof candidat !== 'object' || candidat === null || Array.isArray(candidat)) {
    return { ok: false, raison: 'Ce n\'est pas une équipe : aucune donnée exploitable.' };
  }
  const equipe = candidat as Partial<Team>;

  if (!chaineRemplie(equipe.id)) {
    return {
      ok: false,
      raison: 'Cette équipe n\'a pas d\'identifiant : rien ne permettrait de la retrouver.',
    };
  }
  if (!chaineRemplie(equipe.concoursId)) {
    return {
      ok: false,
      raison: 'Cette équipe n\'est rattachée à aucun concours : elle n\'apparaîtrait nulle part.',
    };
  }
  if (!dossardValide(equipe.number)) {
    return {
      ok: false,
      raison:
        'Le numéro de dossard doit être un entier positif : le tableau, les listes imprimées et la saisie rapide désignent l\'équipe par ce numéro.',
    };
  }
  if (!Array.isArray(equipe.players)) {
    return {
      ok: false,
      raison: 'La liste des joueurs est absente ou n\'est pas une liste.',
    };
  }
  if (equipe.players.length === 0) {
    return { ok: false, raison: 'Une équipe sans joueur ne peut pas jouer.' };
  }
  for (const joueur of equipe.players) {
    if (typeof joueur !== 'object' || joueur === null || Array.isArray(joueur)) {
      return {
        ok: false,
        raison: 'Un des joueurs n\'est pas un joueur : il faut au moins un nom par joueur.',
      };
    }
    if (!chaineRemplie((joueur as { name?: unknown }).name)) {
      return { ok: false, raison: 'Chaque joueur doit porter un nom.' };
    }
  }
  return OK;
}
