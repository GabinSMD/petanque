/**
 * « Evolution du Score » (manuel « Gestion Concours », copie d'écran p.60).
 *
 * L'écran « Voir Scores » et la page HTML publiée portent tous deux un champ
 * **« Evolution du Score »**, avec des boutons `+` sous chaque score. C'est
 * l'histoire de la partie, mène par mène, là où nous n'enregistrions que le
 * score final.
 *
 * ## Ce qui est attesté, et ce qui ne l'est pas
 *
 * Le texte du manuel ne mentionne cette fonction **nulle part** — vérifié sur les
 * 119 pages — et **aucune capture ne montre le champ rempli**. La seule valeur
 * lisible est celle d'une partie non commencée : `0-0/`.
 *
 * On en déduit, et c'est une déduction sur un seul exemple : une liste d'états du
 * score séparés par `/`, commençant à `0-0`, avec un `/` final. Si c'étaient des
 * gains par mène et non des états, le premier élément ne serait pas `0-0`.
 *
 * ## Ce qu'on en fait
 *
 * Pour que cette incertitude ne contamine pas les données, les mènes sont
 * **stockées en structuré** — quel camp a marqué, combien — et la chaîne du
 * manuel n'est qu'un *rendu*, produit ici. Si le format fédéral se révèle autre,
 * seule `evolutionEnTexte` change ; l'historique enregistré reste juste.
 *
 * Le modèle par gains plutôt que par états n'est pas un choix esthétique : à la
 * pétanque, une mène est remportée par **un** camp. Corriger la deuxième mène
 * d'une partie de treize n'oblige alors pas à réécrire les onze suivantes.
 */

import type { Mene } from '../types';

export type { Mene };

/**
 * Points maximaux d'une mène. Borne de bon sens et non règle du manuel : six
 * boules par équipe en triplette comme en doublette. Une tête-à-tête en compte
 * trois, mais refuser un 4 à cause de la formation punirait une saisie que rien
 * n'oblige à faire.
 */
const POINTS_MAX = 6;

/** Score après toutes les mènes. */
export function scoreDepuisMenes(menes: Mene[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const m of menes) {
    if (m.camp === 'a') a += m.points;
    else b += m.points;
  }
  return { a, b };
}

/**
 * Ajoute une mène. Rend une nouvelle liste : la correction d'un historique doit
 * rester une opération explicite, pas un effet de bord.
 */
export function ajouterMene(menes: Mene[], camp: 'a' | 'b', points: number): Mene[] {
  if (!Number.isInteger(points) || points < 1) {
    throw new Error('Une mène est remportée par un camp : elle rapporte au moins un point.');
  }
  if (points > POINTS_MAX) {
    throw new Error(`Une mène ne rapporte pas plus de ${POINTS_MAX} points.`);
  }
  return [...menes, { camp, points }];
}

/**
 * Ajoute une mène en s'arrêtant au but.
 *
 * À la pétanque, la partie s'arrête dès qu'un camp atteint le but : à 11-5, une
 * mène de six ne rapporte que deux points, les quatre autres n'ont pas lieu
 * d'être. Le plafond est donc la règle du jeu, pas une commodité — et il garantit
 * que la somme des mènes reste un score valide.
 */
export function ajouterMeneBornee(
  menes: Mene[],
  camp: 'a' | 'b',
  points: number,
  but: number,
): Mene[] {
  const score = scoreDepuisMenes(menes);
  if (score.a >= but || score.b >= but) {
    throw new Error('La partie est terminée : plus rien à ajouter.');
  }
  const acquis = camp === 'a' ? score.a : score.b;
  return ajouterMene(menes, camp, Math.min(points, but - acquis));
}

/**
 * Un score **en cours** est-il possible ?
 *
 * `validateScore` ne juge que des scores **finaux** : il exige que le gagnant ait
 * atteint le but. L'appliquer à une partie en cours interdisait toute mène — c'est
 * le défaut que la vérification dans l'application a mis au jour, après que les
 * tests du moteur l'avaient laissé passer.
 */
