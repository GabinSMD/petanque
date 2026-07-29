/**
 * Statistiques des poules (manuel « Gestion Concours » §3.D.1.G).
 *
 * « Visualise les poules qui ne sont pas terminées. […] Cette fenêtre visualise
 * les poules dont les parties de barrage ne sont pas en cours. »
 *
 * Sur trente poules, c'est ce qui permet de trouver la retardataire sans
 * parcourir tout l'écran, et de repérer les barrages qui attendent.
 *
 * Une nuance sur le manuel : il distingue les barrages « en cours » de ceux qui
 * ne le sont pas, parce que lancer une partie y est un geste de l'organisateur.
 * Ici l'annonce est horodatée **automatiquement** dès qu'une partie devient
 * jouable (§3.D.1.D) : un barrage dont les deux équipes sont connues est donc
 * toujours « lancé ». La distinction n'a pas d'équivalent dans nos données, et
 * ce qui compte à sa place, c'est **depuis combien de temps** il attend.
 *
 * Le classement met en tête celle qui attend depuis le plus longtemps, en
 * s'appuyant sur le même horodatage.
 */
import type { Match, Poule } from '../types';

export interface EtatPoule {
  poule: Poule;
  /** Parties encore à jouer dans cette poule. */
  restantes: number;
  terminee: boolean;
  /**
   * Barrage jouable : ses deux équipes sont connues et le résultat n'est pas
   * saisi. C'est la dernière partie de la poule, celle qui la retient.
   */
  barragePret: boolean;
  /**
   * Annonce la plus ancienne parmi les parties ouvertes de la poule, ou `null`
   * si aucune n'est encore partie.
   */
  depuis: string | null;
}

/**
 * Les poules non terminées, celle qui attend depuis le plus longtemps d'abord.
 * Une poule dont rien n'est annoncé passe après celles qui attendent : elle ne
 * retarde personne pour l'instant.
 */
export function statistiquesPoules(poules: Poule[], matches: Match[]): EtatPoule[] {
  const etats: EtatPoule[] = [];

  for (const poule of poules) {
    const siennes = matches.filter((m) => m.pouleId === poule.id);
    if (siennes.length === 0) continue;
    const ouvertes = siennes.filter((m) => !m.done);
    if (ouvertes.length === 0) continue;

    const barrage = siennes.find((m) => m.pouleSlot === 'BARRAGE');
    const barragePret = Boolean(barrage && !barrage.done && barrage.teamAId && barrage.teamBId);
    const annonces = ouvertes
      .map((m) => m.lanceeA)
      .filter((d): d is string => Boolean(d))
      .sort();

    etats.push({
      poule,
      restantes: ouvertes.length,
      terminee: false,
      barragePret,
      depuis: annonces[0] ?? null,
    });
  }

  return etats.sort((a, b) => {
    if (a.depuis && b.depuis) return a.depuis < b.depuis ? -1 : a.depuis > b.depuis ? 1 : 0;
    if (a.depuis) return -1;
    if (b.depuis) return 1;
    return a.poule.index - b.poule.index;
  });
}
