import type { Match, Poule } from '../types';
import { applyChanges, propagate } from './bracket';
import { isByeMatch } from './match';
import { recomputePoule } from './poules';

/**
 * Une partie « jouée » au sens de la table de marque : un résultat y a été
 * saisi. Une partie d'exempt se termine d'elle-même et n'a rien à perdre.
 */
function estJouee(m: Match): boolean {
  if (!m.done || isByeMatch(m)) return false;
  return (m.scoreA !== null && m.scoreB !== null) || Boolean(m.vainqueur);
}

/**
 * Parties déjà jouées que la nouvelle version d'une partie effacerait en aval
 * (inversion, effacement, ou correction qui change le gagnant — manuel
 * §3.D.14.B, « Modifier Score / Gommer / Inverser Résultat »).
 *
 * Le calcul se fait **à blanc** : on rejoue exactement la répercussion de la
 * saisie — recalcul de la poule, puis propagation au tableau, qui lit les
 * qualifiés dans les parties de poule — sur une copie, sans rien écrire.
 * Une partie de l'aval dont un participant change est remise à zéro par cette
 * répercussion : c'est ce score-là, saisi par quelqu'un, qui serait perdu sans
 * prévenir. La table de marque doit le savoir avant de toucher.
 *
 * Les rondes (système suisse, mêlée) sont plates : rien ne s'y propage, la
 * liste est vide. Le retirage par tour tire au sort les places suivantes ;
 * seule la remise à vide d'une case déjà occupée compte ici, et `propagate` la
 * voit.
 *
 * Renvoie les parties **dans leur état actuel** (score encore visible), dans
 * l'ordre du concours : c'est ce qu'on nomme à l'écran.
 */
export function partiesEffaceesEnAval(
  toutes: Match[],
  poules: Poule[],
  apres: Match,
): Match[] {
  if (apres.stage === 'ronde') return [];
  let simule = toutes.map((m) => (m.id === apres.id ? apres : m));

  if (apres.stage === 'poule' && apres.pouleId) {
    const poule = poules.find((p) => p.id === apres.pouleId);
    if (poule) {
      const changees = recomputePoule(
        poule,
        simule.filter((m) => m.pouleId === poule.id),
      );
      simule = applyChanges(simule, changees);
    }
  }
  simule = applyChanges(simule, propagate(simule));

  const apresParId = new Map(simule.map((m) => [m.id, m]));
  return toutes.filter((avant) => {
    if (avant.id === apres.id || !estJouee(avant)) return false;
    const ensuite = apresParId.get(avant.id);
    return !ensuite || !estJouee(ensuite);
  });
}
