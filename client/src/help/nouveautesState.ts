import { recapNouveautes, type Nouveaute } from '@shared';
import { JOURNAL } from './nouveautes';

/**
 * Magasin d'état de la pop-up « Nouveautés », et mémoire de ce qui a déjà été
 * lu. Même forme que `tourState` : trois appelants (le tableau de bord à
 * l'ouverture, le pied de page, l'assistant) déclenchent la même fenêtre.
 *
 * La version vue n'est retenue qu'à la **fermeture** : fermer l'onglet sans
 * avoir lu laisse la pop-up revenir, ce qui vaut mieux que de l'escamoter.
 */

const VUE_KEY = 'petanque.nouveautesVue';

export interface VueNouveautes {
  entrees: Nouveaute[];
  /** Version à retenir en refermant. */
  aMemoriser: string | null;
  /** Tour d'horizon demandé à la main, plutôt qu'annoncé après mise à jour. */
  rappel: boolean;
}

let active: VueNouveautes | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/** Dernière version dont les nouveautés ont été lues sur cet appareil. */
export function versionVue(): string | null {
  try {
    return localStorage.getItem(VUE_KEY);
  } catch {
    return null;
  }
}

function memoriser(version: string): void {
  try {
    localStorage.setItem(VUE_KEY, version);
  } catch {
    // Stockage refusé (navigation privée) : la pop-up reviendra, sans casser.
  }
}

/**
 * À l'arrivée sur le tableau de bord : ouvre la pop-up s'il y a quelque chose à
 * annoncer, et sinon retient la version en silence.
 *
 * `premiereInstallation` évite d'enchaîner sur l'écran de bienvenue, qui fait
 * déjà le tour d'horizon.
 *
 * La détection tombe forcément du bon côté d'une mise à jour : le journal est
 * figé dans le bundle, donc l'ancien bundle ne connaît que l'ancien journal et
 * ne peut rien annoncer par anticipation. La mise à jour automatique du service
 * worker recharge la page, et c'est le nouveau bundle qui parle.
 */
export function annoncerNouveautes(premiereInstallation: boolean): void {
  const recap = recapNouveautes(JOURNAL, versionVue(), { premiereInstallation });
  if (recap.entrees.length === 0) {
    if (recap.aMemoriser) memoriser(recap.aMemoriser);
    return;
  }
  active = { ...recap, rappel: false };
  emit();
}

/** Tour d'horizon complet, à la demande (pied de page, assistant). */
export function rappelerNouveautes(): void {
  // « Rien de vu » donne justement le journal entier, remis dans l'ordre.
  const tout = recapNouveautes(JOURNAL, null, { premiereInstallation: false });
  if (tout.entrees.length === 0) return;
  active = { ...tout, rappel: true };
  emit();
}

export function fermerNouveautes(): void {
  if (active?.aMemoriser) memoriser(active.aMemoriser);
  active = null;
  emit();
}

export function getNouveautes(): VueNouveautes | null {
  return active;
}

export function subscribeNouveautes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
