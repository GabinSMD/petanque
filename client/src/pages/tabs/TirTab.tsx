import { useMemo, useState } from 'react';
import type { Concours, Match, Team } from '@shared';
import { TIR_MAX, seriesTirees, tirStandings } from '@shared';
import {
  ajouterSerieTir,
  annulerDerniereSerie,
  clearTirScore,
  setTirScore,
  updateConcours,
} from '../../db/actions';
import { teamDisplayName } from '../../components/TeamLabel';

interface Props {
  concours: Concours;
  teams: Team[];
  matches: Match[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** Séries de tir de précision : saisie des scores et classement combinés. */
export function TirTab({ concours, teams, matches }: Props) {
  const [error, setError] = useState<string | null>(null);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const serieMatches = matches.filter((m) => m.stage === 'ronde');
  const nbSeries = seriesTirees(serieMatches);
  const planned = concours.nbRondes ?? 2;
  const standings = tirStandings(teams, serieMatches);
  const allDone = serieMatches.length > 0 && serieMatches.every((m) => m.done);
  const locked = concours.status === 'termine';

  const byPlayerAndSerie = useMemo(() => {
    const map = new Map<string, Match>();
    for (const m of serieMatches) {
      if (m.teamAId) map.set(`${m.teamAId}:${m.round}`, m);
    }
    return map;
  }, [serieMatches]);

  const addSerie = async () => {
    setError(null);
    try {
      await ajouterSerieTir(concours);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible');
    }
  };

  if (nbSeries === 0) {
    return (
      <div className="tab-content">
        <div className="draw-panel">
          <h2>Première série</h2>
          <p>
            Chaque tireur réalise une série de 20 boules sur 5 ateliers — {TIR_MAX} points
            maximum. Classement à la meilleure série, départage au total.
          </p>
          <p className="hint">{planned} séries prévues — modifiable dans ⚙ Paramètres.</p>
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn-primary"
            disabled={teams.filter((t) => !t.forfait).length < 1}
            onClick={() => void addSerie()}
          >
            🏹 Ouvrir la série 1
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="toolbar no-print">
        <span className="toolbar-info">
          Série {nbSeries} / {Math.max(planned, nbSeries)}
        </span>
        {error && <span className="form-error">{error}</span>}
        <span className="toolbar-actions">
          {!locked && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (window.confirm(`Annuler la série ${nbSeries} (et ses scores) ?`)) {
                  void annulerDerniereSerie(concours);
                }
              }}
            >
              Annuler la dernière série
            </button>
          )}
          {!locked && (
            <button className="btn btn-primary btn-sm" onClick={() => void addSerie()}>
              🏹 Ouvrir la série {nbSeries + 1}
            </button>
          )}
          {!locked && allDone && nbSeries >= planned && (
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
              onClick={() => void updateConcours({ ...concours, status: 'rondes' })}
            >
              Rouvrir le concours
            </button>
          )}
        </span>
      </div>

      <table className="teams-table tir-table">
        <thead>
          <tr>
            <th></th>
            <th>Tireur</th>
            {Array.from({ length: nbSeries }, (_, i) => (
              <th key={i}>Série {i + 1}</th>
            ))}
            <th title="Meilleure série">Meilleur</th>
            <th title="Somme des séries">Total</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, rank) => {
            const t = teamsById.get(s.id);
            return (
              <tr key={s.id} className={rank < 3 && s.best > 0 ? 'standing-top' : ''}>
                <td className="standing-rank">
                  {s.best > 0 ? (MEDALS[rank] ?? rank + 1) : '—'}
                </td>
                <td>
                  {t ? (
                    <>
                      <span className="team-number">{t.number}</span> {teamDisplayName(t)}
                      {t.forfait && ' (FF)'}
                    </>
                  ) : (
                    '…'
                  )}
                </td>
                {Array.from({ length: nbSeries }, (_, i) => {
                  const m = byPlayerAndSerie.get(`${s.id}:${i}`);
                  return (
                    <td key={i} className="tir-cell">
                      {m ? (
                        <TirScoreInput match={m} locked={locked} onError={setError} />
                      ) : (
                        '—'
                      )}
                    </td>
                  );
                })}
                <td className="standing-wins">{s.best}</td>
                <td>{s.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">
        Barème officiel : 4 boules sur 5 ateliers, chaque boule vaut 0, 1, 3 ou 5 points —
        {TIR_MAX} points maximum par série.
      </p>
    </div>
  );
}

function TirScoreInput({
  match,
  locked,
  onError,
}: {
  match: Match;
  locked: boolean;
  onError: (e: string | null) => void;
}) {
  const save = async (raw: string) => {
    onError(null);
    if (raw === '') {
      if (match.done) await clearTirScore(match);
      return;
    }
    try {
      await setTirScore(match, Number(raw));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Score invalide');
    }
  };

  if (locked) return <span>{match.scoreA ?? '—'}</span>;
  return (
    <input
      key={`${match.id}:${match.scoreA ?? ''}`}
      type="number"
      min={0}
      max={100}
      defaultValue={match.scoreA ?? ''}
      onBlur={(e) => void save(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      aria-label="Score de la série"
    />
  );
}
