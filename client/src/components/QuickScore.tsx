import { CircleCheck, Zap } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { declarableMatches, matchLabel, pendingMatchesForTeam } from '../lib/matchLabel';
import { formateurTerrain } from '../lib/terrain';
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
  /** Dernière partie saisie ici : de quoi confirmer, et corriger sans chercher. */
  const [derniere, setDerniere] = useState<string | null>(null);
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
          <Zap className="ic" aria-hidden /> Saisie rapide — n° d'équipe
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

      {/* Le champ se vide après validation et le score s'affiche ailleurs dans la
          page : sans ce retour, on ne sait pas si la saisie est partie. */}
      {parsed === null && (
        <Confirmation
          concours={concours}
          match={matches.find((m) => m.id === derniere)}
          teamsById={teamsById}
        />
      )}

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
                setDerniere(m.id);
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

function Confirmation({
  concours,
  match,
  teamsById,
}: {
  concours: Concours;
  match: Match | undefined;
  teamsById: Map<string, Team>;
}) {
  if (!match || !match.done) return null;
  const numero = (id: string | null | undefined) =>
    id ? `n°${teamsById.get(id)?.number ?? '?'}` : '—';
  const scores = match.scoreA !== null && match.scoreB !== null;
  const gagnant = !scores
    ? null
    : match.scoreA! > match.scoreB!
      ? match.teamAId
      : match.scoreB! > match.scoreA!
        ? match.teamBId
        : null;
  return (
    <p className="quick-score-ok" role="status">
      <CircleCheck className="ic" aria-hidden />
      <span>
        {scores ? (
          <>
            Score{' '}
            <strong>
              {match.scoreA}–{match.scoreB}
            </strong>{' '}
            enregistré, {numero(match.teamAId)} contre {numero(match.teamBId)}
            {gagnant ? ` : équipe ${numero(gagnant)} gagnante.` : '.'}
          </>
        ) : (
          <>
            Résultat enregistré, {numero(match.teamAId)} contre {numero(match.teamBId)}.
          </>
        )}
      </span>
      <ScoreForm concours={concours} match={match} editOnly />
    </p>
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
  const terrain = formateurTerrain(concours);
  return (
    <div className="quick-score-row">
      <span className="quick-score-label">
        {label}
        {match.terrain ? ` · Terrain ${terrain(match.terrain)}` : ''}
      </span>
      <span className="quick-score-teams">
        <TeamLabel team={match.teamAId ? teamsById.get(match.teamAId) : null} compact />
        <ScoreForm
          concours={concours}
          match={match}
          labelA={match.teamAId ? `n°${teamsById.get(match.teamAId)?.number ?? '?'}` : undefined}
          labelB={match.teamBId ? `n°${teamsById.get(match.teamBId)?.number ?? '?'}` : undefined}
          onSaved={onSaved}
        />
        <TeamLabel team={match.teamBId ? teamsById.get(match.teamBId) : null} compact />
      </span>
    </div>
  );
}
