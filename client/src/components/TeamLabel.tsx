import type { Team } from '@shared';

interface Props {
  team: Team | undefined | null;
  bye?: boolean;
  /** Nom compact (sans club) pour les tableaux serrés. */
  compact?: boolean;
}

export function teamDisplayName(team: Team): string {
  return team.players.map((p) => p.name).join(' / ');
}

export function TeamLabel({ team, bye, compact }: Props) {
  if (bye) return <span className="team-label team-bye">Exempt</span>;
  if (!team) return <span className="team-label team-tbd">À déterminer</span>;
  return (
    <span className={`team-label${team.forfait ? ' team-forfait' : ''}`}>
      <span className="team-number">{team.number}</span>
      <span className="team-names">
        {teamDisplayName(team)}
        {team.forfait && ' (FF)'}
      </span>
      {!compact && team.club && <span className="team-club">{team.club}</span>}
    </span>
  );
}
