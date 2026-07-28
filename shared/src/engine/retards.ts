/**
 * Heure d'annonce des parties et gestion des retards
 * (manuel « Gestion Concours » §3.D.1.B.3 et §3.D.1.D).
 *
 * Le logiciel fédéral horodate une partie dès que ses deux camps sont connus
 * — « l'heure s'affiche dès qu'une équipe est couverte, c'est pour cela qu'il
 * faut l'annoncer de suite : horaire justificatif pour les retards
 * éventuels ». L'arbitre s'en sert pour les pénalités, d'où la règle : une
 * heure d'annonce ne bouge plus jamais.
 */
import type { Match } from '../types';
import { isLiveMatch } from './terrains';

/**
 * Horodate les parties qui viennent de devenir jouables et ne l'étaient pas
 * encore. Retourne uniquement les parties modifiées.
 */
export function stampLancees(matches: Match[], now: string): Match[] {
  return matches
    .filter((m) => !m.lanceeA && isLiveMatch(m))
    .map((m) => ({ ...m, lanceeA: now }));
}

/** Minutes entières écoulées depuis l'annonce (jamais négatif). */
export function dureeMinutes(lancee: string, maintenant: string): number {
  const ms = new Date(maintenant).getTime() - new Date(lancee).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / 60000);
}

/** Parties annoncées, de la plus ancienne à la plus récente. */
export function partiesLancees(matches: Match[]): Match[] {
  return matches
    .filter((m) => m.lanceeA)
    .sort((a, b) => (a.lanceeA! < b.lanceeA! ? -1 : a.lanceeA! > b.lanceeA! ? 1 : 0));
}

/**
 * Panneau des retards : les parties signalées dont le résultat n'est toujours
 * pas saisi. Une fois le score enregistré, la partie quitte le panneau — le
 * retard a été constaté, il n'a plus à encombrer la table de marque.
 */
export function partiesEnRetard(matches: Match[]): Match[] {
  return partiesLancees(matches.filter((m) => m.retard && !m.done));
}
