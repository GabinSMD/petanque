import { useMemo, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { terrainBoard, waitingMatches } from '@shared';
import { autoAssignTerrainsAction, setMatchTerrain } from '../../db/actions';
import { matchLabel, sideName } from '../../lib/matchLabel';

interface Props {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

/**
 * Plan des terrains : plateau visuel (libre / occupé), file des parties en
 * attente, et affectation automatique aux terrains libres. Les terrains se
 * libèrent tout seuls dès qu'un score est saisi (la partie n'est plus live).
 */
export function TerrainsTab({ concours, teams, poules, matches }: Props) {
  const [busy, setBusy] = useState(false);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const board = terrainBoard(matches, concours.nbTerrains);
  const waiting = waitingMatches(matches);
  const occupied = board.filter((t) => t.match).length;
  const free = board.length - occupied;

  const label = (m: Match) => matchLabel(m, poules, matches);

  return (
    <div className="tab-content">
      <div className="toolbar no-print">
        <span className="toolbar-info">
          {occupied} / {concours.nbTerrains} terrain{concours.nbTerrains > 1 ? 's' : ''} occupé
          {occupied > 1 ? 's' : ''} · {waiting.length} partie{waiting.length > 1 ? 's' : ''} en
          attente
        </span>
        <span className="toolbar-actions">
          <button
            className="btn btn-primary"
            disabled={busy || free === 0 || waiting.length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await autoAssignTerrainsAction(concours);
              } finally {
                setBusy(false);
              }
            }}
          >
            🎯 Affecter automatiquement
          </button>
        </span>
      </div>

      <div className="terrain-board">
        {board.map((t) => (
          <div
            key={t.number}
            className={`terrain-cell${t.match ? ' terrain-busy' : ' terrain-free'}`}
          >
            <div className="terrain-num">Terrain {t.number}</div>
            {t.match ? (
              <div className="terrain-match">
                <span className="terrain-match-label">{label(t.match)}</span>
                <span className="terrain-vs">
                  {sideName(t.match, 'A', teamsById)}
                  <em> contre </em>
                  {sideName(t.match, 'B', teamsById)}
                </span>
                <button
                  className="btn-icon no-print"
                  title="Libérer ce terrain"
                  onClick={() => void setMatchTerrain(t.match!, null)}
                >
                  ✕ libérer
                </button>
              </div>
            ) : (
              <div className="terrain-empty">Libre</div>
            )}
          </div>
        ))}
      </div>

      {waiting.length > 0 && (
        <section className="waiting-list">
          <h3>⏳ En attente d'un terrain ({waiting.length})</h3>
          <ul>
            {waiting.map((m) => (
              <li key={m.id}>
                <span className="waiting-label">{label(m)}</span>
                <span className="waiting-teams">
                  {sideName(m, 'A', teamsById)} <em>–</em> {sideName(m, 'B', teamsById)}
                </span>
                {free > 0 && (
                  <span className="waiting-assign no-print">
                    {board
                      .filter((t) => !t.match)
                      .slice(0, 6)
                      .map((t) => (
                        <button
                          key={t.number}
                          className="btn btn-sm"
                          onClick={() => void setMatchTerrain(m, t.number)}
                        >
                          T{t.number}
                        </button>
                      ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
