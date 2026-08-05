/**
 * Clubs d'une équipe.
 *
 * En national et en régional, une équipe non homogène est la règle : deux
 * licenciés de clubs différents jouent ensemble. Le club appartient donc au
 * joueur, pas à l'équipe. Le champ `club` de l'équipe reste pour les concours
 * de club, où tout le monde vient du même endroit : il sert alors de valeur
 * par défaut.
 */
import type { Licencie, Player } from '../types';

const cle = (club: string): string => club.trim().toLowerCase();

/** Club d'un joueur, la fiche fédérale faisant foi. */
export interface ClubDuJoueur {
  /**
   * Clé de comparaison : le nom normalisé, ou le numéro à défaut de nom. Absente
   * quand on ne sait rien du club.
   */
  cle?: string;
  /** Nom tel qu'il s'affiche, dans sa graphie d'origine. */
  nom?: string;
  /** Numéro de club fédéral, quand la fiche le porte. */
  numero?: string;
}

/**
 * Résout le club d'un joueur. La fiche fédérale fait foi quand elle existe,
 * sinon ce qui a été saisi à l'inscription — un joueur hors fichier n'échappe
 * pas au contrôle. À défaut de nom, le numéro de club sert de clé : il distingue
 * deux clubs entre eux, même s'il ne se compare pas à un nom.
 *
 * Distinct de `clubsEquipe`, qui ne lit que ce qui a été saisi : douze sites
 * d'affichage en dépendent et n'ont pas le fichier des licenciés sous la main.
 * Ici on l'a, et la fiche l'emporte.
 */
export function clubDuJoueur(p: Player, fiches: Map<string, Licencie>): ClubDuJoueur {
  const fiche = p.licence ? fiches.get(p.licence) : undefined;
  const nom = (fiche?.club ?? p.club)?.trim() || undefined;
  const numero = fiche?.clubNumero?.trim() || undefined;
  const identifiant = nom ?? numero;
  return {
    ...(identifiant ? { cle: cle(identifiant) } : {}),
    ...(nom ? { nom } : {}),
    ...(numero ? { numero } : {}),
  };
}

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
