/**
 * Retirage à chaque tour (manuel « Gestion Concours » §3.D.1.A).
 *
 * Le logiciel fédéral ne fige pas le tableau au tirage : « le numéro de l'équipe
 * s'inscrit dans une des cases vides du tour suivant et cela de façon tout à
 * fait aléatoire […] à chaque tour, il vous sera proposé le choix du tirage
 * lorsque la première équipe arrive à ce tour ». Aucun chemin n'existe donc à
 * l'avance : un vainqueur peut retomber sur n'importe qui.
 *
 * Notre tableau, lui, est un arbre : le vainqueur de la partie `(r, p)` monte
 * en `(r+1, p>>1)`. C'est le modèle de la plupart des tableaux sportifs, et il a
 * un mérite — le tableau affiché a un sens, les équipes savent qui elles peuvent
 * rencontrer. Mais ce n'est pas la référence, et sur un concours officiel c'est
 * la référence qui compte. Les deux coexistent donc, au choix de l'organisateur.
 *
 * La place ne mémorise pas l'équipe mais **la partie d'où elle sort**
 * (`vainqueurDe`), exactement comme les places de repêchage et les qualifiés de
 * poule : corriger un score en amont met le tableau à jour tout seul, sans quoi
 * un retirage figerait ce que l'arbre savait rattraper.
 *
 * Ne s'applique qu'au tableau **principal**. La consolante et la
 * complémentaire gardent l'arbre : leurs places sont déjà réservées à des
 * perdants désignés (§3.D.4, §3.D.12, §3.D.13), et deux mécanismes sur les mêmes
 * cases se contrediraient.
 */
import type { Match, MatchStage } from '../types';
import type { EngineCtx } from './ctx';
import { shuffle } from './ctx';
import { winnerOf } from './match';

/**
 * Marque les tours au-delà du premier comme attribués par tirage.
 *
 * Posé sur les parties elles-mêmes, à la création du tableau : la donnée porte
 * son mode. Le premier tour n'est pas concerné — il est tiré normalement, et
 * c'est de là que partent les vainqueurs.
 */
export function marquerRetirage(matches: Match[], stage: MatchStage): Match[] {
  return matches.map((m) =>
    m.stage === stage && m.round > 0 ? { ...m, retirage: true } : m,
  );
}

/** Un vainqueur qui attend une place au tour suivant. */
export interface VainqueurEnAttente {
  /** Partie dont il sort. */
  matchId: string;
  /** Tour de cette partie. */
  round: number;
  /** Équipe, telle qu'elle est connue à cet instant. */
  teamId: string;
}

/** La place `A`/`B` d'une partie porte-t-elle déjà une référence ou une équipe ? */
const occupee = (m: Match, cote: 'A' | 'B'): boolean =>
  cote === 'A'
    ? Boolean(m.vainqueurDeA ?? m.qualifFromA ?? m.loserFromA ?? m.byeA ?? m.teamAId)
    : Boolean(m.vainqueurDeB ?? m.qualifFromB ?? m.loserFromB ?? m.byeB ?? m.teamBId);

/**
 * Vainqueurs connus qui n'ont pas encore de place au tour suivant.
 *
 * Un exempt compte comme un vainqueur : son équipe monte, elle a « gagné » son
 * tour. La finale n'a pas de tour suivant, donc son vainqueur n'attend rien.
 */
export function vainqueursManquants(
  matches: Match[],
  stage: MatchStage,
): VainqueurEnAttente[] {
  const ms = matches.filter((m) => m.stage === stage);
  if (ms.length === 0) return [];
  const maxRound = Math.max(...ms.map((m) => m.round));
  const dejaPlaces = new Set(
    ms.flatMap((m) => [m.vainqueurDeA, m.vainqueurDeB]).filter((r): r is string => Boolean(r)),
  );

  const out: VainqueurEnAttente[] = [];
  for (const m of ms) {
    if (m.round >= maxRound) continue; // la finale ne monte nulle part
    if (!m.done) continue;
    if (dejaPlaces.has(m.id)) continue;
    const teamId = winnerOf(m);
    if (!teamId) continue;
    out.push({ matchId: m.id, round: m.round, teamId });
  }
  return out.sort((a, b) => a.round - b.round);
}

/**
 * Inscrit un vainqueur dans une case libre du tour suivant, au hasard — « de
 * façon tout à fait aléatoire », dit le manuel, et on ne lui ajoute pas de
 * préférence qu'il n'a pas.
 *
 * Sans case libre, la liste est rendue inchangée : mieux vaut un tour incomplet
 * qu'une équipe écrasée.
 */
export function placerVainqueur(
  matches: Match[],
  stage: MatchStage,
  vainqueur: VainqueurEnAttente,
  ctx: EngineCtx,
): Match[] {
  const dejaPlace = matches.some(
    (m) => m.vainqueurDeA === vainqueur.matchId || m.vainqueurDeB === vainqueur.matchId,
  );
  if (dejaPlace) return matches;

  const cible = matches.filter((m) => m.stage === stage && m.round === vainqueur.round + 1);
  const libres: { id: string; cote: 'A' | 'B' }[] = [];
  for (const m of cible) {
    if (!occupee(m, 'A')) libres.push({ id: m.id, cote: 'A' });
    if (!occupee(m, 'B')) libres.push({ id: m.id, cote: 'B' });
  }
  if (libres.length === 0) return matches;

  const choisie = shuffle(libres, ctx.rng)[0]!;
  return matches.map((m) =>
    m.id === choisie.id
      ? {
          ...m,
          ...(choisie.cote === 'A'
            ? { vainqueurDeA: vainqueur.matchId }
            : { vainqueurDeB: vainqueur.matchId }),
        }
      : m,
  );
}
