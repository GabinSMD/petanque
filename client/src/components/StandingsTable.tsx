import type { Standing, Team } from '@shared';
import { libelleClubs } from '@shared';
import { teamDisplayName } from './TeamLabel';

const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  standings: Standing[];
  teamsById: Map<string, Team>;
  /** Nombre de lignes affichées (affichage TV). */
  limit?: number;
  compact?: boolean;
}

/** Classement des formules en rondes : victoires puis goal-average. */
export function StandingsTable({ standings, teamsById, limit, compact }: Props) {
  const rows = limit ? standings.slice(0, limit) : standings;
  return (
    <table className={`standings-table${compact ? ' standings-compact' : ''}`}>
      <thead>
        <tr>
          <th></th>
          <th>Nom</th>
          <th title="Parties jouées">J</th>
          <th title="Victoires">V</th>
          <th title="Goal-average (points marqués − encaissés)">+/−</th>
          {!compact && <th title="Points marqués">Pts</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const team = teamsById.get(s.id);
          return (
            <tr key={s.id} className={i < 3 ? `standing-top standing-${i + 1}` : ''}>
              <td className="standing-rank">{MEDALS[i] ?? i + 1}</td>
              <td>
                {team ? (
                  <>
                    <span className="team-number">{team.number}</span>{' '}
                    {teamDisplayName(team)}
                    {team.forfait && ' (FF)'}
                    {!compact && libelleClubs(team.players, team.club) && (
                      <span className="team-club"> {libelleClubs(team.players, team.club)}</span>
                    )}
                  </>
                ) : (
                  '…'
                )}
              </td>
              <td>{s.played}</td>
              <td className="standing-wins">{s.wins}</td>
              <td>{s.diff > 0 ? `+${s.diff}` : s.diff}</td>
              {!compact && <td>{s.pointsFor}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
