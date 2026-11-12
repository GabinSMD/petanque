/**
 * Fiches de jeu (manuel §3.D.1.B.4.2, « Impression Fiche(s) de Jeu ») : une
 * fiche par équipe, remise aux joueurs « pour le suivi du concours en cas de
 * panne informatique ». Si l'ordinateur tombe, chaque équipe garde sur papier
 * qui elle est, où elle joue et ce qu'elle a déjà fait, et la table de marque
 * peut continuer à la main.
 *
 * Les deux modèles de la planche p.51 servent de référence : la fiche « par
 * poule » (dossard, joueurs, club, n° de poule, puis une ligne par partie
 * jusqu'à la finale) et la fiche « par élimination directe » (mêmes lignes,
 * sans la poule). Chaque ligne a les colonnes Partie, Terrain, Pts,
 * Adversaire (N°, Pts) et Horaire ; on y reporte ce qui est déjà connu et on
 * laisse le reste en blanc.
 *
 * Ici, seulement les données : la mise en page est au client.
 */
import type { Concours, Match, MatchStage, Poule, Team } from '../types';
import { bracketSizeOf, nextPow2, roundLabel } from './bracket';
import { isByeMatch } from './match';
import { estModeRondes } from './modes';

/**
 * Les deux boutons de l'écran de sélection (p.51) : « Ok Par Equipe » et
 * « Ok Par Poule ».
 */
export type TriFiches = 'equipe' | 'poule';

/** Une ligne de la fiche : un tour à jouer, ou déjà joué. */
export interface LigneFiche {
  /** Colonne « Partie » : « 1ère partie », « Cadrage », « 8èmes de finale »… */
  libelle: string;
  /** Terrain attribué, s'il l'est déjà. */
  terrain: number | null;
  /** Dossard de l'adversaire, s'il est connu. */
  adversaire: number | null;
  /** Le tour se passe sans adversaire : l'équipe est exempte. */
  exempt: boolean;
  /** Points marqués et encaissés si la partie est jouée ; sinon cases vides. */
  pour: number | null;
  contre: number | null;
}

export interface AdversairePoule {
  numero: number;
  joueurs: string[];
}

export interface PouleFiche {
  index: number;
  /** Terrain de la poule, quand l'organisateur en a fixé un. */
  terrain: number | null;
  adversaires: AdversairePoule[];
}

export interface FicheDeJeu {
  /** Nom du concours, en tête de fiche comme sur le modèle fédéral. */
  concours: string;
  teamId: string;
  numero: number;
  joueurs: string[];
  club?: string;
  poule: PouleFiche | null;
  lignes: LigneFiche[];
}

export interface OptionsFiches {
  tri: TriFiches;
  /**
   * Fiches à imprimer, au format de l'écran fédéral : « 1-10;15;25 ». Les
   * nombres sont des dossards en tri par équipe, des numéros de poule en tri
   * par poule (le manuel propose alors « 1 à 8 »). Vide : toutes.
   */
  selection?: string;
}

/**
 * Lit une sélection « 1-10;15;25 » (exemple de l'écran p.51). On accepte
 * aussi la virgule et l'espace entre deux morceaux, et « à » entre deux bornes, parce que c'est ainsi
 * qu'on l'écrit à la main. Retourne `null` si le texte ne désigne rien, pour
 * que « vide » veuille dire « tout » et pas « rien ».
 */
export function lireSelection(texte: string | undefined): Set<number> | null {
  if (!texte || !texte.trim()) return null;
  const out = new Set<number>();
  const normalise = texte.replace(/\s*(?:-|à)\s*/gi, '-');
  for (const morceau of normalise.split(/[;,\s]+/)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(morceau);
    if (!m) continue;
    const debut = Number(m[1]);
    const fin = m[2] !== undefined ? Number(m[2]) : debut;
    const [lo, hi] = debut <= fin ? [debut, fin] : [fin, debut];
    // Garde-fou : une faute de frappe (« 1-10000 ») ne doit pas geler la page.
    for (let n = lo; n <= hi && n - lo < 1000; n++) out.add(n);
  }
  return out.size > 0 ? out : null;
}

const SANS_POULE = Number.MAX_SAFE_INTEGER;

const STAGES_TABLEAU: MatchStage[] = ['principal', 'consolante', 'complementaire'];