export function validerScoreEnCours(a: number, b: number, but: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b < 0) return false;
  if (a > but || b > but) return false;
  // Les deux au but : impossible, la partie s'arrête au premier qui l'atteint.
  return !(a >= but && b >= but);
}

/** Retire la dernière mène — le « annuler » de la saisie au fil de la partie. */
export function retirerDerniereMene(menes: Mene[]): Mene[] {
  return menes.slice(0, -1);
}

/**
 * Le champ du manuel : les états du score séparés par `/`, à partir de `0-0`,
 * avec un `/` final. Une partie non commencée s'écrit donc `0-0/`, ce que montre
 * la copie d'écran.
 */
export function evolutionEnTexte(menes: Mene[]): string {
  let a = 0;
  let b = 0;
  const etats = [`${a}-${b}`];
  for (const m of menes) {
    if (m.camp === 'a') a += m.points;
    else b += m.points;
    etats.push(`${a}-${b}`);
  }
  return `${etats.join('/')}/`;
}

/**
 * Relit une évolution publiée. Rend une liste vide sur tout ce qui n'est pas une
 * suite d'états cohérente — un score qui recule, deux camps qui marquent dans la
 * même mène, un texte illisible : on ne reconstitue pas une partie à partir d'une
 * donnée abîmée.
 */
export function menesDepuisTexte(texte: string | undefined): Mene[] {
  const brut = (texte ?? '').trim();
  if (!brut) return [];
  const etats = brut.split('/').filter((s) => s.trim().length > 0);
  if (etats.length === 0) return [];

  const lus: { a: number; b: number }[] = [];
  for (const etat of etats) {
    const m = /^(\d+)-(\d+)$/.exec(etat.trim());
    if (!m) return [];
    lus.push({ a: Number(m[1]), b: Number(m[2]) });
  }
  if (lus[0]!.a !== 0 || lus[0]!.b !== 0) return [];

  const menes: Mene[] = [];
  for (let i = 1; i < lus.length; i += 1) {
    const gainA = lus[i]!.a - lus[i - 1]!.a;
    const gainB = lus[i]!.b - lus[i - 1]!.b;
    // Exactement un camp marque, d'au moins un point.
    if (gainA < 0 || gainB < 0) return [];
    if ((gainA > 0) === (gainB > 0)) return [];
    const camp: 'a' | 'b' = gainA > 0 ? 'a' : 'b';
    const points = gainA > 0 ? gainA : gainB;
    if (points > POINTS_MAX) return [];
    menes.push({ camp, points });
  }
  return menes;
}

/**
 * L'historique dit-il le même score que celui enregistré ?
 *
 * Le score final reste la référence : c'est lui qui décide du vainqueur et qui
 * fait avancer le tableau. Un détail qui le contredit vaut moins que pas de
 * détail du tout — d'où ce contrôle avant d'enregistrer des mènes.
 */
export function validerMenes(menes: Mene[], scoreA: number, scoreB: number): boolean {
  const total = scoreDepuisMenes(menes);
  return total.a === scoreA && total.b === scoreB;
}

/**
 * Les mènes à conserver quand un score est enregistré, ou `undefined` pour les
 * écarter.
 *
 * La table de marque corrige un score à la main sans repasser par les mènes :
 * l'historique d'avant ne décrit alors plus cette partie, et le garder ferait
 * mentir la page publique. On l'écarte plutôt que de tenter de le rattraper — on
 * ne sait pas *quelle* mène était fausse.
 */
export function menesPourScore(
  menes: Mene[] | undefined,
  scoreA: number,
  scoreB: number,
): Mene[] | undefined {
  if (!menes) return undefined;
  if (!validerMenes(menes, scoreA, scoreB)) return undefined;
  return menes;
}
