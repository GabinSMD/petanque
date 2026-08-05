/**
 * Niveau d'interface : ce que l'application montre, jamais ce qu'elle fait.
 * Le raisonnement est dans `shared/engine/profil.ts` ; ce module n'en est que
 * le stockage et la glu React.
 *
 * Trois états, et c'est volontaire : tant que l'utilisateur n'a pas choisi, on
 * décide pour lui d'après ce qu'il a déjà (voir `besoinNiveau`), pour ne jamais
 * lui cacher une fonction dont il se sert.
 *
 * Ce module remplace `modeFederal.ts`, dont il migre la clé au premier accès.
 */
import { useEffect, useState } from 'react';
import { estNiveauInterface, niveauDepuisAncienneCle, type NiveauInterface } from '@shared';

const CLE = 'petanque.niveauInterface';
const CLE_ANCIENNE = 'petanque.modeFederal';

const auditeurs = new Set<() => void>();

function prevenir(): void {
  for (const fn of auditeurs) fn();
}

/**
 * Reprend le choix fait sous l'ancien booléen, une fois. Sans cela, un
 * utilisateur qui avait demandé le mode fédéral le verrait disparaître à la
 * mise à jour.
 */
function migrer(): void {
  try {
    if (localStorage.getItem(CLE) !== null) return;
    const traduit = niveauDepuisAncienneCle(localStorage.getItem(CLE_ANCIENNE));
    if (traduit) localStorage.setItem(CLE, traduit);
    localStorage.removeItem(CLE_ANCIENNE);
  } catch {
    /* stockage indisponible : la migration se refera au prochain démarrage */
  }
}

/** Choix explicite de l'utilisateur, ou `null` s'il n'a jamais choisi. */
export function preferenceNiveau(): NiveauInterface | null {
  try {
    migrer();
    const brut = localStorage.getItem(CLE);
    // Une valeur inconnue — clé bricolée, version future rétrogradée — vaut
    // « pas de choix » : mieux vaut l'heuristique qu'un niveau inintelligible.
    return estNiveauInterface(brut) ? brut : null;
  } catch {
    return null;
  }
}

export function setPreferenceNiveau(niveau: NiveauInterface): void {
  try {
    localStorage.setItem(CLE, niveau);
  } catch {
    /* stockage indisponible : le réglage vaudra pour cette session seulement */
  }
  prevenir();
}

/** Revenir au choix automatique. */
export function oublierPreferenceNiveau(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
  prevenir();
}

/**
 * Le niveau effectif. `besoin` est ce que le contenu du club suggère ; la
 * préférence explicite le remplace quand elle existe.
 */
export function useNiveauInterface(besoin: NiveauInterface): {
  niveau: NiveauInterface;
  preference: NiveauInterface | null;
  choisir: (niveau: NiveauInterface) => void;
  oublier: () => void;
} {
  const [preference, setPreference] = useState<NiveauInterface | null>(preferenceNiveau);

  useEffect(() => {
    const relire = (): void => setPreference(preferenceNiveau());
    auditeurs.add(relire);
    // Un autre onglet a pu changer le réglage.
    window.addEventListener('storage', relire);
    return () => {
      auditeurs.delete(relire);
      window.removeEventListener('storage', relire);
    };
  }, []);

  return {
    niveau: preference ?? besoin,
    preference,
    choisir: setPreferenceNiveau,
    oublier: oublierPreferenceNiveau,
  };
}
