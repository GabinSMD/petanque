/**
 * Ce que la formule d'un concours implique : joue-t-on en rondes, s'inscrit-on
 * seul, est-ce du tir de précision, une consolante a-t-elle un sens.
 *
 * Ces quatre questions vivaient dans les libellés du client, mêlées aux emojis
 * et aux accroches, et s'y posaient **sans garde** : `MODE_INFO[mode].rondes`.
 * Un mode inconnu — reçu par réplication d'un appareil portant une version plus
 * récente, ou par un import de sauvegarde — levait `Cannot read properties of
 * undefined`, et la frontière d'erreur remplaçait **tout** l'écran du concours
 * par « Cet écran n'a pas pu s'afficher ». L'organisateur perdait l'accès à ses
 * équipes et aux résultats déjà saisis, pour une formule qu'il suffisait
 * d'afficher en dégradé.
 *
 * Les règles sont donc ici, où elles se testent : le client ne porte aucun
 * harnais de test, et c'est la raison de ce déplacement. Les emojis, accroches
 * et descriptions restent là-bas — ce sont des libellés, pas des règles.
 */
import type { ConcoursMode } from '../types';

/** Les six formules du type, dans l'ordre où l'écran de création les propose. */
export const MODES_CONCOURS: readonly ConcoursMode[] = [
  'poules',
  'elimination_directe',
  'melee',
  'suisse',
  'championnat',
  'tir_precision',
];

interface TraitsMode {
  /** Inscriptions individuelles : les équipes se tirent à chaque ronde. */
  individuel?: boolean;
  /** Formule « en rondes » : pas d'élimination, un classement final. */
  rondes?: boolean;
  /** Discipline en séries de tir, sans parties. */
  tir?: boolean;
  /** Une consolante a un sens pour cette formule. */
  consolante?: boolean;
}

/**
 * Une `Map` et non un objet : interroger un `Record` avec une clé venue de la
 * base expose aux propriétés héritées d'`Object`. `MODE_INFO['constructor']`
 * n'est pas `undefined` mais une fonction, et un `mode in MODE_INFO` répond
 * « oui » pour `constructor`, `toString` ou `hasOwnProperty`. Une `Map` ne
 * connaît que ce qu'on y a mis.
 */
const TRAITS = new Map<ConcoursMode, TraitsMode>([
  ['poules', { consolante: true }],
  ['elimination_directe', { consolante: true }],
  ['melee', { individuel: true, rondes: true }],
  ['suisse', { rondes: true }],
  ['championnat', { rondes: true }],
  ['tir_precision', { individuel: true, tir: true }],
]);

/**
 * Traits d'une formule, ou rien du tout si on ne la connaît pas.
 *
 * Le repli est **faux partout**, et c'est un choix : un concours qu'on ne
 * comprend pas s'affiche comme un tableau classique par équipes, la formule la
 * plus banale. Répondre « oui, c'est du tir » enverrait l'écran sur une saisie
 * de séries qui n'a rien à voir avec ce que l'organisateur a sous les yeux.
 */
function traits(mode: ConcoursMode): TraitsMode {
  return TRAITS.get(mode) ?? {};
}

export function estModeRondes(mode: ConcoursMode): boolean {
  return traits(mode).rondes === true;
}

export function estModeIndividuel(mode: ConcoursMode): boolean {
  return traits(mode).individuel === true;
}

export function estModeTir(mode: ConcoursMode): boolean {
  return traits(mode).tir === true;
}

export function accepteConsolante(mode: ConcoursMode): boolean {
  return traits(mode).consolante === true;
}

/** La formule est-elle une de celles que cette version connaît ? */
export function estModeConnu(mode: ConcoursMode): boolean {
  return TRAITS.has(mode);
}
