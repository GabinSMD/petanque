import { useMemo, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { bracketSizeOf, isByeMatch, pouleOutcome, roundLabel, winnerOf } from '@shared';
import {
  cancelTableau,
  generateTableauDirect,
  generateTableauFromPoules,
  updateConcours,
} from '../../db/actions';
import { ScoreForm } from '../../components/ScoreForm';
import { TeamLabel, teamDisplayName } from '../../components/TeamLabel';

interface Props {
  concours: Concours;
  teams: Team[];
  matches: Match[];
  poules: Poule[];
}

export function BracketTab({ concours, teams, matches, poules }: Props) {
  const [stage, setStage] = useState<'principal' | 'consolante'>('principal');
  const [avoidSameClub, setAvoidSameClub] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const principal = matches.filter((m) => m.stage === 'principal');
  const consolante = matches.filter((m) => m.stage === 'consolante');
  const locked = concours.status === 'termine';

  /* --------------------------- Pas encore de tableau --------------------------- */

  if (principal.length === 0) {
    if (concours.mode === 'elimination_directe') {
      const activeTeams = teams.filter((t) => !t.forfait);
      return (
        <div className="tab-content">
          <div className="draw-panel">
            <h2>Tirage du tableau</h2>
            <p>
              {activeTeams.length} équipe{activeTeams.length > 1 ? 's' : ''} (hors
              forfaits)
              {concours.consolante &&
                ' — les perdants du premier tour joueront la consolante.'}
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={avoidSameClub}
                onChange={(e) => setAvoidSameClub(e.target.checked)}
              />
              Éviter deux équipes du même club au premier tour
            </label>
            {error && <p className="form-error">{error}</p>}
            <button
              className="btn btn-primary"
              disabled={activeTeams.length < 2 || busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                generateTableauDirect(concours, avoidSameClub)
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : 'Tirage impossible'),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              🎲 Tirer le tableau
            </button>
          </div>
        </div>
      );
    }

    // Mode poules : le tableau se génère à l'issue des poules.
    const outcomes = poules.map((p) =>
      pouleOutcome(p, matches.filter((m) => m.pouleId === p.id)),
    );
    const allComplete = poules.length > 0 && outcomes.every((o) => o.complete);
    return (
      <div className="tab-content">
        <div className="draw-panel">
          <h2>Tableau final</h2>
          {poules.length === 0 ? (
            <p>Tirez d'abord les poules (onglet Poules).</p>
          ) : allComplete ? (
            <>
              <p>Toutes les poules sont terminées : place au tableau.</p>
              {error && <p className="form-error">{error}</p>}
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  generateTableauFromPoules(concours)
                    .catch((err) =>
                      setError(
                        err instanceof Error ? err.message : 'Génération impossible',
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Générer le tableau
              </button>
            </>
          ) : (
            <p>
              Le tableau sera généré quand toutes les poules seront terminées (
              {outcomes.filter((o) => o.complete).length}/{poules.length}).
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ Tableau en cours ----------------------------- */

  const maxRound = Math.max(...principal.map((m) => m.round));
  const finale = principal.find((m) => m.round === maxRound && m.position === 0);
  const champion = winnerOf(finale);
  const championTeam = champion ? teamsById.get(champion) : undefined;

  const shownMatches = stage === 'principal' ? principal : consolante;

  return (
    <div className="tab-content">
      <div className="toolbar no-print">
        {consolante.length > 0 && (
          <span className="stage-tabs">
            <button
              className={stage === 'principal' ? 'tab active' : 'tab'}
              onClick={() => setStage('principal')}
            >
              Concours principal
            </button>
            <button
              className={stage === 'consolante' ? 'tab active' : 'tab'}
              onClick={() => setStage('consolante')}
            >
              Consolante
            </button>
          </span>
        )}
        <span className="toolbar-actions">
          {!locked && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (
                  window.confirm(
                    'Annuler le tableau ? Tous les scores du tableau seront supprimés.',
                  )
                ) {
                  void cancelTableau(concours);
                }
              }}
            >
              Annuler le tableau
            </button>
          )}
          {championTeam && !locked && (
            <button
              className="btn btn-primary"
              onClick={() => void updateConcours({ ...concours, status: 'termine' })}
            >
              Clôturer le concours
            </button>
          )}
          {locked && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void updateConcours({ ...concours, status: 'tableau' })}
            >
              Rouvrir le concours
            </button>
          )}
        </span>
      </div>

      {championTeam && (
        <div className="champion-banner">
          🏆 Vainqueur{stage === 'consolante' ? ' du principal' : ''} :{' '}
          <strong>
            n°{championTeam.number} {teamDisplayName(championTeam)}
          </strong>
        </div>
      )}

      <BracketView
        concours={concours}
        stageMatches={shownMatches}
        allMatches={matches}
        teamsById={teamsById}
        locked={locked}
      />
    </div>
  );
}

export function BracketView({
  concours,
  stageMatches,
  allMatches,
  teamsById,
  locked,
  compact,
}: {
  concours: Concours;
  stageMatches: Match[];
  allMatches: Match[];
  teamsById: Map<string, Team>;
  locked: boolean;
  compact?: boolean;
}) {
  if (stageMatches.length === 0) {
    return <p className="hint">Pas de parties dans ce tableau.</p>;
  }
  const size = bracketSizeOf(stageMatches);
  const maxRound = Math.max(...stageMatches.map((m) => m.round));
  const hasByes = stageMatches.some((m) => m.round === 0 && isByeMatch(m));
  const byId = new Map(allMatches.map((m) => [m.id, m]));

  const sourceLabel = (ref: string | undefined): string => {
    if (!ref) return 'À déterminer';
    const src = byId.get(ref);
    return src ? `Perdant ${src.stage === 'principal' ? 'P' : ''}${src.position + 1}` : '…';
  };

  const rounds: Match[][] = [];
  for (let r = 0; r <= maxRound; r++) {
    rounds.push(
      stageMatches.filter((m) => m.round === r).sort((a, b) => a.position - b.position),
    );
  }

  return (
    <div className={`bracket-scroll${compact ? ' bracket-compact' : ''}`}>
      <div className="bracket">
        {rounds.map((roundMatches, r) => (
          <div className="bracket-round" key={r}>
            <h4 className="bracket-round-title">{roundLabel(size, r, hasByes)}</h4>
            <div className="bracket-column">
              {roundMatches.map((m) => (
                <div
                  key={m.id}
                  className={`match-box${isByeMatch(m) ? ' match-box-bye' : ''}${
                    m.done ? ' match-box-done' : ''
                  }`}
                >
                  <div className="match-box-rows">
                    <div
                      className={`match-box-row${
                        m.done && winnerOf(m) === m.teamAId ? ' winner' : ''
                      }`}
                    >
                      {m.teamAId ? (
                        <TeamLabel team={teamsById.get(m.teamAId)} compact />
                      ) : m.byeA ? (
                        <span className="team-label team-bye">Exempt</span>
                      ) : m.loserFromA ? (
                        <span className="team-label team-tbd">{sourceLabel(m.loserFromA)}</span>
                      ) : (
                        <span className="team-label team-tbd">À déterminer</span>
                      )}
                      {m.done && !isByeMatch(m) && (
                        <span className="match-box-score">{m.scoreA}</span>
                      )}
                    </div>
                    <div
                      className={`match-box-row${
                        m.done && winnerOf(m) === m.teamBId ? ' winner' : ''
                      }`}
                    >
                      {m.teamBId ? (
                        <TeamLabel team={teamsById.get(m.teamBId)} compact />
                      ) : m.byeB ? (
                        <span className="team-label team-bye">Exempt</span>
                      ) : m.loserFromB ? (
                        <span className="team-label team-tbd">{sourceLabel(m.loserFromB)}</span>
                      ) : (
                        <span className="team-label team-tbd">À déterminer</span>
                      )}
                      {m.done && !isByeMatch(m) && (
                        <span className="match-box-score">{m.scoreB}</span>
                      )}
                    </div>
                  </div>
                  {!compact && !isByeMatch(m) && (!m.done || !locked) && (
                    <div className="match-box-form">
                      <ScoreForm
                        concours={concours}
                        match={m}
                        disabled={locked}
                        editOnly={m.done}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
