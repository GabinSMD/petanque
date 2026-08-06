import { useMemo, useState } from 'react';
import type { Concours, Match, RolePetanque, Team } from '@shared';
import {
  besoinTerrains,
  championnatRondes,
  ecartPartie,
  proposerRondeSupplementaire,
  rondeComplete,
  classementRondes,
  rondesTirees,
} from '@shared';
import { annulerDerniereRonde, setMatchTerrain, tirerRonde, updateConcours } from '../../db/actions';
import { BesoinTerrainsHint } from '../../components/BesoinTerrains';
import { useBilanAvantTirage } from '../../db/hooks';
import { BilanTirageModal } from '../../components/BilanTirageModal';
import { ScoreForm } from '../../components/ScoreForm';
import { StandingsTable } from '../../components/StandingsTable';
import { PhasesFinalesPanel } from '../../components/PhasesFinalesPanel';
import { TeamLabel, teamDisplayName } from '../../components/TeamLabel';
import {
  MODE_INFO,
  ROLE_ABREGE,
  ROLE_LABELS,
  entrantWord,
  isIndividualMode,
} from '../../lib/labels';

interface Props {
  concours: Concours;
  teams: Team[];
  matches: Match[];
}

export function RondesTab({ concours, teams, matches }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const active = teams.filter((t) => !t.forfait);
  const rondeMatches = matches.filter((m) => m.stage === 'ronde');
  const tirees = rondesTirees(rondeMatches);
  const planned =
    concours.mode === 'championnat'
      ? tirees > 0
        ? tirees
        : Math.min(
            championnatRondes(Math.max(active.length, 2)),
            concours.nbRondes ?? Number.POSITIVE_INFINITY,
          )
      : (concours.nbRondes ?? 4);
  const currentComplete = tirees > 0 && rondeComplete(rondeMatches, tirees - 1);
  const allDone = tirees >= planned && currentComplete && rondeMatches.every((m) => m.done);
  const standings = classementRondes(concours, teams, rondeMatches);
  const locked = concours.status === 'termine';

  /**
   * Rôles déclarés chez les inscrits. Affiché avant le tirage : un organisateur
   * qui voit « 9 pointeurs, 1 tireur » sait à quoi s'attendre.
   */
  const bilanRoles = useMemo(() => {
    if (concours.mode !== 'melee' || concours.format === 'tete_a_tete') return null;
    const compte = new Map<RolePetanque, number>();
    let sansRole = 0;
    for (const t of active) {
      const role = t.players[0]?.role;
      if (role) compte.set(role, (compte.get(role) ?? 0) + 1);
      else sansRole += 1;
    }
    if (compte.size === 0) return null;
    const parts = [...compte].map(([r, n]) => `${n} ${ROLE_LABELS[r].toLowerCase()}${n > 1 ? 's' : ''}`);
    if (sansRole > 0) parts.push(`${sansRole} sans rôle`);
    return parts.join(', ');
  }, [active, concours.mode, concours.format]);

  /**
   * Les phases finales n'ont de sens que là où les inscrits sont des équipes.
   * En mêlée, un tableau opposerait un joueur à un joueur : le classement
   * individuel est le résultat du concours.
   */
  const peutFinales =
    (concours.mode === 'suisse' || concours.mode === 'championnat') && !locked;

  /**
   * Partie supplémentaire (manuel §3.D.14.A) : la question se pose à la
   * première saisie de la dernière ronde prévue, quand l'organisateur voit
   * l'heure qu'il est et l'état des terrains. Une seule fois par ronde — la
   * ronde déjà proposée est retenue le temps de la séance.
   */
  const [proposeeSur, setProposeeSur] = useState<number | null>(null);
  const auSauve = (m: Match): void => {
    if (concours.mode === 'championnat') return; // calendrier fixe, rien à ajouter
    const dejaSaisis = rondeMatches.filter(
      (x) => x.round === m.round && x.id !== m.id && x.done && !x.byeB,
    ).length;
    const proposer = proposerRondeSupplementaire({
      rondesTirees: tirees,
      rondesPrevues: planned,
      rondeSaisie: m.round,
      scoresDejaSaisis: dejaSaisis,
    });
    if (proposer && proposeeSur !== m.round) setProposeeSur(m.round);
  };

  /** Contrôle des inscriptions au premier tirage (manuel §3.B.6). */
  const bilan = useBilanAvantTirage(concours, teams);
  const [bilanOuvert, setBilanOuvert] = useState(false);
  const [bilanVu, setBilanVu] = useState(false);
  const avecControle = (tirer: () => void): void => {
    if (tirees === 0 && !bilanVu && bilan && bilan.lignes.length > 0) setBilanOuvert(true);
    else tirer();
  };

  const doTirer = async () => {
    setError(null);
    setBusy(true);
    try {
      await tirerRonde(concours);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tirage impossible');
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------- Aucune ronde tirée ------------------------- */

  if (tirees === 0) {
    return (
      <div className="tab-content">
        <div className="draw-panel">
          <h2>{concours.mode === 'championnat' ? 'Calendrier du championnat' : 'Première ronde'}</h2>
          <p>
            {active.length} {entrantWord(concours.mode, active.length > 1)} (hors forfaits).{' '}
            {MODE_INFO[concours.mode].description}
          </p>
          {concours.mode !== 'championnat' ? (
            <p className="hint">
              {planned} rondes prévues — modifiable dans ⚙ Paramètres.
              {concours.mode === 'suisse' && concours.ggStrict
                ? ' Appariement strict : seules des équipes à égalité de victoires se rencontrent, avec des exempts si un groupe est impair.'
                : ''}
            </p>
          ) : (
            concours.nbRondes !== undefined && (
              <p className="hint">
                Marathon : {planned} ronde{planned > 1 ? 's' : ''} au lieu de{' '}
                {championnatRondes(Math.max(active.length, 2))} pour le calendrier complet —
                modifiable dans ⚙ Paramètres.
              </p>
            )
          )}
          {bilanRoles && (
            <p className="hint">
              Rôles déclarés : {bilanRoles}. Le tirage évite de réunir deux fois le même rôle dans
              une équipe.
            </p>
          )}
          {/* Même annonce qu'en poules : le besoin en terrains vaut pour tout
              concours, fédéral ou non. */}
          <BesoinTerrainsHint besoin={besoinTerrains(concours, active.length)} />
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn-primary"
            disabled={active.length < 2 || busy}
            onClick={() => avecControle(() => void doTirer())}
          >
            🎲 {concours.mode === 'championnat' ? 'Générer le calendrier' : 'Tirer la ronde 1'}
          </button>
          {bilanOuvert && bilan && (
            <BilanTirageModal
              bilan={bilan}
              concoursId={concours.id}
              onCorriger={() => setBilanOuvert(false)}
              onTirer={() => {
                setBilanOuvert(false);
                setBilanVu(true);
                void doTirer();
              }}
            />
          )}
        </div>
      </div>
    );
  }

  /* --------------------------- Rondes en cours -------------------------- */

  const rondes: Match[][] = [];
  for (let r = tirees - 1; r >= 0; r--) {
    rondes.push(rondeMatches.filter((m) => m.round === r).sort((a, b) => a.position - b.position));
  }

  return (
    <div className="tab-content">
      {proposeeSur !== null && (
        <div className="banner-warn no-print">
          Dernière ronde prévue en cours. Une partie de plus ?{' '}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              void updateConcours({ ...concours, nbRondes: planned + 1 });
              setProposeeSur(null);
            }}
          >
            Ajouter une {planned + 1}
            <sup>e</sup> ronde
          </button>{' '}
          <button className="btn btn-sm btn-ghost" onClick={() => setProposeeSur(null)}>
            Non, on s'arrête là
          </button>
        </div>
      )}
      <div className="toolbar no-print">
        <span className="toolbar-info">
          Ronde {tirees} / {planned}
          {currentComplete ? ' — terminée' : ''}
        </span>
        {error && <span className="form-error">{error}</span>}
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
                const msg =
                  concours.mode === 'championnat'
                    ? 'Annuler tout le calendrier du championnat (et ses scores) ?'
                    : `Annuler la ronde ${tirees} (et ses scores) ?`;
                if (window.confirm(msg)) void annulerDerniereRonde(concours);
              }}
            >
              {concours.mode === 'championnat' ? 'Annuler le calendrier' : 'Annuler la dernière ronde'}
            </button>
          )}
          {!locked && concours.mode !== 'championnat' && tirees < planned && (
            <button
              className="btn btn-primary"
              disabled={!currentComplete || busy}
              title={currentComplete ? '' : 'Terminez la ronde en cours'}
              onClick={() => void doTirer()}
            >
              🎲 Tirer la ronde {tirees + 1}
            </button>
          )}
          {!locked && allDone && (
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

      {peutFinales && currentComplete && (
        <PhasesFinalesPanel concours={concours} teams={teams} matches={matches} />
      )}

      <div className="rondes-layout">
        <div className="rondes-matches">
          {rondes.map((ms, idx) => {
            const num = tirees - idx;
            const complete = ms.every((m) => m.done);
            return (
              <section key={num} className="ronde-section">
                <h3 className="ronde-title">
                  Ronde {num}{' '}
                  {complete ? (
                    <span className="tag tag-ok">terminée</span>
                  ) : (
                    <span className="tag">{ms.filter((m) => !m.done).length} à saisir</span>
                  )}
                </h3>
                <table className="poule-matches ronde-table">
                  <tbody>
                    {ms.map((m) => (
                      <tr key={m.id}>
                        <td className="match-team">
                          <SideLabel match={m} side="A" teamsById={teamsById} avecEcart />
                        </td>
                        <td className="match-score">
                          <ScoreForm
                            concours={concours}
                            match={m}
                            disabled={locked}
                            onSaved={() => auSauve(m)}
                          />
                        </td>
                        <td className="match-team match-team-right">
                          <SideLabel match={m} side="B" teamsById={teamsById} avecEcart />
                        </td>
                        <td className="match-terrain no-print">
                          {!m.byeB && (
                            <input
                              type="number"
                              min={1}
                              value={m.terrain ?? ''}
                              placeholder="T"
                              title="Terrain"
                              onChange={(e) =>
                                void setMatchTerrain(
                                  m,
                                  e.target.value ? Number(e.target.value) : null,
                                )
                              }
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>

        <aside className="rondes-standings">
          <h3>
            Classement {isIndividualMode(concours.mode) ? 'individuel' : ''}
            <span className="hint">
              {' '}
              — victoires, goal-average, puis confrontation directe
            </span>
          </h3>
          <StandingsTable standings={standings} teamsById={teamsById} />
        </aside>
      </div>
    </div>
  );
}

/** Côté d'une partie de ronde : équipe classique ou joueurs tirés (mêlée). */
export function SideLabel({
  match,
  side,
  teamsById,
  avecEcart,
}: {
  match: Match;
  side: 'A' | 'B';
  teamsById: Map<string, Team>;
  /**
   * Afficher l'écart de points de la partie (manuel §3.D.14). Optionnel plutôt
   * que d'office : l'affichage grand écran du boulodrome se lit de loin, et un
   * petit chiffre gris n'y apporterait que du bruit.
   */
  avecEcart?: boolean;
}) {
  const bye = side === 'A' ? match.byeA : match.byeB;
  if (bye) return <span className="team-label team-bye">Exempt</span>;

  const ecart = avecEcart ? ecartPartie(match, side) : undefined;

  const players = side === 'A' ? match.playersA : match.playersB;
  if (players && players.length > 0) {
    return (
      <span className="melee-side">
        {players.map((id) => {
          const t = teamsById.get(id);
          return (
            <span key={id} className="melee-player">
              {t ? teamDisplayName(t) : '…'}
              {t?.players[0]?.role && (
                <span className="role-tag" title={ROLE_LABELS[t.players[0].role]}>
                  {ROLE_ABREGE[t.players[0].role]}
                </span>
              )}
            </span>
          );
        })}
        {/* En mêlée il n'y a pas de dossard de camp : l'écart se met après la
            liste. Il vaut pour chacun de ses joueurs, que `rondeStandings`
            crédite individuellement du score du camp. */}
        {ecart !== undefined && (
          <span className="team-ecart" title="Écart de points de cette partie">
            ({ecart})
          </span>
        )}
      </span>
    );
  }

  const teamId = side === 'A' ? match.teamAId : match.teamBId;
  return <TeamLabel team={teamId ? teamsById.get(teamId) : null} compact ecart={ecart} />;
}
