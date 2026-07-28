/**
 * Protections au tirage (manuel « Gestion Concours » §3.B.5).
 *
 * Le manuel décrit deux niveaux, et aucune notion de « tête de série » :
 *
 *  1. la protection **club**, appliquée par défaut par le programme : deux
 *     équipes d'un même club ne se rencontrent pas dès le début ;
 *  2. des **groupes de clubs** définis par l'organisateur pour ce concours —
 *     deux clubs d'un même village, une entente, un même comité — traités
 *     comme un seul club au tirage.
 *
 * Elles s'appliquent « au tirage pour les poules ou première partie dans un
 * concours à élimination directe ».
 *
 * Une équipe peut relever de plusieurs clubs : en national, l'équipe non
 * homogène est la règle. Le conflit se juge donc sur l'intersection des clubs
 * des deux équipes, pas sur un club unique.
 */
import type { Team } from '../types';

/** Groupes de clubs protégés ensemble (niveau 2). */
export type Protections = string[][];

const norm = (club: string): string => club.trim().toLowerCase();

/**
 * Clé de protection d'un club : l'identifiant de son groupe s'il en a un,
 * sinon le club lui-même. Deux clubs de même clé ne doivent pas se croiser.
 */
export function protectionKey(club: string, protections: Protections): string {
  const cle = norm(club);
  for (let i = 0; i < protections.length; i += 1) {
    if (protections[i]!.some((c) => norm(c) === cle)) return `groupe:${i}`;
  }
  return cle;
}

/** Clés de protection d'une équipe : une par club représenté. */
export function clesProtection(team: Team, protections: Protections): Set<string> {
  const clubs = team.players.map((p) => p.club).filter((c): c is string => Boolean(c));
  if (clubs.length === 0 && team.club) clubs.push(team.club);
  return new Set(clubs.map((c) => protectionKey(c, protections)));
}

/** Deux équipes sont en conflit si elles partagent une clé de protection. */
export function enConflit(a: Team, b: Team, protections: Protections): boolean {
  const clesA = clesProtection(a, protections);
  for (const cle of clesProtection(b, protections)) {
    if (clesA.has(cle)) return true;
  }
  return false;
}
