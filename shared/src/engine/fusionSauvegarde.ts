/**
 * Fusion des résultats d'une sauvegarde dans le même concours, déjà présent sur
 * cet appareil (manuel §3.D.1.B.6.2, « Importation Manuelle »).
 *
 * Le logiciel fédéral fait passer, par clé USB, les saisies d'un poste annexe
 * vers le poste principal, qui les reprend pour mener la suite du concours. Ici,
 * la synchronisation fait ce travail dès qu'il y a du réseau ; sans réseau, on
 * importe la sauvegarde exportée sur l'autre appareil et on fusionne ses
 * résultats partie par partie, au lieu de créer un concours à côté.
 *
 * Seuls les **résultats** voyagent : score, mènes, vainqueur désigné. Qui joue
 * quelle partie se déduit des résultats en amont, par la propagation habituelle
 * de l'application ; recopier les équipes du fichier ferait coexister deux
 * vérités. D'où la règle : on ne reprend un résultat que si la partie oppose ici
 * les mêmes équipes que là-bas. Une partie de tableau dont les équipes ne sont
 * pas encore connues ici le deviendra une fois les poules fusionnées et
 * propagées ; l'appelant refait donc une passe après chaque propagation, jusqu'à
 * ce que plus rien ne soit repris (`fusionTerminee`).
 */
import type { Match } from '../types';
import { isByeMatch } from './match';

/** Ce qui fait le résultat d'une partie, et rien d'autre. */
export type ResultatPartie = Pick<Match, 'scoreA' | 'scoreB' | 'vainqueur'>;

export interface ConflitFusion {
  matchId: string;
  local: ResultatPartie;
  distant: ResultatPartie;
  /** Le côté retenu : le plus récemment mis à jour, le local à égalité. */
  retenu: 'local' | 'distant';
}

export type RaisonEcart =
  /** La partie n'existe pas ici : tirage fait sur l'autre appareil seulement. */
  | 'absente'
  /** Les équipes diffèrent : tirage différent, ou amont pas encore fusionné. */
  | 'equipes'
  /** Le fichier porte un résultat qui ne se lit pas comme un score. */
  | 'illisible';

export interface EcartFusion {
  matchId: string;
  raison: RaisonEcart;
}

export interface FusionResultats {
  /** Parties locales à réécrire avec le résultat distant. */
  aEcrire: Match[];
  /** Parties saisies seulement sur l'autre appareil, reprises ici. */
  reprises: string[];
  /** Parties saisies des deux côtés avec des résultats différents. */
  conflits: ConflitFusion[];
  /** Résultats distants qui n'ont pas pu être rapprochés d'une partie locale. */
  ecartes: EcartFusion[];
}

/** Une partie compte comme saisie quand elle est terminée — pas en cours de mènes. */
function saisie(m: Match): boolean {
  return m.done === true && !isByeMatch(m);
}

function resultat(m: Match): ResultatPartie {
  return { scoreA: m.scoreA, scoreB: m.scoreB, vainqueur: m.vainqueur };
}

function memeResultat(a: Match, b: Match): boolean {
  return (
    a.done === b.done &&
    a.scoreA === b.scoreA &&
    a.scoreB === b.scoreB &&
    (a.vainqueur ?? null) === (b.vainqueur ?? null)
  );
}

/**
 * Le fichier vient d'un disque : un score doit être un entier positif ou rien,
 * et une partie terminée doit avoir de quoi désigner un vainqueur. Au tir de
 * précision, seul `scoreA` est renseigné.
 */
function resultatLisible(m: Match): boolean {
  const score = (s: unknown): boolean =>
    s === null || s === undefined || (typeof s === 'number' && Number.isInteger(s) && s >= 0);
  if (!score(m.scoreA) || !score(m.scoreB)) return false;
  if (m.vainqueur !== undefined && m.vainqueur !== 'A' && m.vainqueur !== 'B') return false;
  if (m.menes !== undefined && !Array.isArray(m.menes)) return false;
  return typeof m.scoreA === 'number' || m.vainqueur !== undefined;
}

