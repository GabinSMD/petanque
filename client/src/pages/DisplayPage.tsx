import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Match, Poule, Team } from '@shared';
import { pouleOutcome, winnerOf } from '@shared';
import { useConcours, useMatches, usePoules, useTeams } from '../db/hooks';
import { BracketView } from './tabs/BracketTab';
import { teamDisplayName } from '../components/TeamLabel';
import { POULE_SLOT_LABELS, STATUS_LABELS, formatDateFr } from '../lib/labels';

/**
 * Mode affichage public (TV / vidéoprojecteur) : lecture seule,
 * grandes polices, mise à jour automatique via la base locale.
 */
export function DisplayPage() {
  const { id } = useParams<{ id: string }>();
  const concours = useConcours(id);
  const teams = useTeams(id) ?? [];
  const poules = usePoules(id) ?? [];
  const matches = useMatches(id) ?? [];
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (!concours) {
    return (
      <div className="display-page">
        <p>
          Concours introuvable. <Link to="/">Retour</Link>
        </p>
      </div>
    );
  }

  const principal = matches.filter((m) => m.stage === 'principal');
  const consolante = matches.filter((m) => m.stage === 'consolante');
  const maxRound = principal.length
    ? Math.max(...principal.map((m) => m.round))
    : 0;
  const finale = principal.find((m) => m.round === maxRound && m.position === 0);
  const champion = winnerOf(finale);
  const championTeam = champion ? teamsById.get(champion) : undefined;

  return (
    <div className="display-page">
      <header className="display-head">
        <h1>{concours.name}</h1>
        <p>
          {formatDateFr(concours.date)}
          {concours.lieu ? ` · ${concours.lieu}` : ''} · {STATUS_LABELS[concours.status]}
        </p>
        <div className="display-controls no-print">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              void document.documentElement.requestFullscreen?.();
            }}
          >
            ⛶ Plein écran
          </button>
          <Link className="btn btn-ghost btn-sm" to={`/concours/${concours.id}`}>
            ← Gestion
          </Link>
        </div>
      </header>

      {championTeam && (
        <div className="champion-banner display-champion">
          🏆 Vainqueur : n°{championTeam.number} {teamDisplayName(championTeam)}
        </div>
      )}

      {concours.status === 'inscriptions' && (
        <section>
          <h2 className="display-section-title">
            Équipes inscrites ({teams.length})
          </h2>
          <div className="display-teams">
            {teams.map((t) => (
              <div key={t.id} className="display-team">
                <span className="team-number">{t.number}</span> {teamDisplayName(t)}
                {t.club && <span className="team-club"> {t.club}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {concours.status === 'poules' && (
        <DisplayPoules poules={poules} matches={matches} teamsById={teamsById} />
      )}

      {(concours.status === 'tableau' || concours.status === 'termine') && (
        <>
          <section>
            <h2 className="display-section-title">Concours principal</h2>
            <BracketView
              concours={concours}
              stageMatches={principal}
              allMatches={matches}
              teamsById={teamsById}
              locked
              compact
            />
          </section>
          {consolante.length > 0 && (
            <section>
              <h2 className="display-section-title">Consolante</h2>
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
        </>
      )}
    </div>
  );
}

function DisplayPoules({
  poules,
  matches,
  teamsById,
}: {
  poules: Poule[];
  matches: Match[];
  teamsById: Map<string, Team>;
}) {
  return (
    <div className="display-poules">
      {poules.map((poule) => {
        const pm = matches
          .filter((m) => m.pouleId === poule.id)
          .sort((a, b) => a.position - b.position);
        const outcome = pouleOutcome(poule, pm);
        return (
          <section key={poule.id} className="display-poule">
            <h3>
              Poule {poule.index}
              {poule.terrain ? ` — T${poule.terrain}` : ''}
              {outcome.complete && ' ✔'}
            </h3>
            <ul>
              {pm.map((m) => {
                const a = m.teamAId ? teamsById.get(m.teamAId) : undefined;
                const b = m.teamBId ? teamsById.get(m.teamBId) : undefined;
                return (
                  <li key={m.id}>
                    <span className="display-slot">
                      {POULE_SLOT_LABELS[m.pouleSlot ?? ''] ?? ''}
                      {m.terrain ? ` · T${m.terrain}` : ''}
                    </span>
                    <span className="display-match">
                      <span className={m.done && winnerOf(m) === m.teamAId ? 'winner' : ''}>
                        {a ? `${a.number} ${teamDisplayName(a)}` : m.teamBId ? '…' : '…'}
                      </span>
                      <span className="display-score">
                        {m.done ? `${m.scoreA} – ${m.scoreB}` : 'vs'}
                      </span>
                      <span className={m.done && winnerOf(m) === m.teamBId ? 'winner' : ''}>
                        {b ? `${b.number} ${teamDisplayName(b)}` : '…'}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
