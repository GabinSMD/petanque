/**
 * Thème de l'interface : clair, sombre, ou celui du système.
 *
 * Le choix est propre à l'appareil — la tablette posée au soleil sur la table
 * de marque et l'ordinateur du club-house n'ont pas les mêmes besoins. Tant
 * que personne n'a choisi, l'application reste claire : c'est le thème qui se
 * lit en plein jour, là où se jouent les concours.
 *
 * Le même calcul est fait une première fois par un court script en tête de
 * `index.html`, avant le premier affichage, pour éviter un éclair blanc au
 * chargement. Les deux doivent rester d'accord.
 */
import { useEffect, useState } from 'react';

export type Theme = 'clair' | 'sombre' | 'auto';

const CLE = 'petanque.theme';
const auditeurs = new Set<() => void>();

export function preferenceTheme(): Theme {
  try {
    const brut = localStorage.getItem(CLE);
    return brut === 'sombre' || brut === 'auto' ? brut : 'clair';
  } catch {
    return 'clair';
  }
}

function systemeSombre(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Pose le thème sur le document. Sans effet sur la vitrine, toujours claire. */
export function appliquerTheme(theme: Theme = preferenceTheme()): void {
  const sombre = theme === 'sombre' || (theme === 'auto' && systemeSombre());
  document.documentElement.dataset.theme = sombre ? 'dark' : 'light';
}

export function choisirTheme(theme: Theme): void {
  try {
    localStorage.setItem(CLE, theme);
  } catch {
    /* stockage indisponible : le choix vaudra pour cette session seulement */
  }
  appliquerTheme(theme);
  for (const fn of auditeurs) fn();
}

/** À appeler une fois au démarrage : suit aussi le système en mode « auto ». */
export function demarrerTheme(): void {
  appliquerTheme();
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => appliquerTheme());
  }
}

export function useTheme(): { theme: Theme; choisir: (t: Theme) => void } {
  const [theme, setTheme] = useState<Theme>(preferenceTheme);
  useEffect(() => {
    const fn = () => setTheme(preferenceTheme());
    auditeurs.add(fn);
    return () => {
      auditeurs.delete(fn);
    };
  }, []);
  return { theme, choisir: choisirTheme };
}
