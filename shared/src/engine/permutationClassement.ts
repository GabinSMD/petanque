/**
 * Permutation manuelle du classement (manuel « Gestion Concours », classeur des
 * phases finales, copie d'écran p.110).
 *
 * Le classeur fédéral affiche les classements des concours A et B, seize lignes
 * numérotées, et sous chacun un bouton **« CHANGEMENT DANS LE CLASSEMENT (concours
 * A) — (suite à une égalité) »**. La macro demande *« Quel est le classement du
 * premier joueur à intervertir ? (chiffre à gauche du Nom du joueur) »*, puis du
 * second, et répond « Changement effectué ».
 *
 * Autrement dit : la fédération admet qu'après tous les départages automatiques —
 * victoires, goal-average, points marqués, confrontation directe — il reste des
 * égalités que **l'organisateur tranche**. Notre classement, lui, se terminait sur
 * un tri par identifiant pour être déterministe, ce qui est reproductible mais
 * arbitraire.
 *
 * ## Par équipe, et non par rang
 *
 * Le classeur fédéral travaille sur un classement figé, exporté en fin de
 * compétition : y désigner « la place 5 » suffit. Chez nous le classement est
 * vivant — une ronde de plus, un score corrigé, et la place 5 n'est plus la même
 * équipe. Une permutation est donc enregistrée comme **une paire d'équipes**, et
 * l'écran se charge de traduire les rangs saisis en équipes au moment du clic.
 *
 * Elle survit ainsi à tout recalcul, et ne se met jamais à échanger deux équipes
 * que l'organisateur n'a pas désignées.
 */
import type { Match, PermutationClassement, Team } from '../types';
import { memeNiveau, rondeStandings, type Standing } from './rondes';

export type { PermutationClassement };

/**
 * Classement des rondes, permutations comprises. **C'est la porte d'entrée** :
 * cinq écrans affichent ce classement — onglet des rondes, résultats, page
 * publique, affichage TV, export — et s'ils composaient chacun le calcul et les
 * permutations à leur façon, il suffirait d'en oublier un pour que deux écrans se
 * contredisent.
 */
export function classementRondes(
  concours: { permutationsClassement?: PermutationClassement[] },
  entrants: Team[],
  matches: Match[],
): Standing[] {
  return appliquerPermutations(rondeStandings(entrants, matches), concours.permutationsClassement);
}

/**
 * Une permutation s'applique-t-elle encore ?
 *
 * Deux conditions. Les deux équipes doivent être **dans** le classement — un
 * forfait, un concours redécoupé, et la permutation ne désigne plus rien. Et
 * elles doivent être **encore à égalité** : le bouton fédéral dit « suite à une
 * égalité », donc quand l'égalité disparaît, la raison de l'interversion
 * disparaît avec elle.
 *
 * Cette seconde condition vient de la vérification dans l'application : après une
 * ronde de plus, les deux équipes interverties n'étaient plus à égalité — l'une
 * avait deux victoires, l'autre une — et la permutation les maintenait inversées.
 * Ce n'était plus un départage mais une distorsion, et rien ne l'aurait signalé.
 */
function applicable(classement: Standing[], p: PermutationClassement): boolean {
  const a = classement.find((s) => s.id === p.a);
  const b = classement.find((s) => s.id === p.b);
  if (!a || !b || a.id === b.id) return false;
  return memeNiveau(a, b);
}

/** Les permutations qui s'appliquent encore, pour que l'écran puisse le dire. */
export function permutationsActives(
  classement: Standing[],
  permutations: PermutationClassement[] | undefined,
): PermutationClassement[] {
  return (permutations ?? []).filter((p) => applicable(classement, p));
}

/**
 * Applique les permutations au classement calculé, dans l'ordre où elles ont été
 * demandées. Celles qui ne s'appliquent plus sont ignorées **une par une** :
 * s'arrêter à la première caduque ferait perdre les suivantes.
 */
export function appliquerPermutations(
  classement: Standing[],
  permutations: PermutationClassement[] | undefined,
): Standing[] {
  if (!permutations || permutations.length === 0) return [...classement];
  const resultat = [...classement];
  for (const p of permutations) {
    if (!applicable(classement, p)) continue;
    const i = resultat.findIndex((s) => s.id === p.a);
    const j = resultat.findIndex((s) => s.id === p.b);
    if (i < 0 || j < 0 || i === j) continue;
    [resultat[i], resultat[j]] = [resultat[j]!, resultat[i]!];
  }
  return resultat;
}

/**
 * Traduit deux rangs affichés en une paire d'équipes, comme le fait la macro du
 * manuel — « chiffre à gauche du Nom du joueur », donc à partir de 1.
 *
 * Rend `undefined` sur un rang hors du classement ou sur deux fois le même :
 * intervertir une place avec elle-même ne veut rien dire, et mieux vaut ne rien
 * faire que déplacer une équipe au hasard. Un rang décimal ou illisible tombe
 * dans le même cas — `classement[0.5]` n'existe pas — sans garde de plus : le
 * sabotage a montré qu'un contrôle d'entier explicite ne servait à rien ici.
 */
export function permutationDepuisRangs(
  classement: Standing[],
  rang1: number,
  rang2: number,
): PermutationClassement | undefined {
  if (rang1 === rang2) return undefined;
  const a = classement[rang1 - 1];
  const b = classement[rang2 - 1];
  if (!a || !b) return undefined;
  return { a: a.id, b: b.id };
}

const memePaire = (x: PermutationClassement, y: PermutationClassement): boolean =>
  (x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a);

/**
 * Ajoute une permutation, sans doublon — la même paire deux fois se défait, et un
 * classement qui dépend du nombre de clics n'est pas un classement.
 */
export function ajouterPermutation(
  permutations: PermutationClassement[],
  nouvelle: PermutationClassement,
): PermutationClassement[] {
  if (permutations.some((p) => memePaire(p, nouvelle))) return [...permutations];
  return [...permutations, nouvelle];
}

/**
 * Retire une permutation par son rang dans la liste. Annulable, donc.
 *
 * Un index hors liste ne retire rien, sans contrôle explicite : le filtre garde
 * déjà tout ce qui ne correspond pas. Le sabotage a montré qu'un garde de plus
 * était du code mort.
 */
export function retirerPermutation(
  permutations: PermutationClassement[],
  index: number,
): PermutationClassement[] {
  return permutations.filter((_, i) => i !== index);
}

/**
 * Cette équipe a-t-elle été déplacée à la main ? Sert à marquer la ligne : un
 * classement modifié par l'organisateur ne doit pas passer pour un classement
 * calculé.
 */
export function estPermutee(
  permutations: PermutationClassement[] | undefined,
  id: string,
): boolean {
  return (permutations ?? []).some((p) => p.a === id || p.b === id);
}
