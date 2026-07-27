/**
 * Mise en forme des documents imprimés du manuel « Gestion Concours »
 * (§3.B.9 et §3.D.1.B.4) : ce qui relève du calcul vit ici, la mise en page
 * reste au client.
 */
import type { Match, MatchStage, Team } from '../types';
import { bracketSizeOf, roundLabel } from './bracket';
import { isByeMatch, winnerOf } from './match';

/** Ordres de tri proposés à l'impression des listes. */
export type TriEquipes = 'numero' | 'nom' | 'club';

/** Comparaison française : insensible à la casse et aux accents. */
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Trie une copie de la liste — l'ordre d'affichage ne modifie rien. */
export function trierEquipes(teams: Team[], tri: TriEquipes): Team[] {
  const copie = [...teams];
  if (tri === 'numero') return copie.sort((a, b) => a.number - b.number);
  if (tri === 'club') {
    return copie.sort(
      (a, b) => collator.compare(a.club ?? '', b.club ?? '') || a.number - b.number,
    );
  }
  return copie.sort(
    (a, b) =>
      collator.compare(a.players[0]?.name ?? '', b.players[0]?.name ?? '') || a.number - b.number,
  );
}

export interface PresseMatch {
  id: string;
  round: number;
  teamA: Team | null;
  teamB: Team | null;
  scoreA: number | null;
  scoreB: number | null;
  /** Côté vainqueur : l'autre est l'équipe éliminée. */
  gagnant: 'A' | 'B' | null;
  terrain: number | null;
}

export interface PresseSection {
  round: number;
  label: string;
  matches: PresseMatch[];
}

/**
 * Résultats pour la presse (§3.D.1.B.4.6) : les parties jouées d'un tableau,
 * groupées par tour, du premier tour à la finale. Les exempts et les parties
 * non jouées sont écartés — la presse ne publie que ce qui s'est joué.
 */
export function presseSections(
  teams: Team[],
  matches: Match[],
  stage: MatchStage = 'principal',
): PresseSection[] {
  const stageMatches = matches.filter((m) => m.stage === stage);
  if (stageMatches.length === 0) return [];

  const byId = new Map(teams.map((t) => [t.id, t]));
  const size = bracketSizeOf(stageMatches);
  const hasByes = stageMatches.some((m) => m.round === 0 && isByeMatch(m));
  const rounds = [...new Set(stageMatches.map((m) => m.round))].sort((a, b) => a - b);

  const sections: PresseSection[] = [];
  for (const round of rounds) {
    const joues = stageMatches
      .filter((m) => m.round === round && m.done && !isByeMatch(m))
      .sort((a, b) => a.position - b.position)
      .map((m) => {
        const vainqueur = winnerOf(m);
        return {
          id: m.id,
          round,
          teamA: m.teamAId ? (byId.get(m.teamAId) ?? null) : null,
          teamB: m.teamBId ? (byId.get(m.teamBId) ?? null) : null,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          gagnant: vainqueur === m.teamAId ? 'A' : vainqueur === m.teamBId ? 'B' : null,
          terrain: m.terrain,
        } satisfies PresseMatch;
      });
    if (joues.length > 0) {
      sections.push({ round, label: roundLabel(size, round, hasByes), matches: joues });
    }
  }
  return sections;
}
