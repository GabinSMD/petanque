/**
 * Ce qu'un champ nombre accepte, et **pourquoi** il refuse.
 *
 * La règle de ce module tient en une phrase : *un refus porte toujours sa
 * raison*. D'où des fonctions qui rendent une phrase et non un booléen, sur le
 * modèle de `validerEquipe` (`{ ok: false; raison }`) — mais en
 * `string | undefined`, parce qu'un champ de formulaire a besoin d'un texte à
 * afficher sous lui, pas d'une union à déballer.
 *
 * ## Pourquoi ce module existe
 *
 * Les décalages de numérotation portaient un `step` de 50 et de 100, la mise par
 * joueur un `step` de 0,5. Aucun n'a de fondement dans le manuel : §3.B.1
 * demande seulement de décaler les numéros pour que deux concours du même jour
 * n'aient pas deux « équipe 1 » ni deux « terrain 1 », et la planche p.12 montre
 * une mise de `4.00 €` sans rien dire d'un pas. Ces pas étaient inventés, et ils
 * refusaient des valeurs justes : un décalage de 8, une mise de 3,20 €.
 *
 * Ils refusaient **en silence**, et c'est le vrai défaut. Les deux décalages
 * vivent dans un `<details>` replié : le navigateur a bien un motif, mais il ne
 * peut pas amener le curseur sur un élément qu'il ne peint pas. Il n'affiche
 * donc aucune bulle et écrit en console `An invalid form control with name=''
 * is not focusable`. L'organisateur cliquait « Enregistrer », et rien ne se
 * passait.
 *
 * Le cas le plus grave n'est pas celui qu'on tape. `decalageTerrain: 8` est un
 * nombre que le type `Concours`, le moteur et la base acceptent tous : arrivé
 * par une sauvegarde, une synchronisation ou une autre version, il rendait le
 * concours définitivement inenregistrable, sans que personne ait rien fait.
 *
 * ## Ce que les bornes valent
 *
 * `MAX_DECALAGE` et `MAX_MISE` ne sont pas des règles fédérales — le manuel n'en
 * donne aucune. Ce sont des garde-fous contre une faute de frappe ou le collage
 * d'un numéro de licence dans le champ. C'est précisément pourquoi elles se
 * **nomment** dans la raison : une borne arbitraire qui refuse sans se dire
 * n'est qu'une autre forme du défaut qu'on corrige.
 */

/** Borne haute d'un décalage de numérotation. Garde-fou de saisie, pas règle fédérale. */
export const MAX_DECALAGE = 9000;

/** Borne haute d'une mise par joueur, en euros. Garde-fou de saisie. */
export const MAX_MISE = 1000;

/** Nombre de décimales d'un montant en euros : l'euro s'arrête au centime. */
const DECIMALES_EURO = 2;

/**
 * `NaN` et `Infinity` sont des `number` pour TypeScript, et `Number('abc')`
 * comme une division ratée en produisent. Aucun des deux n'est une saisie.
 */
function raisonNonNombre(valeur: number): string | undefined {
  if (!Number.isFinite(valeur)) return 'Cette valeur n\'est pas un nombre.';
  return undefined;
}

/**
 * Le montant tient-il en `decimales` chiffres après la virgule ?
 *
 * La comparaison passe par une tolérance et non par une égalité, parce que la
 * montée à l'échelle n'est pas exacte en binaire : `4.35 * 100` vaut
 * `434.99999999999994`, et `8.7 * 100` vaut `869.9999999999999`. Une égalité
 * stricte refuserait ces deux mises, pourtant écrites au centime.
 *
 * Tous les montants ne sont pas concernés — `3.2 * 100` tombe pile sur `320` —
 * et c'est justement le piège : un essai sur le mauvais exemple laisse croire
 * que la tolérance est décorative.
 */
function tientEnDecimales(valeur: number, decimales: number): boolean {
  const monte = valeur * 10 ** decimales;
  return Math.abs(monte - Math.round(monte)) < 1e-9;
}

/**
 * Pourquoi ce décalage de numérotation est refusé — ou `undefined` s'il passe.
 *
 * Le zéro passe : le formulaire écrit « 0 = numérotation normale », c'est une
 * réponse et non une absence de saisie.
 */
export function raisonRefusDecalage(valeur: number): string | undefined {
  const nonNombre = raisonNonNombre(valeur);
  if (nonNombre) return nonNombre;
  if (valeur < 0) {
    return 'Un décalage ne peut pas être négatif : 0 pour la numérotation normale.';
  }
  if (!Number.isInteger(valeur)) {
    return 'Un décalage est un nombre entier : il n\'y a pas de terrain 8,5.';
  }
  if (valeur > MAX_DECALAGE) {
    return `Un décalage ne peut pas dépasser ${MAX_DECALAGE}.`;
  }
  return undefined;
}

/**
 * Pourquoi cette mise par joueur est refusée — ou `undefined` si elle passe.
 *
 * Le zéro passe : un concours gratuit est un concours. `miseEquipe` distingue
 * déjà `0` de `undefined`, et refuser ce zéro rétablirait la confusion que son
 * `!== undefined` sert à éviter.
 */
export function raisonRefusMise(valeur: number): string | undefined {
  const nonNombre = raisonNonNombre(valeur);
  if (nonNombre) return nonNombre;
  if (valeur < 0) {
    return 'Une mise ne peut pas être négative : 0 pour un concours gratuit.';
  }
  if (!tientEnDecimales(valeur, DECIMALES_EURO)) {
    return 'Une mise s\'arrête au centime : deux décimales au plus.';
  }
  if (valeur > MAX_MISE) {
    return `Une mise par joueur ne peut pas dépasser ${MAX_MISE} €.`;
  }
  return undefined;
}
