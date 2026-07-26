import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import type { Concours, Match, Poule, Team } from '@shared';
import { pouleOutcome, rondeStandings, rondesTirees, winnerOf } from '@shared';
import { matchLabel, pendingMatchesForTeam, sideName, teamSideInMatch } from '../lib/matchLabel';
import { followedTeams, pushSupported, subscribeForTeams } from '../lib/push';
import { BracketView } from './tabs/BracketTab';
import { SideLabel } from './tabs/RondesTab';
import { StandingsTable } from '../components/StandingsTable';
import { TeamLabel, teamDisplayName } from '../components/TeamLabel';
import { TirRanking } from '../components/TirRanking';
import {
  FORMAT_LABELS,
  MODE_LABELS,
  POULE_SLOT_LABELS,
  formatDateFr,
  isRondesMode,
  isTirMode,
  statusLabel,
} from '../lib/labels';

interface PublicDeclaration {
  matchId: string;
  side: 'A' | 'B';
  scoreA: number;
  scoreB: number;
  createdAt: string;
}

interface PublicData {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
  declarations: PublicDeclaration[];
  generatedAt: string;
}

type PublicMode = 'choose' | 'play' | 'watch';

/**
 * Page publique (QR code) avec deux parcours :
 *  - « Je joue » : on saisit son numéro d'équipe et on ne voit que ce qui
 *    la concerne (sa partie, sa déclaration de score, ses notifications) ;
 *  - « Je consulte » : l'affichage complet des résultats.
 * Aucune authentification ; rafraîchissement automatique.
 */
