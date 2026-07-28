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
import { SeedPicker } from '../../components/SeedPicker';
import { ProtectionsModal } from '../../components/ProtectionsModal';
import { TeamLabel, teamDisplayName } from '../../components/TeamLabel';

interface Props {
  concours: Concours;
  teams: Team[];
  matches: Match[];
  poules: Poule[];
}

export function BracketTab({ concours, teams, matches, poules }: Props) {
  const [stage, setStage] = useState<'principal' | 'consolante' | 'complementaire'>('principal');
  // Protection club appliquée par défaut, comme dans le logiciel fédéral.
  const [protection, setProtection] = useState(true);
  const [groupesOuverts, setGroupesOuverts] = useState(false);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const principal = matches.filter((m) => m.stage === 'principal');
  const consolante = matches.filter((m) => m.stage === 'consolante');
  const complementaire = matches.filter((m) => m.stage === 'complementaire');
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
                checked={protection}
                onChange={(e) => setProtection(e.target.checked)}
              />
              Protection : séparer les équipes d'un même club au premier tour
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setGroupesOuverts(true)}
              title="Traiter plusieurs clubs comme un seul au tirage (manuel 3.B.5)"
            >
              🛡 Groupes de protection
              {concours.protections?.length ? ` (${concours.protections.length})` : ''}
            </button>
            {groupesOuverts && (
              <ProtectionsModal
                concours={concours}
                teams={teams}
                onClose={() => setGroupesOuverts(false)}
              />
            )}
            <SeedPicker teams={teams} seeds={seeds} onChange={setSeeds} />
            {error && <p className="form-error">{error}</p>}
            <button
              className="btn btn-primary"
              disabled={activeTeams.length < 2 || busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                generateTableauDirect(concours, !protection, seeds)
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

  const shownMatches =
    stage === 'principal' ? principal : stage === 'consolante' ? consolante : complementaire;

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
            {complementaire.length > 0 && (
              <button
                className={stage === 'complementaire' ? 'tab active' : 'tab'}
                onClick={() => setStage('complementaire')}
              >
                Complémentaire
              </button>
            )}
          </span>
        )}
        <span className="toolbar-actions">
          <a
            className="btn btn-ghost btn-sm"
            href={`/concours/${concours.id}/imprimer/parties`}
            target="_blank"
            rel="noreferrer"
          >
            🎫 Tickets de parties
          </a>
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
          🏆 Vainqueur{stage !== 'principal' ? ' du principal' : ''} :{' '}
          <strong>
            n°{championTeam.number} {teamDisplayName(championTeam)}
          </strong>
        </div>
      )}

      <BracketView
        poules={poules}
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
  poules = [],
  locked,
  compact,
}: {
  concours: Concours;
  stageMatches: Match[];
  allMatches: Match[];
  teamsById: Map<string, Team>;
  /** Pour nommer les places réservées à un qualifié (« 1ᵉʳ de poule 3 »). */
  poules?: Poule[];
  locked: boolean;
  compact?: boolean;
}) {
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set());
  const toggleRound = (r: number) =>
    setCollapsedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  if (stageMatches.length === 0) {
    return <p className="hint">Pas de parties dans ce tableau.</p>;
  }
  const size = bracketSizeOf(stageMatches);
  const maxRound = Math.max(...stageMatches.map((m) => m.round));
  const hasByes = stageMatches.some((m) => m.round === 0 && isByeMatch(m));
  const byId = new Map(allMatches.map((m) => [m.id, m]));

  const sourceLabel = (ref: string | undefined): string => {
    if (!ref) return 'À déterminer';
    // Place réservée à un qualifié de poule : on dit laquelle, c'est plus
    // parlant à la table de marque qu'un « à déterminer ».
    if (ref.includes(':')) {
      const [pouleId, rang] = ref.split(':');
      const poule = poules.find((p) => p.id === pouleId);
      return `${rang === '2' ? '2ᵉ' : '1ᵉʳ'} de poule ${poule?.index ?? '?'}`;
    }
    const src = byId.get(ref);
    if (!src) return '…';
    const prefix = src.stage === 'principal' ? 'P' : '';
    // Avec les formules à récupération, un repêché peut venir d'un tour plus
    // avancé : sans le tour, « Perdant P3 » serait ambigu.
    const tour = src.round > 0 ? ` (${src.round + 1}ᵉ tour)` : '';
    return `Perdant ${prefix}${src.position + 1}${tour}`;
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
        {rounds.map((roundMatches, r) => {
          if (collapsedRounds.has(r)) {
            const remaining = roundMatches.filter((m) => !m.done && !isByeMatch(m)).length;
            return (
              <button
                key={r}
                className="bracket-round-collapsed no-print"
                onClick={() => toggleRound(r)}
                title="Déplier ce tour"
              >
                <span className="bracket-round-collapsed-title">
                  {roundLabel(size, r, hasByes)}
                </span>
                <span className="bracket-round-collapsed-meta">
                  ▸ {roundMatches.length} partie{roundMatches.length > 1 ? 's' : ''}
                  {remaining > 0 ? ` · ${remaining} à jouer` : ' · terminé'}
                </span>
              </button>
            );
          }
          return (
          <div className="bracket-round" key={r}>
            <h4 className="bracket-round-title">
              {!compact && rounds.length > 2 && (
                <button
                  className="bracket-collapse-btn no-print"
                  onClick={() => toggleRound(r)}
                  title="Replier ce tour"
                >
                  ▾
                </button>
              )}
              {roundLabel(size, r, hasByes)}
            </h4>
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
                        <span className="team-label team-tbd">
                          {sourceLabel(m.qualifFromA ?? m.loserFromA)}
                        </span>
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
                        <span className="team-label team-tbd">
                          {sourceLabel(m.qualifFromB ?? m.loserFromB)}
                        </span>
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
                        labelA={m.teamAId ? `n°${teamsById.get(m.teamAId)?.number ?? '?'}` : undefined}
                        labelB={m.teamBId ? `n°${teamsById.get(m.teamBId)?.number ?? '?'}` : undefined}
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
          );
        })}
      </div>
    </div>
  );
}