function camp(m: Match, teamId: string): 'A' | 'B' | null {
  if (m.teamAId === teamId) return 'A';
  if (m.teamBId === teamId) return 'B';
  return null;
}

/** Une ligne remplie à partir d'une partie où l'équipe figure. */
function ligneDePartie(libelle: string, m: Match, cote: 'A' | 'B', teamsById: Map<string, Team>): LigneFiche {
  const adverseId = cote === 'A' ? m.teamBId : m.teamAId;
  const exempt = cote === 'A' ? Boolean(m.byeB) : Boolean(m.byeA);
  const pour = cote === 'A' ? m.scoreA : m.scoreB;
  const contre = cote === 'A' ? m.scoreB : m.scoreA;
  return {
    libelle,
    terrain: m.terrain,
    adversaire: adverseId ? (teamsById.get(adverseId)?.number ?? null) : null,
    exempt,
    // Un exempt n'a pas de vrai score à reporter : la case resterait trompeuse.
    pour: m.done && !exempt ? pour : null,
    contre: m.done && !exempt ? contre : null,
  };
}

const ligneVide = (libelle: string): LigneFiche => ({
  libelle,
  terrain: null,
  adversaire: null,
  exempt: false,
  pour: null,
  contre: null,
});

const LIBELLES_POULE = ['1ère partie', '2e partie', '3e partie'];

/**
 * Lignes de poule. La fiche fédérale garde la place des trois parties qu'une
 * équipe peut jouer en poule : la première, celle des gagnants ou des
 * perdants, et le barrage. On numérote dans l'ordre où l'équipe les joue, car
 * en poule de trois le perdant de la 1ère partie passe directement au barrage.
 * Sans barrage (formule par groupes, §3.D.5), deux lignes suffisent.
 */
function lignesPoule(
  teamId: string,
  pouleMatches: Match[],
  teamsById: Map<string, Team>,
): LigneFiche[] {
  const nb = pouleMatches.some((m) => m.pouleSlot === 'BARRAGE') ? 3 : 2;
  const jouees = pouleMatches
    .filter((m) => camp(m, teamId) !== null)
    .sort((a, b) => a.position - b.position);
  return LIBELLES_POULE.slice(0, nb).map((libelle, i) => {
    const m = jouees[i];
    if (!m) return ligneVide(libelle);
    // Une poule de trois : l'équipe tirée en 3e attend le vainqueur de la
    // 1ère partie. Son adversaire n'est pas encore connu, mais le terrain peut l'être.
    return ligneDePartie(libelle, m, camp(m, teamId)!, teamsById);
  });
}

/**
 * Libellés des tours d'un tableau de `nbEquipes` équipes, comme les écrit le
 * reste de l'application : « Cadrage » quand l'effectif n'est pas une
 * puissance de deux, puis « 16èmes de finale »… jusqu'à la « Finale ».
 */
function libellesTableau(taille: number, cadrage: boolean): string[] {
  const tours = Math.round(Math.log2(taille));
  return Array.from({ length: tours }, (_, r) => roundLabel(taille, r, cadrage));
}

/** Lignes du tableau où l'équipe joue (ou jouera). */
function lignesTableau(
  team: Team,
  matches: Match[],
  teamsById: Map<string, Team>,
  effectifEstime: number,
): LigneFiche[] {
  // L'équipe peut être reversée en consolante (concours B, §3.D.9) : on suit
  // le tableau où elle figure, sinon le principal, sinon une estimation.
  const stage =
    STAGES_TABLEAU.find((s) => matches.some((m) => m.stage === s && camp(m, team.id))) ??
    'principal';
  const ms = matches.filter((m) => m.stage === stage);
  if (ms.length === 0) {
    if (effectifEstime < 2) return [];
    const taille = nextPow2(effectifEstime);
    return libellesTableau(taille, taille !== effectifEstime).map(ligneVide);
  }
  const taille = bracketSizeOf(ms);
  const cadrage = ms.some((m) => m.round === 0 && isByeMatch(m));
  return libellesTableau(taille, cadrage).map((libelle, round) => {
    const m = ms.find((x) => x.round === round && camp(x, team.id));
    return m ? ligneDePartie(libelle, m, camp(m, team.id)!, teamsById) : ligneVide(libelle);
  });
}

