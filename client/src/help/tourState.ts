/** Petit magasin d'état pour la visite guidée active (sans dépendance). */

export interface TourStep {
  /** Sélecteur CSS de l'élément à mettre en lumière ; null = carte centrée. */
  target: string | null;
  title: string;
  text: string;
}

export interface ActiveTour {
  steps: TourStep[];
  onDone?: () => void;
}

let active: ActiveTour | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function startTour(steps: TourStep[], onDone?: () => void): void {
  active = { steps, onDone };
  emit();
}

export function stopTour(): void {
  const done = active?.onDone;
  active = null;
  emit();
  done?.();
}

export function getActiveTour(): ActiveTour | null {
  return active;
}

export function subscribeTour(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
