import { useMemo, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import {
  bracketSizeOf,
  estQualificatif,
  formeCadrage,
  vainqueursManquants,
  isByeMatch,
  pouleOutcome,
  roundLabel,
  toursCadragePossibles,
  winnerOf,
} from '@shared';
import {
  annulerPhasesFinales,
  cancelTableau,
  generateTableauDirect,
  generateTableauFromPoules,
  updateConcours,
  placerVainqueursAction,
} from '../../db/actions';
import { ScoreForm } from '../../components/ScoreForm';
import { SeedPicker } from '../../components/SeedPicker';
import { ProtectionsModal } from '../../components/ProtectionsModal';
import { TeamLabel, teamDisplayName } from '../../components/TeamLabel';
import { isRondesMode } from '../../lib/labels';
import { BilanTirageModal } from '../../components/BilanTirageModal';
import { useBilanAvantTirage } from '../../db/hooks';

interface Props {
  concours: Concours;
  teams: Team[];
  matches: Match[];
  poules: Poule[];
}

export function BracketTab({ concours, teams, matches, poules }: Props) {
  /** Contrôle des inscriptions au tirage (manuel §3.B.6). */
  const bilan = useBilanAvantTirage(concours, teams);
  const [bilanOuvert, setBilanOuvert] = useState(false);
  const [bilanVu, setBilanVu] = useState(false);
  const avecControle = (tirer: () => void): void => {
    if (!bilanVu && bilan && bilan.lignes.length > 0) setBilanOuvert(true);
    else tirer();
  };
  const [stage, setStage] = useState<'principal' | 'consolante' | 'complementaire'>('principal');
  // Protection club appliquée par défaut, comme dans le logiciel fédéral.
  const [protection, setProtection] = useState(true);
  const [groupesOuverts, setGroupesOuverts] = useState(false);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  /**
   * Tour du cadrage (manuel §3.D.11 : « vous devez choisir à quel tour vous
   * voulez faire le cadrage »). C'est une décision de tirage, pas un paramètre
   * du concours : elle se prend ici, effectif connu, et n'a plus de sens après.
   */
  const [tourCadrage, setTourCadrage] = useState(0);

  /**
   * Vainqueurs qui attendent une place au tour suivant (manuel §3.D.1.A). Non
   * nul seulement en retirage **et** tirage à la reprise : sinon ils sont placés
   * au fil des résultats.
   */
  const vainqueursEnAttente = useMemo(
    () => (concours.retirageParTour ? vainqueursManquants(matches, 'principal').length : 0),
    [concours.retirageParTour, matches],
  );

  const doTirerTour = async () => {
    setError(null);
    setBusy(true);
    try {
      await placerVainqueursAction(concours, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tirage impossible');
    } finally {
      setBusy(false);
    }
  };

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
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={concours.retirageParTour ?? false}
                onChange={(e) =>
                  void updateConcours({
                    ...concours,
                    retirageParTour: e.target.checked || undefined,
                  })
                }
              />
              Retirage à chaque tour (manuel §3.D.1.A)
              <span className="hint">
                Les vainqueurs sont tirés au sort dans le tour suivant, comme le logiciel fédéral :
                aucun chemin n'est connu d'avance. Décoché, le tableau est un arbre figé au tirage et
                chaque équipe sait qui elle peut rencontrer.
              </span>
            </label>
            {toursCadragePossibles(activeTeams.length).length > 1 && (
              <label>
                Cadrage
                <select
                  value={tourCadrage}
                  onChange={(e) => setTourCadrage(Number(e.target.value))}
                  disabled={seeds.length > 0}
                >
                  {toursCadragePossibles(activeTeams.length).map((tour) => (
                    <option key={tour} value={tour}>
                      {tour === 0
                        ? `Au 1er tour — ${formeCadrage(activeTeams.length, 0)[0]!.exempts} équipes exemptes`
                        : `Au tour ${tour + 1} — tout le monde joue ${tour} partie${tour > 1 ? 's' : ''} d'abord`}
                    </option>
                  ))}
                </select>
                <small>
                  {seeds.length > 0
                    ? 'Indisponible avec des têtes de série : leurs positions supposent un tableau plein.'
                    : 'Différer le cadrage évite qu\'une partie des équipes passe un tour sans jouer.'}
                </small>
              </label>
            )}
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
              onClick={() => avecControle(() => {
                setBusy(true);
                setError(null);
                generateTableauDirect(concours, !protection, seeds, tourCadrage)
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : 'Tirage impossible'),
                  )
                  .finally(() => setBusy(false));
              })}
            >
              🎲 Tirer le tableau
            </button>
            {bilanOuvert && bilan && (
              <BilanTirageModal
                bilan={bilan}
                concoursId={concours.id}
                onCorriger={() => setBilanOuvert(false)}
                onTirer={() => {
                  setBilanOuvert(false);
                  setBilanVu(true);
                  setBusy(true);
                  setError(null);
                  generateTableauDirect(concours, !protection, seeds, tourCadrage)
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : 'Tirage impossible'),
                    )
                    .finally(() => setBusy(false));
                }}
              />
            )}
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

  /**
   * Après un concours en rondes, les trois tableaux ne sont pas un principal
   * et ses repêchages mais les concours A, B et C du manuel §3.D.15 : chaque
   * tranche du classement joue son propre tableau.
   */
  /**
   * Trois tableaux nommés A, B et C : après des rondes (phases finales,
   * §3.D.15) comme en formule par groupes (§3.D.5), ce ne sont pas un principal
   * et ses repêchages mais trois concours distincts.
   */
  const finales = isRondesMode(concours.mode) || concours.parGroupes === true;
  const libelleStage: Record<'principal' | 'consolante' | 'complementaire', string> = finales
    ? { principal: 'Concours A', consolante: 'Concours B', complementaire: 'Concours C' }
    : { principal: 'Concours principal', consolante: 'Consolante', complementaire: 'Complémentaire' };

  return (
    <div className="tab-content">
      <div className="toolbar no-print">
        {consolante.length > 0 && (
          <span className="stage-tabs">
            <button
              className={stage === 'principal' ? 'tab active' : 'tab'}
              onClick={() => setStage('principal')}
            >
              {libelleStage.principal}
            </button>
            <button
              className={stage === 'consolante' ? 'tab active' : 'tab'}
              onClick={() => setStage('consolante')}
            >
              {libelleStage.consolante}
            </button>
            {complementaire.length > 0 && (
              <button
                className={stage === 'complementaire' ? 'tab active' : 'tab'}
                onClick={() => setStage('complementaire')}
              >
                {libelleStage.complementaire}
              </button>
            )}
          </span>
        )}
        <span className="toolbar-actions">
          {vainqueursEnAttente > 0 && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void doTirerTour()}>
              🎲 Tirer {vainqueursEnAttente} place{vainqueursEnAttente > 1 ? 's' : ''} du tour suivant
            </button>
          )}
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
                const msg = finales
                  ? 'Annuler les phases finales ? Leurs scores seront supprimés et le concours revient aux rondes.'
                  : 'Annuler le tableau ? Tous les scores du tableau seront supprimés.';
                if (window.confirm(msg)) {
                  void (finales ? annulerPhasesFinales(concours) : cancelTableau(concours));
                }
              }}
            >
              {finales ? 'Annuler les phases finales' : 'Annuler le tableau'}
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
          🏆 Vainqueur{stage !== 'principal' ? ` du ${libelleStage.principal.toLowerCase()}` : ''} :{' '}
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
  /**
   * Un qualificatif s'arrête avant la finale : parler de « demi-finales »
   * serait faux. On numérote les tours, et le dernier s'appelle par ce qu'il
   * décide — la qualification.
   */
  const qualificatif = estQualificatif(stageMatches, stageMatches[0]!.stage);
  const libelleTour = (r: number): string =>
    qualificatif
      ? r === maxRound
        ? 'Qualification'
        : `Tour ${r + 1}`
      : roundLabel(size, r, hasByes);
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
                <span className="bracket-round-collapsed-title">{libelleTour(r)}</span>
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
              {libelleTour(r)}
            </h4>
            <div className="bracket-column">
              {/* Les exempts quittent la colonne pour un bloc unique en bas :
                  éparpillés, ils rendent l'annonce au micro impossible. Le
                  tirage n'est pas touché — seul l'affichage change. */}
              {roundMatches
                .filter((m) => !isByeMatch(m))
                .map((m) => (
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

              {/* Un seul bloc d'exempts, à annoncer d'une phrase. */}
              {(() => {
                const exempts = roundMatches.filter((m) => isByeMatch(m));
                if (exempts.length === 0) return null;
                const noms = exempts
                  .map((m) => {
                    const id = m.byeA ? m.teamBId : m.teamAId;
                    const equipe = id ? teamsById.get(id) : undefined;
                    if (equipe) return `n°${equipe.number}`;
                    const ref = m.qualifFromA ?? m.qualifFromB;
                    return ref ? sourceLabel(ref) : '—';
                  })
                  .join(', ');
                return (
                  <div className="match-box match-box-bye bracket-exempts">
                    <div className="bracket-exempts-titre">
                      Exempts ({exempts.length})
                    </div>
                    <div className="bracket-exempts-liste">{noms}</div>
                  </div>
                );
              })()}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