/** Lignes des rondes (mêlée, système suisse, championnat). */
function lignesRondes(
  team: Team,
  concours: Pick<Concours, 'nbRondes'>,
  matches: Match[],
  teamsById: Map<string, Team>,
): LigneFiche[] {
  const ms = matches.filter((m) => m.stage === 'ronde');
  const tirees = ms.reduce((max, m) => Math.max(max, m.round + 1), 0);
  const nb = Math.max(concours.nbRondes ?? 0, tirees);
  return Array.from({ length: nb }, (_, r) => {
    const libelle = `Ronde ${r + 1}`;
    // En mêlée, les « équipes » d'une ronde sont des joueurs regroupés : on
    // cherche le participant dans les deux listes.
    const m = ms.find(
      (x) =>
        x.round === r &&
        (camp(x, team.id) || x.playersA?.includes(team.id) || x.playersB?.includes(team.id)),
    );
    if (!m) return ligneVide(libelle);
    const cote = camp(m, team.id) ?? (m.playersA?.includes(team.id) ? 'A' : 'B');
    return ligneDePartie(libelle, m, cote, teamsById);
  });
}

/**
 * Construit les fiches de jeu d'un concours. Les équipes forfait sont
 * écartées : elles ne jouent pas, une fiche n'aurait personne à qui être
 * remise.
 */
export function fichesDeJeu(
  concours: Pick<Concours, 'name' | 'mode' | 'nbRondes'>,
  teams: Team[],
  poules: Poule[],
  matches: Match[],
  options: OptionsFiches,
): FicheDeJeu[] {
  const actives = teams.filter((t) => !t.forfait);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const pouleDe = new Map<string, Poule>();
  for (const p of poules) for (const id of p.teamIds) pouleDe.set(id, p);
  const rondes = estModeRondes(concours.mode);

  /**
   * Taille du tableau avant qu'il soit tiré : deux qualifiés par poule, ou
   * toutes les équipes en élimination directe. Approximation assumée — elle ne
   * sert qu'à dessiner les lignes vides, que l'arbitre corrige au besoin.
   */
  const effectifEstime = poules.length > 0 ? poules.length * 2 : actives.length;

  const fiches: FicheDeJeu[] = actives.map((team) => {
    const poule = pouleDe.get(team.id) ?? null;
    const pouleMatches = poule ? matches.filter((m) => m.pouleId === poule.id) : [];
    const lignes = rondes
      ? lignesRondes(team, concours, matches, teamsById)
      : [
          ...(poule ? lignesPoule(team.id, pouleMatches, teamsById) : []),
          ...lignesTableau(team, matches, teamsById, effectifEstime),
        ];
    const clubs = [...new Set(team.players.map((p) => p.club ?? team.club).filter(Boolean))];
    return {
      concours: concours.name,
      teamId: team.id,
      numero: team.number,
      joueurs: team.players.map((p) => p.name),
      club: clubs.length > 0 ? clubs.join(' / ') : undefined,
      poule: poule
        ? {
            index: poule.index,
            terrain: poule.terrain,
            adversaires: poule.teamIds
              .filter((id) => id !== team.id)
              .map((id) => teamsById.get(id))
              .filter((t): t is Team => Boolean(t))
              .map((t) => ({ numero: t.number, joueurs: t.players.map((p) => p.name) })),
          }
        : null,
      lignes,
    };
  });

  const selection = lireSelection(options.selection);
  if (options.tri === 'poule') {
    // Par poule, dans l'ordre du tirage : les fiches d'une même poule se
    // suivent et se distribuent d'un seul geste. Sans poule, en fin de liste.
    const rang = (f: FicheDeJeu): number => {
      const p = pouleDe.get(f.teamId);
      return p ? p.teamIds.indexOf(f.teamId) : 0;
    };
    return fiches
      .filter((f) => !selection || (f.poule !== null && selection.has(f.poule.index)))
      .sort(
        (a, b) =>
          (a.poule?.index ?? SANS_POULE) - (b.poule?.index ?? SANS_POULE) ||
          rang(a) - rang(b) ||
          a.numero - b.numero,
      );
  }
  return fiches
    .filter((f) => !selection || selection.has(f.numero))
    .sort((a, b) => a.numero - b.numero);
}
