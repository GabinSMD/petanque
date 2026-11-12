/**
 * Rapport d'arbitrage d'un concours (manuel « Gestion Concours » §3.D.1.B.4.5).
 *
 * C'est le document que l'arbitre signe et que le comité saisit dans Geslico
 * pour attribuer les points fédéraux. Il liste, de la meilleure place à la
 * moins bonne, les équipes et le détail de leurs joueurs (n° de licence, nom
 * en majuscules, club).
 *
 * La fédération ne collecte que les quatre derniers tours — un perdant du 1er
 * tour d'un concours à 32 équipes n'y figure pas.
 */
import type { Match, MatchStage, Team } from '../types';
import { bracketRanking } from './bracket';

export interface ArbitragePlayerRow {
  licence?: string;
  name: string;
  /** Club du joueur : une équipe de national peut en réunir plusieurs. */
  club?: string;
}

export interface ArbitrageTeamRow {
  /** Numéro de dossard. */
  number: number;
  /** Club de l'équipe : renseigné pour un concours de club, absent sinon. */
  club?: string;
  players: ArbitragePlayerRow[];
}

export type LettreConcours = 'A' | 'B' | 'C';

export interface ArbitrageSection {
  /** Concours auquel appartient la place : A (principal), B, C. */
  concours: LettreConcours;
  label: string;
  teams: ArbitrageTeamRow[];
}

/**
 * Bilan des engagés. Le document fédéral en contient bien plus (équipes non
 * homogènes, joueurs par comité et par ligue, classification élite / honneur /
 * promotion, critères X-Y-Z, grille de classement) : tout cela demande les
 * données du fichier fédéral des licenciés, que l'application n'a pas encore.
 */
export interface ArbitrageStats {
  equipes: number;
  forfaits: number;
  joueurs: number;
  joueursSansLicence: number;
}

export interface ArbitrageReport {
  sections: ArbitrageSection[];
  stats: ArbitrageStats;
}

/** Libellés fédéraux, à partir des libellés du classement de tableau. */
const SECTION_LABELS: Record<string, string> = {
  Vainqueur: 'Vainqueur',
  Finaliste: 'Finaliste',
  'Demi-finalistes': 'Perdants 1/2 finale',
  'Éliminés en quarts': 'Perdants 1/4 de finale',
  'Éliminés en 8èmes': 'Perdants 8ème de finale',
};

/**
 * Les tableaux, dans l'ordre du document fédéral. Le manuel répète à chaque
 * formule A-B et A-B-C (§3.D.3 à §3.D.13) « imprimer les résultats arbitrage
 * concours A, B, C » : les places du B et du C rapportent aussi des points.
 */
const CONCOURS: { stage: MatchStage; lettre: LettreConcours }[] = [
  { stage: 'principal', lettre: 'A' },
  { stage: 'consolante', lettre: 'B' },
  { stage: 'complementaire', lettre: 'C' },
];

export function arbitrageReport(teams: Team[], matches: Match[]): ArbitrageReport {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const joues = CONCOURS.filter((c) => matches.some((m) => m.stage === c.stage));
  // Un concours sans B ni C garde ses intitulés d'origine : préfixer « Concours A »
  // partout alourdirait le cas de loin le plus courant.
  const prefixer = joues.length > 1;

  const sections: ArbitrageSection[] = [];
  for (const { stage, lettre } of joues) {
    for (const group of bracketRanking(matches, stage)) {
      const base = SECTION_LABELS[group.label];
      if (!base) continue; // tours plus profonds : non collectés par la fédération
      const rows = group.teamIds
        .map((id) => byId.get(id))
        .filter((t): t is Team => Boolean(t))
        .map((t) => ({
          number: t.number,
          club: t.club,
          players: t.players.map((p) => ({
            licence: p.licence,
            name: p.name,
            club: p.club ?? t.club,
          })),
        }));
      if (rows.length === 0) continue;
      sections.push({
        concours: lettre,
        label: prefixer ? `Concours ${lettre} — ${base}` : base,
        teams: rows,
      });
    }
  }

  const players = teams.flatMap((t) => t.players);
  return {
    sections,
    stats: {
      equipes: teams.length,
      forfaits: teams.filter((t) => t.forfait).length,
      joueurs: players.length,
      joueursSansLicence: players.filter((p) => !p.licence).length,
    },
  };
}
