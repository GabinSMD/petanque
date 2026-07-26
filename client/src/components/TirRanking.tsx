import type { Match, Team } from '@shared';
import { tirStandings } from '@shared';
import { teamDisplayName } from './TeamLabel';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Classement du tir de précision (meilleure série puis total). */
export function TirRanking({
  teams,
  matches,
  teamsById,
  limit,
}: {
  teams: Team[];
  matches: Match[];
  teamsById: Map<string, Team>;
  limit?: number;
}) {
  const standings = tirStandings(teams, matches);
  const rows = limit ? standings.slice(0, limit) : standings;
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th></th>
          <th>Tireur</th>
          <th title="Meilleure série">Meilleur</th>
          <th title="Somme des séries">Total</th>
          <th>Séries</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const t = teamsById.get(s.id);
          return (
            <tr key={s.id} className={i < 3 && s.best > 0 ? 'standing-top' : ''}>
              <td className="standing-rank">{s.best > 0 ? (MEDALS[i] ?? i + 1) : '—'}</td>
              <td>
                {t ? (
                  <>
                    <span className="team-number">{t.number}</span> {teamDisplayName(t)}
                  </>
                ) : (
                  '…'
                )}
              </td>
              <td className="standing-wins">{s.best}</td>
              <td>{s.total}</td>
              <td className="hint">{s.series.map((x) => x ?? '·').join(' / ')}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