export function PublicPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<PublicMode>(
    () => (localStorage.getItem(`petanque.pubmode.${token}`) as PublicMode) || 'choose',
  );
  const [teamNumber, setTeamNumber] = useState(
    () => localStorage.getItem(`petanque.pubteam.${token}`) || '',
  );

  const chooseMode = (m: PublicMode) => {
    setMode(m);
    localStorage.setItem(`petanque.pubmode.${token}`, m);
  };
  const changeTeamNumber = (n: string) => {
    setTeamNumber(n);
    localStorage.setItem(`petanque.pubteam.${token}`, n);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/${token}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Erreur ${res.status}`);
      }
      const payload = (await res.json()) as PublicData;
      setData(payload);
      setError(null);
      setUpdatedAt(new Date().toLocaleTimeString('fr-FR'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const teamsById = useMemo(
    () => new Map((data?.teams ?? []).map((t) => [t.id, t])),
    [data?.teams],
  );

  if (error && !data) {
    return (
      <div className="public-page">
        <p className="empty-state">Lien invalide ou révoqué. ({error})</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="public-page">
        <p className="empty-state">Chargement des résultats…</p>
      </div>
    );
  }

  const { concours, matches } = data;
  const principal = matches.filter((m) => m.stage === 'principal');
  const maxRound = principal.length ? Math.max(...principal.map((m) => m.round)) : 0;
  const finale = principal.find((m) => m.round === maxRound && m.position === 0);
  const champion = winnerOf(finale);
  const championTeam = champion ? teamsById.get(champion) : undefined;

  return (
    <div className="public-page">
      <header className="public-head">
        <h1>{concours.name}</h1>
        <p className="concours-meta">
          {formatDateFr(concours.date)}
          {concours.lieu ? ` · ${concours.lieu}` : ''} · {FORMAT_LABELS[concours.format]} ·{' '}
          {MODE_LABELS[concours.mode]}
        </p>
        <p className="public-status">
          <span className={`status-chip status-${concours.status}`}>
            {statusLabel(concours.mode, concours.status)}
          </span>
          {updatedAt && (
            <span className="public-updated">
              Actualisé à {updatedAt}
              {error ? ' (hors ligne)' : ''}
            </span>
          )}
        </p>
      </header>

      {championTeam && (
        <div className="champion-banner">
          🏆 Vainqueur :{' '}
          <strong>
            n°{championTeam.number} {teamDisplayName(championTeam)}
          </strong>
        </div>
      )}

      {mode !== 'choose' && (
        <div className="public-modeswitch no-print">
          <button
            className={mode === 'play' ? 'active' : ''}
            onClick={() => chooseMode('play')}
          >
            🎯 Je joue
          </button>
          <button
            className={mode === 'watch' ? 'active' : ''}
            onClick={() => chooseMode('watch')}
          >
            📺 Je consulte
          </button>
        </div>
      )}

      {mode === 'choose' && (
        <div className="public-chooser">
          <p>Que souhaitez-vous faire ?</p>
          <button className="public-choice" onClick={() => chooseMode('play')}>
            <span className="public-choice-emoji">🎯</span>
            <span>
              <strong>Je joue</strong>
              <small>Ma partie, déclarer mon score, être prévenu·e</small>
            </span>
          </button>
          <button className="public-choice" onClick={() => chooseMode('watch')}>
            <span className="public-choice-emoji">📺</span>
            <span>
              <strong>Je consulte</strong>
              <small>Tous les résultats en direct</small>
            </span>
          </button>
        </div>
      )}

      {mode === 'play' && token && (
        <PlayerPanel
          data={data}
          token={token}
          teamsById={teamsById}
          teamNumber={teamNumber}
          onChangeTeam={changeTeamNumber}
          onDeclared={load}
          onWatch={() => chooseMode('watch')}
        />
      )}

      {mode === 'watch' && <ResultsView data={data} teamsById={teamsById} />}

      <footer className="public-footer">Résultats en direct — Pétanque Concours</footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parcours « Je joue »                                                */
/* ------------------------------------------------------------------ */

function PlayerPanel({
  data,
  token,
  teamsById,
  teamNumber,
  onChangeTeam,
  onDeclared,
  onWatch,
}: {
  data: PublicData;
  token: string;
  teamsById: Map<string, Team>;
  teamNumber: string;
  onChangeTeam: (n: string) => void;
  onDeclared: () => void | Promise<void>;
  onWatch: () => void;
}) {
  const [input, setInput] = useState(teamNumber);
  const byNumber = useMemo(() => new Map(data.teams.map((t) => [t.number, t])), [data.teams]);

  const num = teamNumber.trim() === '' ? null : Number(teamNumber);
  const team = num !== null && Number.isInteger(num) ? byNumber.get(num) : undefined;

  // Étape 1 : saisir son numéro d'équipe.
  if (!team) {
    return (
      <section className="result-section player-ask">
        <h2>🎯 Votre numéro d'équipe</h2>
        <p className="hint">Il figure sur votre ticket / dossard.</p>
        <form
          className="player-ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            onChangeTeam(input.trim());
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ex. 47"
            autoFocus
          />
          <button className="btn btn-primary">Valider</button>
        </form>
        {teamNumber && !team && <p className="form-error">Aucune équipe n°{teamNumber}.</p>}
        <button className="btn btn-ghost btn-block" onClick={onWatch}>
          📺 ou consulter tous les résultats
        </button>
      </section>
    );
  }

  const pending = pendingMatchesForTeam(team.id, data.matches);

  return (
    <>
      <section className="result-section player-me">
        <div className="player-me-head">
          <div>
            <span className="team-number">{team.number}</span>{' '}
            <strong>{teamDisplayName(team)}</strong>
            {team.club && <span className="team-club"> {team.club}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onChangeTeam('')}>
            Changer
          </button>
        </div>
        <NotifyButton token={token} teamNumber={team.number} />
      </section>

      {pending.length === 0 ? (
        <section className="result-section">
          <p className="player-idle">
            🕐 Aucune partie à jouer pour l'instant.
            <br />
            {pushSupported()
              ? 'Activez les notifications ci-dessus : vous serez prévenu·e dès votre prochaine convocation (barrage, tour suivant…).'
              : 'Revenez consulter régulièrement votre prochaine convocation.'}
          </p>
        </section>
      ) : (
        pending.map((m) => (
          <MyMatchDeclare
            key={m.id}
            data={data}
            token={token}
            match={m}
            team={team}
            teamsById={teamsById}
            onDeclared={onDeclared}
          />
        ))
      )}

      <button className="btn btn-ghost btn-block no-print" onClick={onWatch}>
        📺 Voir tous les résultats
      </button>
    </>
  );
}

function NotifyButton({ token, teamNumber }: { token: string; teamNumber: number }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>(
    followedTeams(token).includes(teamNumber) ? 'done' : 'idle',
  );
  const [msg, setMsg] = useState<string | null>(null);

  if (!pushSupported()) {
    return (
      <p className="hint">
        🔔 Les notifications ne sont pas gérées par ce navigateur (essayez Chrome, ou
        installez l'application).
      </p>
    );
  }

  if (state === 'done') {
    return <p className="notify-on">🔔 Notifications activées pour cette équipe.</p>;
  }

  return (
    <div className="notify-box">
      <button
        className="btn btn-primary btn-sm"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          setMsg(null);
          const res = await subscribeForTeams(token, [teamNumber]);
          if (res.ok) {
            setState('done');
          } else {
            setState('error');
            setMsg(res.reason);
          }
        }}
      >
        {state === 'busy' ? '…' : '🔔 Être prévenu·e quand je suis appelé·e'}
      </button>
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}

function MyMatchDeclare({
  data,
  token,
  match,
  team,
  teamsById,
  onDeclared,
}: {
  data: PublicData;
  token: string;
  match: Match;
  team: Team;
  teamsById: Map<string, Team>;
  onDeclared: () => void | Promise<void>;
}) {
  const side = teamSideInMatch(match, team.id)!;
  const [sa, setSa] = useState('');
  const [sb, setSb] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decls = data.declarations.filter((d) => d.matchId === match.id);
  const mine = decls.find((d) => d.side === side);
  const other = decls.find((d) => d.side !== side);
  const agreement = mine && other && mine.scoreA === other.scoreA && mine.scoreB === other.scoreB;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/${token}/declarations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, side, scoreA: Number(sa), scoreB: Number(sb) }),
      });
      const body = (await res.json()) as { error?: string; agreement?: boolean };
      if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
      setMessage(
        body.agreement
          ? '✅ Score confirmé par les deux équipes — la table de marque va le valider.'
          : '📨 Déclaration envoyée — en attente de la confirmation de l\'équipe adverse.',
      );
      await onDeclared();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="result-section declare-card">
      <h2>📣 Votre partie</h2>
      <p className="declare-picked">
        <strong>{matchLabel(match, data.poules, data.matches)}</strong>
        {match.terrain ? ` · Terrain ${match.terrain}` : ''}
        <br />
        {sideName(match, 'A', teamsById)} <em>contre</em> {sideName(match, 'B', teamsById)}
      </p>
      <form className="declare-form" onSubmit={(e) => void submit(e)}>
        <p className="hint">Votre partie est finie ? Déclarez le score :</p>
        <div className="declare-scores">
          <label className={side === 'A' ? 'declare-mine' : ''}>
            {sideName(match, 'A', teamsById)}
            {side === 'A' && ' (vous)'}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              value={sa}
              onChange={(e) => setSa(e.target.value)}
              required
            />
          </label>
          <span className="score-sep">–</span>
          <label className={side === 'B' ? 'declare-mine' : ''}>
            {sideName(match, 'B', teamsById)}
            {side === 'B' && ' (vous)'}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              value={sb}
              onChange={(e) => setSb(e.target.value)}
              required
            />
          </label>
        </div>
        <button className="btn btn-primary" disabled={busy}>
          Envoyer la déclaration
        </button>
      </form>
      {message && <p className="import-message">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      {(mine || other) && (
        <p className="declare-state">
          {mine ? `Vous : ${mine.scoreA}–${mine.scoreB}` : 'Vous : pas encore'} ·{' '}
          {other ? `Adverse : ${other.scoreA}–${other.scoreB}` : 'Adverse : en attente'} —{' '}
          {agreement ? (
            <span className="tag tag-ok">✓ concordant</span>
          ) : mine && other ? (
            <span className="tag tag-danger">⚠ divergent</span>
          ) : (
            <span className="tag tag-info">⏳ en attente</span>
          )}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Parcours « Je consulte » — affichage complet                        */
/* ------------------------------------------------------------------ */

function ResultsView({
  data,
  teamsById,
}: {
  data: PublicData;
  teamsById: Map<string, Team>;
}) {
  const { concours, poules, matches } = data;
  const principal = matches.filter((m) => m.stage === 'principal');
  const consolante = matches.filter((m) => m.stage === 'consolante');
  const rondes = isRondesMode(concours.mode);

  return (
    <>
      {concours.status === 'inscriptions' && (
        <section className="result-section">
          <h2>Équipes inscrites ({data.teams.length})</h2>
          <ul className="public-teams">
            {[...data.teams]
              .sort((a, b) => a.number - b.number)
              .map((t) => (
                <li key={t.id}>
                  <TeamLabel team={t} />
                </li>
              ))}
          </ul>
        </section>
      )}

      {poules.length > 0 && (
        <section className="result-section">
          <h2>Poules</h2>
          <div className="public-poules">
            {[...poules]
              .sort((a, b) => a.index - b.index)
              .map((poule) => {
                const pm = matches
                  .filter((m) => m.pouleId === poule.id)
                  .sort((a, b) => a.position - b.position);
                const outcome = pouleOutcome(poule, pm);
                return (
                  <div key={poule.id} className="public-poule">
                    <h3>
                      Poule {poule.index}
                      {poule.terrain ? ` · T${poule.terrain}` : ''}
                      {outcome.complete && ' ✓'}
                    </h3>
                    <ul>
                      {pm.map((m) => (
                        <li key={m.id}>
                          <span className="public-slot">
                            {POULE_SLOT_LABELS[m.pouleSlot ?? ''] ?? ''}
                          </span>
                          <span className="public-match">
                            <TeamLabel
                              team={m.teamAId ? teamsById.get(m.teamAId) : null}
                              compact
                            />
                            <strong className="public-score">
                              {m.done ? `${m.scoreA}–${m.scoreB}` : '·'}
                            </strong>
                            <TeamLabel
                              team={m.teamBId ? teamsById.get(m.teamBId) : null}
                              compact
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {principal.length > 0 && (
        <section className="result-section">
          <h2>Concours principal</h2>
          <BracketView
            concours={concours}
            stageMatches={principal}
            allMatches={matches}
            teamsById={teamsById}
            locked
            compact
          />
        </section>
      )}

      {consolante.length > 0 && (
        <section className="result-section">
          <h2>Consolante</h2>
          <BracketView
            concours={concours}
            stageMatches={consolante}
            allMatches={matches}
            teamsById={teamsById}
            locked
            compact
          />
        </section>
      )}

      {isTirMode(concours.mode) && matches.some((m) => m.stage === 'ronde') && (
        <section className="result-section">
          <h2>Classement du tir de précision</h2>
          <TirRanking teams={data.teams} matches={matches} teamsById={teamsById} />
        </section>
      )}

      {rondes && matches.some((m) => m.stage === 'ronde') && (
        <>
          <section className="result-section">
            <h2>Ronde {rondesTirees(matches.filter((m) => m.stage === 'ronde'))}</h2>
            <ul className="public-ronde">
              {matches
                .filter(
                  (m) =>
                    m.stage === 'ronde' &&
                    m.round === rondesTirees(matches.filter((x) => x.stage === 'ronde')) - 1,
                )
                .sort((a, b) => a.position - b.position)
                .map((m) => (
                  <li key={m.id}>
                    <span className="public-match">
                      <SideLabel match={m} side="A" teamsById={teamsById} />
                      <strong className="public-score">
                        {m.done ? `${m.scoreA}–${m.scoreB}` : 'vs'}
                      </strong>
                      <SideLabel match={m} side="B" teamsById={teamsById} />
                    </span>
                    {m.terrain && <span className="public-slot">T{m.terrain}</span>}
                  </li>
                ))}
            </ul>
          </section>
          <section className="result-section">
            <h2>Classement</h2>
            <StandingsTable
              standings={rondeStandings(data.teams, matches)}
              teamsById={teamsById}
              compact
            />
          </section>
        </>
      )}
    </>
  );
}
