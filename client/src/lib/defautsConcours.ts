/**
 * Valeurs de départ des nouveaux concours, propres à l'appareil.
 *
 * Retenues à chaque création : le concours suivant repart de celles-ci. La
 * lecture et ses gardes vivent dans le moteur (`lireDefautsConcours`), testées.
 */
import { useEffect, useState } from 'react';
import { lireDefautsConcours, type DefautsConcours } from '@shared';

const CLE = 'petanque.defautsConcours';
const auditeurs = new Set<() => void>();

export function getDefautsConcours(): DefautsConcours {
  try {
    return lireDefautsConcours(localStorage.getItem(CLE));
  } catch {
    return lireDefautsConcours(null);
  }
}

export function retenirDefautsConcours(d: DefautsConcours): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(d));
  } catch {
    /* stockage indisponible : le prochain concours repartira des valeurs d'origine */
  }
  for (const fn of auditeurs) fn();
}

export function oublierDefautsConcours(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
  for (const fn of auditeurs) fn();
}

export function useDefautsConcours(): DefautsConcours {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const relire = (): void => setVersion((v) => v + 1);
    auditeurs.add(relire);
    window.addEventListener('storage', relire);
    return () => {
      auditeurs.delete(relire);
      window.removeEventListener('storage', relire);
    };
  }, []);
  return getDefautsConcours();
}
