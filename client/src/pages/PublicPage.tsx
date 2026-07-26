import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import type { Concours, Match, Poule, Team } from '@shared';
import { pouleOutcome, rondeStandings, rondesTirees, winnerOf } from '@shared';
import { declarableMatches, matchLabel, sideName } from '../lib/matchLabel';
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

/**
 * Page publique en lecture seule (spectateurs et joueurs, sur téléphone) :
 * aucune authentification, rafraîchissement automatique.
 */
export function PublicPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

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

  const { concours, poules, matches } = data;
  const principal = matches.filter((m) => m.stage === 'principal');
  const consolante = matches.filter((m) => m.stage === 'consolante');
  const maxRound = principal.length ? Math.max(...principal.map((m) => m.round)) : 0;
  const finale = principal.find((m) => m.round === maxRound && m.position === 0);
  const champion = winnerOf(finale);
  const championTeam = champion ? teamsById.get(champion) : undefined;
  const rondes = isRondesMode(concours.mode);

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
              Actualisé à {updatedAt}{error ? ' (hors ligne)' : ''}
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

      {token && (
        <DeclareCard data={data} token={token} teamsById={teamsById} onDeclared={load} />
      )}

      {concours.status === 'inscriptions' && (
        <section className="result-section">
          <h2>Équipes inscrites ({data.teams.length})</h2>
          <ul className="public-teams">
            {data.teams
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
            {poules
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
                    m.round ===
                      rondesTirees(matches.filter((x) => x.stage === 'ronde')) - 1,
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

      <footer className="public-footer">
        Résultats en direct — Pétanque Concours
      </footer>
    </div>
  );
}

/**
 * Auto-arbitrage : chaque équipe déclare son score depuis son téléphone ;
 * quand les deux camps concordent, la table de marque valide en un clic.
 */
function DeclareCard({
  data,
  token,
  teamsById,
  onDeclared,
}: {
  data: PublicData;
  token: string;
  teamsById: Map<string, Team>;
  onDeclared: () => void | Promise<void>;
}) {
  const pending = useMemo(() => declarableMatches(data.matches), [data.matches]);
  const [matchId, setMatchId] = useState('');
  const [side, setSide] = useState<'A' | 'B' | ''>('');
  const [sa, setSa] = useState('');
  const [sb, setSb] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (pending.length === 0 && data.declarations.length === 0) return null;
  const match = pending.find((m) => m.id === matchId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!match || !side) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/${token}/declarations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          side,
          scoreA: Number(sa),
          scoreB: Number(sb),
        }),
      });
      const body = (await res.json()) as { error?: string; agreement?: boolean };
      if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
      setMessage(
        body.agreement
          ? '✅ Les deux équipes concordent — la table de marque va valider le score.'
          : '📨 Déclaration enregistrée — en attente de la confirmation de l\'équipe adverse.',
      );
      setMatchId('');
      setSide('');
      setSa('');
      setSb('');
      await onDeclared();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  const declsByMatch = new Map<string, PublicDeclaration[]>();
  for (const d of data.declarations) {
    declsByMatch.set(d.matchId, [...(declsByMatch.get(d.matchId) ?? []), d]);
  }

  return (
    <section className="result-section declare-card">
      <h2>📣 Déclarer un score</h2>
      <p className="hint">
        Votre partie est finie ? Déclarez le score : quand l'équipe adverse le confirme
        depuis son téléphone, la table de marque n'a plus qu'à valider.
      </p>
      {pending.length > 0 && (
        <form className="declare-form" onSubmit={(e) => void submit(e)}>
          <label>
            Partie
            <select
              value={matchId}
              onChange={(e) => {
                setMatchId(e.target.value);
                setSide('');
              }}
              required
            >
              <option value="">— Choisir la partie —</option>
              {pending.map((m) => (
                <option key={m.id} value={m.id}>
                  {matchLabel(m, data.poules, data.matches)} :{' '}
                  {sideName(m, 'A', teamsById)} / {sideName(m, 'B', teamsById)}
                </option>
              ))}
            </select>
          </label>
          {match && (
            <>
              <label>
                Vous êtes
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as 'A' | 'B')}
                  required
                >
                  <option value="">— Votre équipe —</option>
                  <option value="A">{sideName(match, 'A', teamsById)}</option>
                  <option value="B">{sideName(match, 'B', teamsById)}</option>
                </select>
              </label>
              <div className="declare-scores">
                <label>
                  {sideName(match, 'A', teamsById)}
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
                <label>
                  {sideName(match, 'B', teamsById)}
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
              <button className="btn btn-primary" disabled={busy || !side}>
                Envoyer la déclaration
              </button>
            </>
          )}
        </form>
      )}
      {message && <p className="import-message">{message}</p>}
      {error && <p className="form-error">{error}</p>}

      {declsByMatch.size > 0 && (
        <ul className="declare-status">
          {[...declsByMatch.entries()].map(([mid, decls]) => {
            const m = data.matches.find((x) => x.id === mid);
            if (!m) return null;
            const a = decls.find((d) => d.side === 'A');
            const b = decls.find((d) => d.side === 'B');
            const agreement = a && b && a.scoreA === b.scoreA && a.scoreB === b.scoreB;
            return (
              <li key={mid}>
                <strong>{matchLabel(m, data.poules, data.matches)}</strong> :{' '}
                {a ? `${a.scoreA}–${a.scoreB} (camp A)` : 'camp A en attente'} ·{' '}
                {b ? `${b.scoreA}–${b.scoreB} (camp B)` : 'camp B en attente'} —{' '}
                {agreement ? (
                  <span className="tag tag-ok">✓ concordant, validation en cours</span>
                ) : a && b ? (
                  <span className="tag tag-danger">⚠ divergent</span>
                ) : (
                  <span className="tag tag-info">⏳ en attente de l'adversaire</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