/** Un camp : son équipe, ou en mêlée la liste de ses joueurs. */
function camp(id: string | null, joueurs: string[] | undefined): string {
  if (id) return id;
  return joueurs && joueurs.length > 0 ? [...joueurs].sort().join('+') : '';
}

function memesEquipes(a: Match, b: Match): boolean {
  return (
    camp(a.teamAId, a.playersA) === camp(b.teamAId, b.playersA) &&
    camp(a.teamBId, a.playersB) === camp(b.teamBId, b.playersB)
  );
}

/**
 * Une passe de fusion. Pure : elle dit quoi écrire, l'appelant écrit puis
 * propage comme après une saisie.
 *
 * `reference` est l'état local **avant** la première passe. Il sert à juger
 * les conflits sur l'heure de la vraie saisie : entre deux passes, la
 * propagation réécrit des parties sans toucher à leur résultat, ce qui
 * rajeunirait leur `updatedAt` et ferait gagner le local à tort.
 */
export function fusionnerResultats(
  locales: Match[],
  distantes: Match[],
  reference: Match[] = locales,
): FusionResultats {
  const parId = new Map(locales.map((m) => [m.id, m]));
  const avant = new Map(reference.map((m) => [m.id, m]));
  const out: FusionResultats = { aEcrire: [], reprises: [], conflits: [], ecartes: [] };

  for (const d of distantes) {
    if (!saisie(d)) continue;
    const l = parId.get(d.id);
    if (!l) {
      out.ecartes.push({ matchId: d.id, raison: 'absente' });
      continue;
    }
    if (!resultatLisible(d)) {
      out.ecartes.push({ matchId: d.id, raison: 'illisible' });
      continue;
    }
    if (!memesEquipes(l, d)) {
      out.ecartes.push({ matchId: d.id, raison: 'equipes' });
      continue;
    }
    if (saisie(l) && memeResultat(l, d)) continue;

    const ecrire = (): void => {
      out.aEcrire.push({
        ...l,
        scoreA: d.scoreA ?? null,
        scoreB: d.scoreB ?? null,
        menes: d.menes,
        vainqueur: d.vainqueur,
        done: true,
      });
    };

    if (!saisie(l)) {
      ecrire();
      out.reprises.push(d.id);
      continue;
    }

    // Saisie des deux côtés, résultats différents : le plus récent l'emporte.
    // Les horodatages sont des ISO 8601 en UTC, comparables comme chaînes.
    // À égalité, on garde le local : le poste principal reste maître.
    const orig = avant.get(l.id);
    const heureLocale = orig && memeResultat(orig, l) ? orig.updatedAt : l.updatedAt;
    const retenu = (d.updatedAt ?? '') > (heureLocale ?? '') ? 'distant' : 'local';
    out.conflits.push({ matchId: d.id, local: resultat(l), distant: resultat(d), retenu });
    if (retenu === 'distant') ecrire();
  }
  return out;
}

/** Rien de neuf à écrire : les passes suivantes ne reprendraient plus rien. */
export function fusionTerminee(f: FusionResultats): boolean {
  return f.aEcrire.length === 0;
}

/**
 * Bilan de plusieurs passes. Une même partie peut réapparaître d'une passe à
 * l'autre (un conflit gagné par le local se représente tel quel) : on la
 * compte une fois. Les écarts sont ceux de la **dernière** passe, les
 * précédents ayant pu se résoudre entre-temps.
 */
export function cumulerFusions(passes: FusionResultats[]): FusionResultats {
  const reprises = new Set<string>();
  const conflits = new Map<string, ConflitFusion>();
  for (const p of passes) {
    for (const id of p.reprises) reprises.add(id);
    for (const c of p.conflits) if (!conflits.has(c.matchId)) conflits.set(c.matchId, c);
  }
  const derniere = passes[passes.length - 1];
  return {
    aEcrire: [],
    reprises: [...reprises],
    conflits: [...conflits.values()],
    ecartes: derniere ? derniere.ecartes : [],
  };
}
