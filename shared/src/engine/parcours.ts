/**
 * Parcours guidés : l'assistant fait *faire*, il ne raconte plus.
 *
 * La visite guidée d'origine déroulait des cartes descriptives, avec un bouton
 * « Suivant » : elle présentait l'interface. Ce module la remplace par un
 * modèle où une étape peut attendre un **geste** (cliquer la cible) ou un
 * **fait** (les poules existent, les trois scores sont saisis) avant de laisser
 * passer à la suivante. C'est ce qui distingue un guide d'un monologue.
 *
 * Trois conséquences, qui sont autant de pièges de l'ancien modèle :
 *
 * - une cible peut **ne pas exister encore** (les poules n'apparaissent
 *   qu'après le tirage) : on l'attend, au lieu de sauter l'étape ;
 * - l'utilisateur peut **avoir déjà fait** ce qu'on allait lui demander : on
 *   reprend au premier geste qui reste à faire, sans lui répéter l'évidence ;
 * - il peut **partir ailleurs** : au bout d'un moment on le dit et on propose
 *   de reprendre ou de quitter, plutôt que de laisser un surlignage fantôme.
 *
 * Ce fichier ne connaît ni le DOM ni React : il décide, on l'observe.
 */
import type { Concours, Match, Poule, Team } from '../types';

/** Ce sur quoi un jalon se prononce : le concours au moment présent. */
export interface EtatParcours {
  concours: Concours | null;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

/**
 * Fait observable qui clôt une étape. Vrai = c'est fait, on peut passer à la
 * suite. Un jalon ne regarde que les données : il ne dépend ni de l'écran
 * affiché, ni de la façon dont l'utilisateur y est arrivé.
 */
export type Jalon = (etat: EtatParcours) => boolean;

/** Ce qui fait avancer une étape. */
export type Declencheur =
  /** Rien à faire : on lit, puis on passe. C'est l'ancienne visite guidée. */
  | { type: 'lecture' }
  /** Cliquer la cible. Pour désigner un onglet, un bouton d'ouverture. */
  | { type: 'clic' }
  /** Un fait à obtenir. Le geste exact est laissé à l'utilisateur. */
  | { type: 'jalon'; atteint: Jalon };

export interface EtapeParcours {
  /** Sélecteur de l'élément à mettre en lumière ; `null` = carte centrée. */
  cible: string | null;
  titre: string;
  texte: string;
  /**
   * Écran à ouvrir avant de chercher la cible. `:id` y est remplacé par le
   * concours du parcours. Absent = on reste où l'on est.
   */
  route?: string;
  declencheur: Declencheur;
}

export interface Parcours {
  id: string;
  titre: string;
  /** Le parcours n'a de sens que dans un concours ouvert. */
  besoinConcours?: boolean;
  /**
   * Écran d'accueil du parcours (`:id` = concours courant). C'est là qu'on
   * ramène l'utilisateur quand il s'est égaré : sans lui, « reprendre » remet
   * l'étape au bon rang mais laisse la cible hors de vue, et le guide reste
   * bloqué sur le même écran d'excuses.
   */
  retour: string;
  etapes: EtapeParcours[];
}

/** Où en est l'étape courante vis-à-vis de sa cible. */
export type PhaseEtape =
  /** La cible est là : on montre. */
  | { phase: 'guide' }
  /** Pas encore affichée — on patiente, c'est normal juste après une action. */
  | { phase: 'attente' }
  /** Ça traîne : l'utilisateur est probablement parti ailleurs. */
  | { phase: 'egare' };

/** Au-delà de ce délai sans cible, on cesse de faire semblant. */
export const SEUIL_EGARE_MS = 6000;

/**
 * Une étape sans jalon n'est jamais « déjà faite » : la lecture et le clic sont
 * des gestes, pas des états. Seul un jalon peut être satisfait d'avance.
 */
export function etapeFaite(etape: EtapeParcours, etat: EtatParcours): boolean {
  return etape.declencheur.type === 'jalon' ? etape.declencheur.atteint(etat) : false;
}

/**
 * Première étape qui reste à faire : juste après le **dernier fait accompli**.
 *
 * On ne s'arrête pas au premier geste non fait, parce qu'un parcours commence
 * souvent par une navigation (« ouvrez l'onglet Équipes ») qui, elle, n'est
 * jamais « déjà faite ». Reprendre là ferait redemander l'évidence à quelqu'un
 * qui a déjà inscrit ses équipes. On repère donc le dernier jalon satisfait et
 * on enchaîne après lui : ce qui compte, c'est où en est le concours.
 *
 * Renvoie `etapes.length` quand tout est acquis — le parcours n'a plus rien à
 * apprendre à cet utilisateur.
 */
export function premiereEtapeUtile(parcours: Parcours, etat: EtatParcours): number {
  let dernierFait = -1;
  for (let i = 0; i < parcours.etapes.length; i++) {
    if (etapeFaite(parcours.etapes[i]!, etat)) dernierFait = i;
  }
  return dernierFait + 1;
}

/**
 * Étape qui suit celle d'indice `index`, en sautant ce qui est déjà acquis —
 * l'utilisateur peut très bien avoir fait deux choses d'un coup. `null` quand
 * le parcours est terminé.
 */
export function etapeApres(parcours: Parcours, index: number, etat: EtatParcours): number | null {
  let i = index + 1;
  while (i < parcours.etapes.length && etapeFaite(parcours.etapes[i]!, etat)) i++;
  return i < parcours.etapes.length ? i : null;
}

/**
 * Phase de l'étape, selon que la cible est affichée et depuis combien de temps
 * on l'attend. Une étape sans cible est toujours en `guide` : il n'y a rien à
 * attendre.
 */
export function phaseEtape(opts: {
  aUneCible: boolean;
  ciblePresente: boolean;
  attenteMs: number;
  seuilMs?: number;
}): PhaseEtape {
  if (!opts.aUneCible || opts.ciblePresente) return { phase: 'guide' };
  return opts.attenteMs >= (opts.seuilMs ?? SEUIL_EGARE_MS)
    ? { phase: 'egare' }
    : { phase: 'attente' };
}

/**
 * Le parcours peut-il démarrer ici ? Un parcours de concours a besoin d'un
 * concours ; sans lui, l'assistant doit le dire au lieu de surligner le vide.
 */
export function parcoursApplicable(parcours: Parcours, etat: EtatParcours): boolean {
  return !parcours.besoinConcours || etat.concours !== null;
}

/** Sélecteurs de cibles employés par un parcours, sans doublon. */
export function ciblesParcours(parcours: Parcours): string[] {
  const vues = new Set<string>();
  for (const e of parcours.etapes) {
    if (e.cible) vues.add(e.cible);
  }
  return [...vues];
}
