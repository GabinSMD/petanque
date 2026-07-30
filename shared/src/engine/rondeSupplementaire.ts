/**
 * Faut-il proposer une partie de plus ? (manuel §3.D.14.A et §3.D.14.C)
 *
 * « Lors de la première saisie de la troisième partie le logiciel demande si
 * nous voulons faire une quatrième partie. »
 *
 * Le nombre de rondes est réglable chez nous depuis toujours, mais dans les
 * paramètres : il faut y penser et savoir où aller. Le manuel pose la question
 * au bon moment — celui où l'organisateur voit l'heure qu'il est, l'état des
 * terrains et la tête des joueurs.
 *
 * Une seule fois par ronde : la reposer à chaque score serait insupportable sur
 * douze terrains. Et jamais quand l'organisateur a déjà ajouté une ronde — il a
 * répondu.
 */

export interface EtatRondes {
  /** Rondes déjà tirées. */
  rondesTirees: number;
  /** Rondes prévues au paramétrage. */
  rondesPrevues: number;
  /** Ronde du score qu'on vient de saisir (0 = première). */
  rondeSaisie: number;
  /** Scores déjà saisis dans cette ronde **avant** celui-ci. */
  scoresDejaSaisis: number;
}

export function proposerRondeSupplementaire(etat: EtatRondes): boolean {
  const { rondesTirees, rondesPrevues, rondeSaisie, scoresDejaSaisis } = etat;
  if (rondesPrevues < 1 || rondeSaisie < 0 || scoresDejaSaisis < 0) return false;
  // Toutes les rondes prévues sont tirées, on saisit dans la dernière, et c'est
  // le premier score de cette ronde.
  return (
    rondesTirees === rondesPrevues &&
    rondeSaisie === rondesPrevues - 1 &&
    scoresDejaSaisis === 0
  );
}
