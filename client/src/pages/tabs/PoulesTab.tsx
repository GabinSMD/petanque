import { useMemo, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { pouleOutcome, pouleRemaining } from '@shared';
import {
  cancelPoules,
  generatePoules,
  generateTableauFromPoules,
  pouleSummary,
  setMatchTerrain,
  setPouleTerrain,
} from '../../db/actions';
import { ScoreForm } from '../../components/ScoreForm';
import { TeamLabel } from '../../components/TeamLabel';
import { POULE_SLOT_LABELS } from '../../lib/labels';

interface Props {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

export function PoulesTab({ concours, teams, poules, matches }: Props) {
  const [avoidSameClub, setAvoidSameClub] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const activeTeams = teams.filter((t) => !t.forfait);
  const summary = pouleSummary(activeTeams.length);

  const pouleMatches = (p: Poule) => matches.filter((m) => m.pouleId === p.id);
  const outcomes = poules.map((p) => pouleOutcome(p, pouleMatches(p)));
  const completeCount = outcomes.filter((o) => o.complete).length;
  const allComplete = poules.length > 0 && completeCount === poules.length;
  const scoresLocked = concours.status === 'tableau' || concours.status === 'termine';

  const doDraw = async () => {
    setError(null);
    setBusy(true);
    try {
      await generatePoules(concours, avoidSameClub);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tirage impossible');
    } finally {
      setBusy(false);
    }
  };

  const doTableau = async () => {
    setError(null);
    setBusy(true);
    try {
      await generateTableauFromPoules(concours);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Génération impossible');
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (
      window.confirm(
        'Annuler le tirage des poules ? Tous les scores de poules (et le tableau ' +
          'éventuel) seront supprimés.',
      )
    ) {
      await cancelPoules(concours);
    }
  };

  if (concours.status === 'inscriptions') {
    return (
      <div className="tab-content">
        <div className="draw-panel">
          <h2>Tirage des poules</h2>
          <p>
            {activeTeams.length} équipe{activeTeams.length > 1 ? 's' : ''} (hors forfaits)
            {summary ? ` → ${summary}` : ''}
          </p>
          {!summary && activeTeams.length > 0 && (
            <p className="form-error">
              Effectif incompatible avec des poules : ajoutez ou retirez une équipe (4, 6,
              7, 8, 9… équipes).
            </p>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={avoidSameClub}
              onChange={(e) => setAvoidSameClub(e.target.checked)}
            />
            Éviter deux équipes du même club dans une poule
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn-primary"
            disabled={!summary || busy}
            onClick={() => void doDraw()}
          >
            🎲 Tirer les poules
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="toolbar no-print">
        <span className="toolbar-info">
          Poules terminées : {completeCount} / {poules.length}
        </span>
        {error && <span className="form-error">{error}</span>}
        <span className="toolbar-actions">
          <a
            className="btn btn-ghost btn-sm"
            href={`/concours/${concours.id}/imprimer/poules`}
            target="_blank"
            rel="noreferrer"
          >
            🖨 Feuilles de poules
          </a>
          <a
            className="btn btn-ghost btn-sm"
            href={`/concours/${concours.id}/imprimer/parties`}
            target="_blank"
            rel="noreferrer"
          >
            🎫 Tickets de parties
          </a>
          {concours.status === 'poules' && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => void doCancel()}>
                Annuler le tirage
              </button>
              <button
                className="btn btn-primary"
                disabled={!allComplete || busy}
                title={allComplete ? '' : 'Toutes les poules doivent être terminées'}
                onClick={() => void doTableau()}
              >
                Générer le tableau →
              </button>
            </>
          )}
          {scoresLocked && (
            <span className="hint">
              Tableau généré : annulez-le (onglet Tableau) pour corriger les poules.
            </span>
          )}
        </span>
      </div>

      <div className="poule-grid">
        {poules.map((poule, i) => (
          <PouleCard
            key={poule.id}
            concours={concours}
            poule={poule}
            matches={pouleMatches(poule)}
            outcome={outcomes[i]!}
            teamsById={teamsById}
            locked={scoresLocked}
          />
        ))}
      </div>
    </div>
  );
}

function PouleCard({
  concours,
  poule,
  matches,
  outcome,
  teamsById,
  locked,
}: {
  concours: Concours;
  poule: Poule;
  matches: Match[];
  outcome: ReturnType<typeof pouleOutcome>;
  teamsById: Map<string, Team>;
  locked: boolean;
}) {
  const ordered = [...matches].sort((a, b) => a.position - b.position);
  const remaining = pouleRemaining(matches);

  const badge = (teamId: string): string | null => {
    if (outcome.q1 === teamId) return '1er';
    if (outcome.q2 === teamId) return '2e';
    if (outcome.eliminated.includes(teamId)) return 'éliminé';
    return null;
  };

  return (
    <section className={`poule-card${outcome.complete ? ' poule-complete' : ''}`}>
      <header className="poule-card-head">
        <h3>Poule {poule.index}</h3>
        <label className="terrain-label no-print">
          Terrain
          <input
            type="number"
            min={1}
            value={poule.terrain ?? ''}
            placeholder="–"
            onChange={(e) =>
              void setPouleTerrain(poule, e.target.value ? Number(e.target.value) : null)
            }
          />
        </label>
        {outcome.complete ? (
          <span className="tag tag-ok">Terminée</span>
        ) : (
          <span className="tag">{remaining} partie{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}</span>
        )}
      </header>

      <ul className="poule-teams">
        {poule.teamIds.map((tid) => {
          const b = badge(tid);
          return (
            <li key={tid} className={b === 'éliminé' ? 'team-eliminated' : ''}>
              <TeamLabel team={teamsById.get(tid)} />
              {b && b !== 'éliminé' && (
                <span className={`tag ${b === '1er' ? 'tag-ok' : 'tag-info'}`}>
                  Qualifié {b}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <table className="poule-matches">
        <tbody>
          {ordered.map((m) => (
            <tr key={m.id}>
              <td className="match-label">{POULE_SLOT_LABELS[m.pouleSlot ?? ''] ?? ''}</td>
              <td className="match-team">
                <TeamLabel team={m.teamAId ? teamsById.get(m.teamAId) : null} compact />
              </td>
              <td className="match-score">
                <ScoreForm concours={concours} match={m} disabled={locked} />
              </td>
              <td className="match-team match-team-right">
                <TeamLabel team={m.teamBId ? teamsById.get(m.teamBId) : null} compact />
              </td>
              <td className="match-terrain no-print">
                <input
                  type="number"
                  min={1}
                  value={m.terrain ?? ''}
                  placeholder="T"
                  title="Terrain"
                  onChange={(e) =>
                    void setMatchTerrain(m, e.target.value ? Number(e.target.value) : null)
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
