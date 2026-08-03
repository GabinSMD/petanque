/**
 * Bornes du nombre de parties, par formule (manuel « Gestion Concours » §3.D.14,
 * « Gestion des Graphiques 15 – 16 – 17 (Marathon) »).
 *
 * Le panneau « Type Concours » ne nomme pas ses trois formules en rondes sans
 * raison : **chacune porte ses bornes dans son intitulé**.
 *
 * | Intitulé fédéral | Le manuel en dit (§3.D.14) | Chez nous |
 * |---|---|---|
 * | (15) 3 à 7 Parties GG | « ne fait s'affronter que les équipes qui ont gagné le même nombre de parties **prioritairement** […] utilisé pour les concours en SWISS System » | `suisse` |
 * | (16) 3 à 10 Parties | « fait s'affronter les équipes par **rotation circulaire**. Utilisé pour les Marathons » | `championnat` tronqué |
 * | (17) 3 à 5 Parties GG Strict | « équipes gagnantes **strictement** […] d'où des **exempts** à certain tour » | `suisse` + `ggStrict` |
 *
 * La correspondance n'est pas devinée : c'est le texte du manuel qui nomme le
 * SWISS System pour (15) et la rotation circulaire pour (16) — la méthode du
 * cercle, celle de notre `buildChampionnat`.
 *
 * ## Pourquoi les bornes diffèrent
 *
 * Elles ne sont pas décoratives. Le mode strict n'apparie que des équipes à
 * égalité **stricte** de victoires : plus il y a de rondes, plus les groupes
 * d'égalité se fragmentent, et au-delà de cinq parties il n'y a plus
 * d'appariement possible sans déroger — le mur que le lot #79 documente. Le
 * manuel encode cette limite dans le nom de la formule ; nous la laissions
 * découvrir à l'organisateur en pleine journée, avec un champ ouvert de 1 à 12.
 *
 * ## Ce qui n'est pas borné, et pourquoi
 *
 * La **mêlée** est à nous — inscriptions individuelles, équipes tirées à chaque
 * ronde — et ne figure dans aucune des trois formules fédérales. Aucune borne à
 * en tirer, donc aucune inventée. Le **tir de précision** compte des séries et
 * non des parties.
 */
import type { ConcoursMode } from '../types';

export interface BornesParties {
  min: number;
  max: number;
}

/** Formule identifiée par son mode et, pour le suisse, sa rigueur d'appariement. */
export interface FormuleRondes {
  mode: ConcoursMode;
  /** Gagnant contre gagnant **strict** (§3.D.14.C) : appariement à égalité exacte. */
  ggStrict?: boolean;
}

/**
 * Bornes du nombre de parties, ou `undefined` quand la formule n'en a pas dans le
 * manuel.
 */
export function bornesParties(formule: FormuleRondes): BornesParties | undefined {
  if (formule.mode === 'suisse') {
    return formule.ggStrict ? { min: 3, max: 5 } : { min: 3, max: 7 };
  }
  if (formule.mode === 'championnat') return { min: 3, max: 10 };
  return undefined;
}

/**
 * Ce nombre de parties tient-il dans les bornes de la formule ?
 *
 * Une formule non bornée accepte tout : ne rien borner n'est pas tout refuser, et
 * une mêlée en douze rondes reste possible puisque le manuel n'en dit rien.
 */
export function partiesDansLesBornes(formule: FormuleRondes, parties: number): boolean {
  if (!Number.isInteger(parties)) return false;
  const bornes = bornesParties(formule);
  if (!bornes) return true;
  return parties >= bornes.min && parties <= bornes.max;
}
