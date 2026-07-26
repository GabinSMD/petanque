import { useMemo } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { bracketRanking, pouleOutcome, rondeStandings } from '@shared';
import { StandingsTable } from '../../components/StandingsTable';
import { TeamLabel } from '../../components/TeamLabel';
import { isIndividualMode, isRondesMode } from '../../lib/labels';

interface Props {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

export function ResultsTab({ concours, teams, poules, matches }: Props) {
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (isRondesMode(concours.mode)) {
    const played = matches.some((m) => m.stage === 'ronde' && m.done);
    if (!played) {
      return (
        <div className="tab-content">
          <p className="empty-state">Le classement apparaîtra dès les premières parties saisies.</p>
        </div>
      );
    }
    return (
      <div className="tab-content results">
        <section className="result-section">
          <h2>
            Classement général{isIndividualMode(concours.mode) ? ' (individuel)' : ''}
          </h2>
          <StandingsTable
            standings={rondeStandings(teams, matches)}
            teamsById={teamsById}
          />
        </section>
      </div>
    );
  }

  const principalGroups = bracketRanking(matches, 'principal');
  const consolanteGroups = bracketRanking(matches, 'consolante');
  const outcomes = poules.map((p) =>
    pouleOutcome(p, matches.filter((m) => m.pouleId === p.id)),
  );

  const hasAnything =
    principalGroups.length > 0 || consolanteGroups.length > 0 || outcomes.length > 0;

  if (!hasAnything) {
    return (
      <div className="tab-content">
        <p className="empty-state">Les résultats apparaîtront au fil du concours.</p>
      </div>
    );
  }

  return (
    <div className="tab-content results">
      {principalGroups.length > 0 && (
        <section className="result-section">
          <h2>Concours principal</h2>
          <RankTable groups={principalGroups} teamsById={teamsById} />
        </section>
      )}

      {consolanteGroups.length > 0 && (
        <section className="result-section">
          <h2>Consolante</h2>
          <RankTable groups={consolanteGroups} teamsById={teamsById} />
        </section>
      )}

      {concours.mode === 'poules' && outcomes.length > 0 && (
        <section className="result-section">
          <h2>Issue des poules</h2>
          <table className="rank-table">
            <thead>
              <tr>
                <th>Poule</th>
                <th>1er (2 victoires)</th>
                <th>2e (barrage)</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.poule.id}>
                  <td>Poule {o.poule.index}</td>
                  <td>{o.q1 ? <TeamLabel team={teamsById.get(o.q1)} /> : '—'}</td>
                  <td>{o.q2 ? <TeamLabel team={teamsById.get(o.q2)} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function RankTable({
  groups,
  teamsById,
}: {
  groups: ReturnType<typeof bracketRanking>;
  teamsById: Map<string, Team>;
}) {
  return (
    <table className="rank-table">
      <tbody>
        {groups.map((g) => (
          <tr key={g.rank} className={g.rank === 1 ? 'rank-first' : ''}>
            <td className="rank-cell">
              {g.rank === 1 ? '🏆' : g.rank === 2 ? '🥈' : `${g.rank}e`}
            </td>
            <td className="rank-label">{g.label}</td>
            <td>
              <ul className="rank-teams">
                {g.teamIds.map((id) => (
                  <li key={id}>
                    <TeamLabel team={teamsById.get(id)} />
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
