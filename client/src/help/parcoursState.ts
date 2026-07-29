import type { Parcours } from '@shared';

/**
 * Magasin d'état du parcours guidé actif. Même forme que l'ancien `tourState`,
 * qu'il remplace : l'assistant, l'écran de bienvenue et la pop-up des
 * nouveautés démarrent tous un parcours par ici.
 *
 * L'étape courante n'est **pas** stockée ici : elle se déduit des données du
 * concours (voir `premiereEtapeUtile`), et c'est l'hôte qui la suit.
 */

export interface ParcoursActif {
  parcours: Parcours;
  /** Concours au démarrage, quand il ne se lit pas dans l'URL. */
  concoursId: string | null;
}

let active: ParcoursActif | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function demarrerParcours(parcours: Parcours, concoursId: string | null = null): void {
  active = { parcours, concoursId };
  emit();
}

export function arreterParcours(): void {
  active = null;
  emit();
}

export function getParcoursActif(): ParcoursActif | null {
  return active;
}

export function subscribeParcours(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
