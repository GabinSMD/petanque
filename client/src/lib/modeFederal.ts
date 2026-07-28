/**
 * Mode fédéral : ce que l'application montre, jamais ce qu'elle fait.
 *
 * Un petit club qui organise des concours amicaux n'a rien à faire du fichier
 * des licenciés, du championnat des clubs ni des documents remis au comité. Ce
 * réglage les masque — sans jamais changer le comportement du logiciel : un
 * concours déjà déclaré officiel continue de contrôler ses licences, et ses
 * écrans fédéraux restent visibles sur lui.
 *
 * Trois états, et c'est volontaire : tant que l'utilisateur n'a pas choisi, on
 * décide pour lui d'après ce qu'il a déjà (voir `besoinModeFederal`), pour ne
 * jamais lui cacher une fonction dont il se sert.
 */
import { useEffect, useState } from 'react';

const CLE = 'petanque.modeFederal';

type Preference = boolean | null;

const auditeurs = new Set<() => void>();

function prevenir(): void {
  for (const fn of auditeurs) fn();
}

/** Choix explicite de l'utilisateur, ou `null` s'il n'a jamais choisi. */
export function preferenceModeFederal(): Preference {
  try {
    const brut = localStorage.getItem(CLE);
    return brut === null ? null : brut === '1';
  } catch {
    return null;
  }
}

export function setPreferenceModeFederal(actif: boolean): void {
  try {
    localStorage.setItem(CLE, actif ? '1' : '0');
  } catch {
    /* stockage indisponible : le réglage vaudra pour cette session seulement */
  }
  prevenir();
}

/** Revenir au choix automatique. */
export function oublierPreferenceModeFederal(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien à faire */
  }
  prevenir();
}

/**
 * Le mode fédéral est-il actif ? `besoin` est ce que le contenu du club
 * suggère ; la préférence explicite le remplace quand elle existe.
 */
export function useModeFederal(besoin: boolean): {
  actif: boolean;
  preference: Preference;
  choisir: (actif: boolean) => void;
  oublier: () => void;
} {
  const [preference, setPreference] = useState<Preference>(preferenceModeFederal);

  useEffect(() => {
    const relire = (): void => setPreference(preferenceModeFederal());
    auditeurs.add(relire);
    // Un autre onglet a pu changer le réglage.
    window.addEventListener('storage', relire);
    return () => {
      auditeurs.delete(relire);
      window.removeEventListener('storage', relire);
    };
  }, []);

  return {
    actif: preference ?? besoin,
    preference,
    choisir: setPreferenceModeFederal,
    oublier: oublierPreferenceModeFederal,
  };
}
