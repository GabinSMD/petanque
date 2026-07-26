import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Concours, Match, Poule, Team } from '@shared';
import { pouleOutcome, rondeStandings, rondesTirees, winnerOf } from '@shared';
import { BracketView } from './tabs/BracketTab';
import { SideLabel } from './tabs/RondesTab';
import { StandingsTable } from '../components/StandingsTable';
import { TeamLabel, teamDisplayName } from '../components/TeamLabel';
import {
  FORMAT_LABELS,
  MODE_LABELS,
  POULE_SLOT_LABELS,
  STATUS_LABELS,
  formatDateFr,
  isRondesMode,
} from '../lib/labels';

interface PublicData {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
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

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/public/${token}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Erreur ${res.status}`);
        }
        const payload = (await res.json()) as PublicData;
        if (!stop) {
          setData(payload);
          setError(null);
          setUpdatedAt(new Date().toLocaleTimeString('fr-FR'));
        }
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : 'Erreur réseau');
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

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
            {STATUS_LABELS[concours.status]}
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
