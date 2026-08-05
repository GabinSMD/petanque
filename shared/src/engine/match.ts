import type { Match } from '../types';

/**
 * Vainqueur d'une partie terminée (null sinon).
 *
 * Le score prime quand il existe : il est plus riche qu'un simple vainqueur,
 * et une correction passe toujours par lui. À défaut, on lit le vainqueur
 * désigné à la main — les concours « ouverts à tous » se jouent souvent sans
 * noter les points.
 */
export function winnerOf(m: Match | undefined | null): string | null {
  if (!m || !m.done) return null;
  if (m.byeA) return m.teamBId;
  if (m.byeB) return m.teamAId;
  if (m.scoreA === null || m.scoreB === null) {
    if (m.vainqueur) return m.vainqueur === 'A' ? m.teamAId : m.teamBId;
    return null;
  }
  return m.scoreA > m.scoreB ? m.teamAId : m.teamBId;
}

/** Perdant d'une partie terminée (null si exempt ou non jouée). */
export function loserOf(m: Match | undefined | null): string | null {
  if (!m || !m.done) return null;
  if (m.byeA || m.byeB) return null;
  if (m.scoreA === null || m.scoreB === null) {
    if (m.vainqueur) return m.vainqueur === 'A' ? m.teamBId : m.teamAId;
    return null;
  }
  return m.scoreA > m.scoreB ? m.teamBId : m.teamAId;
}

/** Une partie exemptée se termine d'elle-même dès que l'équipe est connue. */
export function isByeMatch(m: Match): boolean {
  return Boolean(m.byeA || m.byeB);
}

/**
 * Écart de points de la partie, vu d'un camp — « Différence de points de la
 * partie indiquée à coté de l'équipe » (manuel §3.D.14 ; l'orthographe sans
 * accent est la sienne).
 *
 * Les cases du graphique fédéral portent le dossard puis cet écart entre
 * parenthèses : `15 (7)` a gagné de 7, `16 (-7)` a perdu de 7. Sur la planche,
 * les huit colonnes sont opposées deux à deux, ce qui confirme qu'il s'agit bien
 * de l'écart de *cette* partie et non d'un cumul.
 *
 * **Zéro quand aucun score n'est connu**, comme le manuel, qui écrit `(0)` sur
 * les tours à venir plutôt qu'un tiret. Zéro aussi sur un vainqueur désigné sans
 * score : `rondeStandings` n'y crédite aucun goal-average — « un 13-0 fictif
 * fausserait le départage de tout le monde » — et l'affichage doit dire la même
 * chose que le classement.
 *
 * L'écart d'office d'un **exempt** (13-7) est en revanche rendu tel quel, parce
 * qu'il compte, lui, au goal-average. L'escamoter romprait l'invariant qui fait
 * tout l'intérêt du chiffre : la somme des écarts d'une équipe fait le `+/-` de
 * son classement.
 */
export function ecartPartie(m: Match, camp: 'A' | 'B'): number {
  if (m.scoreA === null || m.scoreB === null) return 0;
  return camp === 'A' ? m.scoreA - m.scoreB : m.scoreB - m.scoreA;
}

/**
 * « Inverser Résultat » — le troisième outil de rectification du manuel, nommé
 * sur la planche p.97 à côté de `Modifier Score` et `Gommer`, et confirmé par le
 * texte p.101 (« Pour Changer le Score / Inverser le Résultat / Voir la
 * Composition de l'équipe : Clic Droit sur l'équipe ou match »).
 *
 * L'erreur la plus courante à la table de marque est d'avoir cliqué le mauvais
 * camp. La corriger demandait de ressaisir le score à l'envers, alors que c'est
 * un échange de deux nombres déjà là.
 *
 * On inverse le **résultat**, jamais les équipes : `vainqueurDeA` et
 * `vainqueurDeB` désignent des *places* du tour suivant, et échanger
 * `teamAId`/`teamBId` y enverrait les équipes dans les mauvaises cases.
 *
 * Les mènes sont **reflétées** plutôt que jetées : échanger le camp de chacune
 * produit exactement le score miroir, donc l'historique reste vrai. C'est ce qui
 * distingue ce geste d'une ressaisie, où `menesPourScore` écarte un historique
 * devenu faux.
 *
 * Rien ne change sur une partie exempte — inverser affirmerait qu'un adversaire
 * absent a gagné — ni sur une partie sans résultat : il n'y a rien à inverser.
 */
export function inverserResultat(m: Match): Match {
  if (isByeMatch(m)) return m;
  const aUnScore = m.scoreA !== null && m.scoreB !== null;
  if (!aUnScore && !m.vainqueur) return m;
  return {
    ...m,
    ...(aUnScore ? { scoreA: m.scoreB, scoreB: m.scoreA } : {}),
    ...(m.menes ? { menes: m.menes.map((x) => ({ ...x, camp: x.camp === 'a' ? 'b' : 'a' })) } : {}),
    ...(m.vainqueur ? { vainqueur: m.vainqueur === 'A' ? ('B' as const) : ('A' as const) } : {}),
  };
}

export interface ScoreValidation {
  ok: boolean;
  error?: string;
}

/**
 * Règle pétanque : la partie se joue en `scoreMax` points (13),
 * le perdant reste strictement en dessous.
 */
export function validateScore(scoreA: number, scoreB: number, scoreMax: number): ScoreValidation {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { ok: false, error: 'Scores entiers requis' };
  }
  if (scoreA < 0 || scoreB < 0) {
    return { ok: false, error: 'Score négatif impossible' };
  }
  if (scoreA === scoreB) {
    return { ok: false, error: 'Pas de match nul en pétanque' };
  }
  const hi = Math.max(scoreA, scoreB);
  const lo = Math.min(scoreA, scoreB);
  if (hi !== scoreMax) {
    return { ok: false, error: `Le gagnant doit marquer ${scoreMax} points` };
  }
  if (lo >= scoreMax) {
    return { ok: false, error: `Le perdant doit rester sous ${scoreMax}` };
  }
  return { ok: true };
}

/** Clone superficiel utilisé avant toute modification par le moteur. */
export function cloneMatch(m: Match): Match {
  return { ...m };
}
