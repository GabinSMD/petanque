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

/** Le camp (A/B) de l'équipe dans la partie, ou null si absente. */
export function teamSideInMatch(m: Match, teamId: string): 'A' | 'B' | null {
  if (m.teamAId === teamId || m.playersA?.includes(teamId)) return 'A';
  if (m.teamBId === teamId || m.playersB?.includes(teamId)) return 'B';
  return null;
}

/** Numéros de dossard des équipes engagées dans une partie (mêlée comprise). */
export function matchTeamNumbers(m: Match, teamsById: Map<string, Team>): number[] {
  const ids = [
    ...(m.playersA ?? (m.teamAId ? [m.teamAId] : [])),
    ...(m.playersB ?? (m.teamBId ? [m.teamBId] : [])),
  ];
  return ids
    .map((id) => teamsById.get(id)?.number)
    .filter((n): n is number => typeof n === 'number');
}

/**
 * Une partie « notable » convoque des équipes à une nouvelle étape :
 * barrage, partie des gagnants/perdants, tour de tableau, nouvelle ronde.
 * Les toutes premières parties (M1/M2 de poule, 1re ronde) sont exclues :
 * les équipes sont déjà sur place au lancement.
 */
export function isNotableCall(m: Match): boolean {
  if (m.done || isByeMatch(m)) return false;
  const known =
    Boolean(m.teamAId || (m.playersA && m.playersA.length)) &&
    Boolean(m.teamBId || (m.playersB && m.playersB.length));
  if (!known) return false;
  if (m.stage === 'poule') {
    return m.pouleSlot === 'GAGNANTS' || m.pouleSlot === 'PERDANTS' || m.pouleSlot === 'BARRAGE';
  }
  if (m.stage === 'ronde') return m.round >= 1;
  if (m.stage === 'principal' || m.stage === 'consolante') return true;
  return false;
}

/**
 * Parties « prêtes à saisir » impliquant l'équipe (deux camps connus,
 * pas terminées) — triées poules puis rondes puis tableaux.
 */
export function pendingMatchesForTeam(teamId: string, matches: Match[]): Match[] {
  const order: Record<string, number> = { poule: 0, ronde: 1, principal: 2, consolante: 3 };
  return declarableMatches(matches)
    .filter((m) => teamSideInMatch(m, teamId) !== null)
    .sort(
      (a, b) =>
        (order[a.stage] ?? 9) - (order[b.stage] ?? 9) ||
        a.round - b.round ||
        a.position - b.position,
    );
}

/**
 * Dernières parties jouées par l'équipe, la plus récente d'abord : de quoi
 * corriger un score par le dossard, sans chercher la carte de la partie.
 */
export function playedMatchesForTeam(teamId: string, matches: Match[], max = 2): Match[] {
  return matches
    .filter((m) => m.done && !isByeMatch(m) && teamSideInMatch(m, teamId) !== null)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, max);
}

/** Numéros d'un seul camp : « n°9 », ou « n°3·n°8 » pour un camp de mêlée. */
export function campNumeros(m: Match, camp: 'A' | 'B', teamsById: Map<string, Team>): string {
  const ids =
    (camp === 'A' ? m.playersA : m.playersB) ??
    ((camp === 'A' ? m.teamAId : m.teamBId) ? [(camp === 'A' ? m.teamAId : m.teamBId)!] : []);
  const nums = ids
    .map((id) => teamsById.get(id)?.number)
    .filter((n): n is number => typeof n === 'number');
  return nums.length > 0 ? nums.map((n) => `n°${n}`).join('·') : '?';
}

/** « des Gagnants (poule 3) », « du Barrage (poule 1) », ou le libellé d'un tour de tableau. */
function nomDePartie(m: Match, poules: Poule[], matches: Match[]): string {
  if (m.stage === 'poule') {
    const poule = poules.find((p) => p.id === m.pouleId);
    const ou = poule ? ` (poule ${poule.index})` : '';
    if (m.pouleSlot === 'GAGNANTS') return `des Gagnants${ou}`;
    if (m.pouleSlot === 'PERDANTS') return `des Perdants${ou}`;
    if (m.pouleSlot === 'BARRAGE') return `du Barrage${ou}`;
  }
  return `de « ${matchLabel(m, poules, matches)} »`;
}

/**
 * Phrase qui nomme une partie jouée qu'une correction va effacer :
 * « Le 13-0 des Gagnants (poule 1), n°10 contre n°5, sera effacé. »
 * Les numéros suivent l'ordre du score, pour qu'on lise qui a marqué quoi.
 */
export function phraseEffacement(
  m: Match,
  poules: Poule[],
  matches: Match[],
  teamsById: Map<string, Team>,
): string {
  const resultat =
    m.scoreA !== null && m.scoreB !== null
      ? `Le ${m.scoreA}-${m.scoreB}`
      : `Le résultat (${campNumeros(m, m.vainqueur === 'B' ? 'B' : 'A', teamsById)} gagne)`;
  return `${resultat} ${nomDePartie(m, poules, matches)}, ${campNumeros(m, 'A', teamsById)} contre ${campNumeros(m, 'B', teamsById)}, sera effacé.`;
}
