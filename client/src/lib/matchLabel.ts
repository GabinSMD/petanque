import type { Match, Poule, Team } from '@shared';
import { bracketSizeOf, isByeMatch, roundLabel } from '@shared';
import { teamDisplayName } from '../components/TeamLabel';
import { POULE_SLOT_LABELS } from './labels';

/** Libellé court et lisible d'une partie (« Poule 3 — Barrage », « Quarts — P2 »). */
export function matchLabel(m: Match, poules: Poule[], matches: Match[]): string {
  if (m.stage === 'poule') {
    const poule = poules.find((p) => p.id === m.pouleId);
    return `Poule ${poule?.index ?? '?'} — ${POULE_SLOT_LABELS[m.pouleSlot ?? ''] ?? ''}`;
  }
  if (m.stage === 'ronde') {
    return `Ronde ${m.round + 1} — Partie ${m.position + 1}`;
  }
  const stageMatches = matches.filter((x) => x.stage === m.stage);
  const size = bracketSizeOf(stageMatches);
  const hasByes = stageMatches.some((x) => x.round === 0 && isByeMatch(x));
  const prefix = m.stage === 'consolante' ? 'Consolante — ' : '';
  return `${prefix}${roundLabel(size, m.round, hasByes)} — Partie ${m.position + 1}`;
}

/** Nom d'un camp (équipe classique ou joueurs de mêlée). */
export function sideName(m: Match, side: 'A' | 'B', teamsById: Map<string, Team>): string {
  const players = side === 'A' ? m.playersA : m.playersB;
  if (players && players.length > 0) {
    return players
      .map((id) => teamsById.get(id))
      .filter((t): t is Team => Boolean(t))
      .map((t) => teamDisplayName(t))
      .join(' · ');
  }
  const teamId = side === 'A' ? m.teamAId : m.teamBId;
  const team = teamId ? teamsById.get(teamId) : undefined;
  return team ? `n°${team.number} ${teamDisplayName(team)}` : '';
}

/** Parties déclarables : les deux camps connus, pas encore validées. */
export function declarableMatches(matches: Match[]): Match[] {
  return matches.filter(
    (m) =>
      !m.done &&
      !isByeMatch(m) &&
      Boolean(m.teamAId || (m.playersA && m.playersA.length)) &&
      Boolean(m.teamBId || (m.playersB && m.playersB.length)),
  );
}
