import { useMemo, useRef, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { declarableMatches, matchLabel, pendingMatchesForTeam } from '../lib/matchLabel';
import { ScoreForm } from './ScoreForm';
import { TeamLabel } from './TeamLabel';

/**
 * Saisie rapide par numéro de dossard : indispensable dès qu'il y a
 * beaucoup d'équipes (64+). On tape un numéro, la partie en cours de
 * l'équipe s'affiche et on saisit le score sans chercher dans les poules.
 */
export function QuickScore({
  concours,
  teams,
  poules,
  matches,
}: {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}) {
  const [num, setNum] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const byNumber = useMemo(() => new Map(teams.map((t) => [t.number, t])), [teams]);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // N'apparaît que s'il y a des parties à saisir (poules / tableau / rondes).
  const anyDeclarable = declarableMatches(matches).length > 0;
  if (!anyDeclarable) return null;

  const parsed = num.trim() === '' ? null : Number(num.trim());
  const team = parsed !== null && Number.isInteger(parsed) ? byNumber.get(parsed) : undefined;
  const pending = team ? pendingMatchesForTeam(team.id, matches) : [];

  return (
    <div className="quick-score no-print" data-tour="quick-score">
      <form
        className="quick-score-bar"
        onSubmit={(e) => {
          e.preventDefault();
          inputRef.current?.select();
        }}
      >
        <label>
          ⚡ Saisie rapide — n° d'équipe
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={1}
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder="ex. 47"
            autoComplete="off"
          />
        </label>
        {num && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNum('')}>
            Effacer
          </button>
        )}
      </form>

      {parsed !== null && !team && (
        <p className="hint quick-score-msg">Aucune équipe n°{num}.</p>
      )}
      {team && pending.length === 0 && (
        <p className="hint quick-score-msg">
          Équipe n°{team.number} : aucune partie à saisir (déjà jouée, ou en attente d'un
          adversaire).
        </p>
      )}
      {team && pending.length > 0 && (
        <div className="quick-score-matches">
          {pending.map((m) => (
            <QuickScoreRow
              key={m.id}
              concours={concours}
              match={m}
              label={matchLabel(m, poules, matches)}
              teamsById={teamsById}
              onSaved={() => {
                setNum('');
                inputRef.current?.focus();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickScoreRow({
  concours,
  match,
  label,
  teamsById,
  onSaved,
}: {
  concours: Concours;
  match: Match;
  label: string;
  teamsById: Map<string, Team>;
  onSaved: () => void;
}) {
  return (
    <div className="quick-score-row">
      <span className="quick-score-label">
        {label}
        {match.terrain ? ` · Terrain ${match.terrain}` : ''}
      </span>
      <span className="quick-score-teams">
        <TeamLabel team={match.teamAId ? teamsById.get(match.teamAId) : null} compact />
        <ScoreForm concours={concours} match={match} onSaved={onSaved} />
        <TeamLabel team={match.teamBId ? teamsById.get(match.teamBId) : null} compact />
      </span>
    </div>
  );
}
