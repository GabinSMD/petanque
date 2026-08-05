/**
 * Valeurs par défaut des nouveaux concours.
 *
 * Rien ne retenait jusqu'ici que ce boulodrome a huit terrains, qu'on y joue en
 * doublette et qu'il n'y a pas de mise : l'organisateur les retapait à chaque
 * concours. Ce module les garde sur l'appareil, comme le niveau d'interface.
 *
 * Le profil fournit le point de départ ; ce qui est enregistré ici le recouvre,
 * champ par champ. Une valeur absente de l'enregistrement retombe donc sur le
 * profil — utile quand une version future ajoute un champ.
 */
import { useEffect, useState } from 'react';
import { defautsDuProfil, type DefautsConcours, type NiveauInterface } from '@shared';

const CLE = 'petanque.defauts';

const auditeurs = new Set<() => void>();

function prevenir(): void {
  for (const fn of auditeurs) fn();
}

/** L'utilisateur a-t-il enregistré des valeurs à lui ? */
export function aDesDefauts(): boolean {
  try {
    return localStorage.getItem(CLE) !== null;
  } catch {
    return false;
  }
}

export function getDefauts(niveau: NiveauInterface): DefautsConcours {
  const base = defautsDuProfil(niveau);
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return base;
    const enregistre = JSON.parse(brut) as Partial<DefautsConcours>;
    return { ...base, ...enregistre };
  } catch {
    // Enregistrement illisible : le profil vaut mieux qu'un écran cassé.
    return base;
  }
}

export function setDefauts(d: DefautsConcours): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(d));
  } catch {
    /* stockage indisponible : les valeurs vaudront pour cette session */
  }
  prevenir();
}

/** Revenir aux valeurs du profil. */
export function oublierDefauts(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
  prevenir();
}

export function useDefauts(niveau: NiveauInterface): {
  defauts: DefautsConcours;
  personnalises: boolean;
  enregistrer: (d: DefautsConcours) => void;
  oublier: () => void;
} {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const relire = (): void => setVersion((v) => v + 1);
    auditeurs.add(relire);
    window.addEventListener('storage', relire);
    return () => {
      auditeurs.delete(relire);
      window.removeEventListener('storage', relire);
    };
  }, []);

  // `version` force la relecture ; les valeurs viennent du stockage, pas d'un
  // état React, pour rester cohérentes entre deux composants montés.
  void version;

  return {
    defauts: getDefauts(niveau),
    personnalises: aDesDefauts(),
    enregistrer: setDefauts,
    oublier: oublierDefauts,
  };
}
