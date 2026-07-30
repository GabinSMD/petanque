/**
 * Export d'une liste d'inscrits (manuel « Gestion Concours » §3.B.10.A).
 *
 * « Permet de sauvegarder la liste des inscrits. Cette fonction servira
 * également pour la création d'un nouveau concours. »
 *
 * Le format vit ici, à côté de son lecteur (`inscritsImport.ts`) : c'est un
 * fichier fait pour être **relu**, et un export qu'on ne peut pas réimporter ne
 * sert à rien. Les deux sont donc éprouvés ensemble, par aller-retour.
 *
 * Une place de joueur vide est écrite comme telle plutôt qu'omise : sans quoi le
 * troisième joueur récupérerait la licence du second à la relecture — le piège
 * déjà rencontré à l'import.
 */
import type { Player, Team } from '../types';
import { libelleClubs } from './clubs';

/** Échappe une valeur pour un CSV à séparateur point-virgule (tableur FR). */
function cellule(valeur: string | number | undefined | null): string {
  const s = valeur == null ? '' : String(valeur);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const ENTETE = ['N°', 'Joueurs', 'Licences', 'Club', 'Forfait', 'Réglé'];

/** Les joueurs et leurs licences, appariés position par position. */
const colonneJoueurs = (players: Player[]): string => players.map((p) => p.name).join(' / ');
const colonneLicences = (players: Player[]): string =>
  players.map((p) => p.licence ?? '').join(' / ');

export function csvInscrits(teams: Team[]): string {
  const lignes: (string | number | null)[][] = [ENTETE];
  for (const t of [...teams].sort((a, b) => a.number - b.number)) {
    lignes.push([
      t.number,
      colonneJoueurs(t.players),
      colonneLicences(t.players),
      libelleClubs(t.players, t.club),
      t.forfait ? 'oui' : '',
      t.paid ? 'oui' : '',
    ]);
  }
  return lignes.map((l) => l.map(cellule).join(';')).join('\r\n');
}
