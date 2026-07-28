/**
 * Clubs d'une équipe.
 *
 * En national et en régional, une équipe non homogène est la règle : deux
 * licenciés de clubs différents jouent ensemble. Le club appartient donc au
 * joueur, pas à l'équipe. Le champ `club` de l'équipe reste pour les concours
 * de club, où tout le monde vient du même endroit : il sert alors de valeur
 * par défaut.
 */
import type { Player } from '../types';

const cle = (club: string): string => club.trim().toLowerCase();

/**
 * Clubs distincts d'une équipe, dans l'ordre des joueurs. `clubEquipe`
 * complète la liste quand aucun joueur ne porte de club.
 */
export function clubsEquipe(players: Player[], clubEquipe?: string): string[] {
  const vus = new Map<string, string>();
  for (const p of players) {
    const club = p.club?.trim();
    if (club) vus.set(cle(club), club);
  }
  const defaut = clubEquipe?.trim();
  if (defaut && !vus.has(cle(defaut)) && vus.size === 0) vus.set(cle(defaut), defaut);
  return [...vus.values()];
}

/**
 * Équipe homogène : un seul club connu. Sans aucun club renseigné on ne
 * conclut pas — on ne peut pas reprocher une non-homogénéité qu'on ignore.
 */
export function estHomogene(players: Player[], clubEquipe?: string): boolean {
  return clubsEquipe(players, clubEquipe).length <= 1;
}

/** « Boule Joyeuse / Pétanque du Port » — comme sur la feuille fédérale. */
export function libelleClubs(players: Player[], clubEquipe?: string): string {
  return clubsEquipe(players, clubEquipe).join(' / ');
}
