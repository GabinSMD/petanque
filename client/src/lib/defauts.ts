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
import {
  defautsDuProfil,
  type DefautsConcours,
  type NiveauInterface,
  type TeamFormat,
} from '@shared';
import { FORMATS } from './labels';

const CLE = 'petanque.defauts';

function estFormatValide(v: unknown): v is TeamFormat {
  return typeof v === 'string' && (FORMATS as string[]).includes(v);
}

const auditeurs = new Set<() => void>();

function prevenir(): void {
  for (const fn of auditeurs) fn();
}

/**
 * Ne garde du contenu brut que les champs reconnus et correctement typés.
 * `null`, `[]`, `42` ou `{}` sont du JSON valide qui ne recouvre pourtant
 * aucun champ ; les traiter comme « rien d'utile » évite que `aDesDefauts` et
 * `getDefauts` se contredisent sur un même contenu. Un champ mal typé — par
 * exemple `nbTerrains` en chaîne — est écarté plutôt que propagé : mieux vaut
 * la valeur du profil qu'une valeur qui ment sur son type dans un champ
 * numérique.
 */
function enregistrementUtile(brut: string | null): Partial<DefautsConcours> | null {
  if (!brut) return null;
  let v: unknown;
  try {
    v = JSON.parse(brut);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const utile: Partial<DefautsConcours> = {};
  if (typeof o.nbTerrains === 'number') utile.nbTerrains = o.nbTerrains;
  if (typeof o.scoreMax === 'number') utile.scoreMax = o.scoreMax;
  if (estFormatValide(o.format)) utile.format = o.format;
  if (typeof o.consolante === 'boolean') utile.consolante = o.consolante;
  if (typeof o.miseParEquipe === 'number') utile.miseParEquipe = o.miseParEquipe;
  // Un objet dont aucun champ ne survit à la validation n'a rien de plus à
  // offrir que le profil : `{}` compte comme « pas d'enregistrement ».
  return Object.keys(utile).length > 0 ? utile : null;
}

/**
 * Les deux réponses que le stockage porte, pour une seule lecture. `getDefauts`
 * et `aDesDefauts` étaient deux questions sur le même enregistrement : les
 * poser l'une après l'autre — ce que faisait `useDefauts` à chaque rendu — le
 * relisait et le reparsait deux fois.
 */
function lireDefauts(niveau: NiveauInterface): {
  defauts: DefautsConcours;
  personnalises: boolean;
} {
  const base = defautsDuProfil(niveau);
  let utile: Partial<DefautsConcours> | null;
  try {
    utile = enregistrementUtile(localStorage.getItem(CLE));
  } catch {
    // Enregistrement illisible : le profil vaut mieux qu'un écran cassé.
    return { defauts: base, personnalises: false };
  }
  return { defauts: utile ? { ...base, ...utile } : base, personnalises: utile !== null };
}

/**
 * L'utilisateur a-t-il enregistré des valeurs à lui ?
 *
 * N'a plus aucun appelant depuis que `useDefauts` passe par `lireDefauts` :
 * gardée exportée quand même, pour ne pas entamer le contrat de ce module.
 */
export function aDesDefauts(): boolean {
  try {
    return enregistrementUtile(localStorage.getItem(CLE)) !== null;
  } catch {
    return false;
  }
}

export function getDefauts(niveau: NiveauInterface): DefautsConcours {
  return lireDefauts(niveau).defauts;
}

export function setDefauts(d: DefautsConcours): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(d));
  } catch {
    /* Stockage indisponible : les valeurs sont perdues dans l'instant, pas
       seulement au prochain démarrage — `prevenir()` fait relire le stockage,
       où il n'y a rien, et les écrans retombent sur le profil. Même parti pris
       que `setPreferenceNiveau` : pas de repli en mémoire, qui serait une
       seconde source de vérité. */
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

  // Une seule lecture pour les deux réponses : voir `lireDefauts`.
  const { defauts, personnalises } = lireDefauts(niveau);

  return {
    defauts,
    personnalises,
    enregistrer: setDefauts,
    oublier: oublierDefauts,
  };
}
