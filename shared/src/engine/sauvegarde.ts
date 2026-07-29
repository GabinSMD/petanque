/**
 * Sauvegarde d'un concours : lecture d'un fichier exporté, et réécriture des
 * identifiants pour le réimporter à côté de l'original (manuel §3.F.2).
 *
 * Deux exigences guident ce module. On refuse un fichier douteux plutôt que
 * d'importer à moitié — un import partiel laisserait un concours incohérent,
 * pire que pas d'import. Et on ne fait confiance à rien de ce qui est lu : le
 * fichier vient du disque de l'utilisateur, il peut avoir été bricolé.
 */
import type { Concours, Match, Poule, Team } from '../types';
import { validerEquipe } from './validationEquipe';

export interface Sauvegarde {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

export type LectureSauvegarde =
  | { ok: true; sauvegarde: Sauvegarde }
  | { ok: false; erreur: string };

/** Version du format écrite par l'export ; on relit celle-ci et les précédentes. */
export const VERSION_SAUVEGARDE = 1;

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Un concours minimalement exploitable : de quoi l'afficher et le jouer. */
function concoursValide(v: unknown): v is Concours {
  if (!estObjet(v)) return false;
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.name === 'string' &&
    typeof v.date === 'string' &&
    typeof v.format === 'string' &&
    typeof v.mode === 'string' &&
    typeof v.scoreMax === 'number' &&
    typeof v.status === 'string'
  );
}

function liste<T>(v: unknown, garde: (x: unknown) => boolean): T[] {
  if (!Array.isArray(v)) return [];
  return v.filter(garde) as T[];
}

export function lireSauvegarde(texte: string): LectureSauvegarde {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: 'Ce fichier n\'est pas un JSON lisible.' };
  }
  if (!estObjet(brut)) {
    return { ok: false, erreur: 'Ce fichier ne contient pas une sauvegarde.' };
  }
  if (brut.app !== 'petanque-concours') {
    return {
      ok: false,
      erreur: 'Ce fichier n\'est pas une sauvegarde de Pétanque Concours.',
    };
  }
  const version = typeof brut.version === 'number' ? brut.version : 0;
  if (version > VERSION_SAUVEGARDE) {
    return {
      ok: false,
      erreur: `Sauvegarde en version ${version}, plus récente que cette application (${VERSION_SAUVEGARDE}). Mettez l'application à jour.`,
    };
  }
  // L'erreur qui arrivera vraiment : on mélange les deux sortes de fichiers.
  if (brut.type === 'feuilleMatch' || brut.feuille !== undefined) {
    return {
      ok: false,
      erreur:
        'Ce fichier est une feuille de match, pas un concours : importez-le depuis « Feuilles de match ».',
    };
  }
  if (!concoursValide(brut.concours)) {
    return { ok: false, erreur: 'La sauvegarde ne contient pas de concours exploitable.' };
  }

  const concours = brut.concours;
  const rattache = (x: unknown): boolean =>
    estObjet(x) && typeof x.id === 'string' && x.concoursId === concours.id;
  // Une équipe inexploitable est écartée comme une entité d'un autre concours :
  // mieux vaut restaurer les quinze autres que faire échouer la restauration —
  // ou écrire en base une équipe qui blanchit l'écran des inscriptions.
  const equipeUtilisable = (x: unknown): boolean => rattache(x) && validerEquipe(x).ok;

  return {
    ok: true,
    sauvegarde: {
      concours,
      teams: liste<Team>(brut.teams, equipeUtilisable),
      poules: liste<Poule>(brut.poules, rattache),
      matches: liste<Match>(brut.matches, rattache),
    },
  };
}

/**
 * Réécrit tous les identifiants d'une sauvegarde, références comprises, pour
 * l'importer sans écraser l'original. Un identifiant inconnu est laissé tel
 * quel plutôt que remplacé par du vide : mieux vaut une référence morte
 * visible qu'une donnée silencieusement perdue.
 */
export function renommerIdentifiants(
  sauvegarde: Sauvegarde,
  nouvelId: (ancien: string) => string,
): Sauvegarde {
  const table = new Map<string, string>();
  const neuf = (ancien: string): string => {
    const connu = table.get(ancien);
    if (connu) return connu;
    const cree = nouvelId(ancien);
    table.set(ancien, cree);
    return cree;
  };
  /** Référence : renommée si l'entité fait partie de la sauvegarde. */
  const ref = (ancien: string): string => table.get(ancien) ?? ancien;

  // Ordre imposé : on nomme d'abord tout ce qui peut être référencé.
  const concoursId = neuf(sauvegarde.concours.id);
  for (const t of sauvegarde.teams) neuf(t.id);
  for (const p of sauvegarde.poules) neuf(p.id);
  for (const m of sauvegarde.matches) neuf(m.id);

  return {
    concours: { ...sauvegarde.concours, id: concoursId },
    teams: sauvegarde.teams.map((t) => ({ ...t, id: ref(t.id), concoursId })),
    poules: sauvegarde.poules.map((p) => ({
      ...p,
      id: ref(p.id),
      concoursId,
      teamIds: p.teamIds.map(ref),
    })),
    matches: sauvegarde.matches.map((m) => ({
      ...m,
      id: ref(m.id),
      concoursId,
      pouleId: m.pouleId ? ref(m.pouleId) : undefined,
      teamAId: m.teamAId ? ref(m.teamAId) : m.teamAId,
      teamBId: m.teamBId ? ref(m.teamBId) : m.teamBId,
      playersA: m.playersA?.map(ref),
      playersB: m.playersB?.map(ref),
      loserFromA: m.loserFromA ? ref(m.loserFromA) : undefined,
      loserFromB: m.loserFromB ? ref(m.loserFromB) : undefined,
    })),
  };
}

/** Résumé lisible d'une sauvegarde, à montrer avant d'importer. */
export function resumeSauvegarde(s: Sauvegarde): string {
  const parties = s.matches.length;
  const jouees = s.matches.filter((m) => m.done).length;
  return [
    s.concours.name,
    s.concours.date,
    `${s.teams.length} équipe${s.teams.length > 1 ? 's' : ''}`,
    s.poules.length > 0 ? `${s.poules.length} poule${s.poules.length > 1 ? 's' : ''}` : '',
    parties > 0 ? `${jouees}/${parties} partie${parties > 1 ? 's' : ''} jouée${jouees > 1 ? 's' : ''}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
