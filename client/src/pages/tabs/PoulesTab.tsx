import { useMemo, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import {
  besoinTerrains,
  dureeMinutes,
  pouleGroupOutcome,
  pouleOutcome,
  pouleRemaining,
  qualifiesManquants,
  statistiquesPoules,
  terrainNumeros,
} from '@shared';
import {
  cancelPoules,
  generateConcoursGroupes,
  generatePoules,
  generateTableauFromPoules,
  placerQualifiesAction,
  pouleSummary,
  setMatchRetard,
  setMatchTerrain,
  updateConcours,
} from '../../db/actions';
import { formateurTerrain, type LibelleTerrain } from '../../lib/terrain';
import { ScoreForm } from '../../components/ScoreForm';
import { SeedPicker } from '../../components/SeedPicker';
import { ProtectionsModal } from '../../components/ProtectionsModal';
import { BesoinTerrainsHint } from '../../components/BesoinTerrains';
import { useBilanAvantTirage, useModeFederalActif } from '../../db/hooks';
import { BilanTirageModal } from '../../components/BilanTirageModal';
import { TeamLabel } from '../../components/TeamLabel';
import { POULE_SLOT_LABELS } from '../../lib/labels';

interface Props {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

export function PoulesTab({ concours, teams, poules, matches }: Props) {
  const modeFederal = useModeFederalActif();
  // Protection club appliquée par défaut, comme dans le logiciel fédéral.
  const [protection, setProtection] = useState(true);
  const [groupesOuverts, setGroupesOuverts] = useState(false);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Repli des poules : undefined = défaut (les terminées sont repliées).
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const activeTeams = teams.filter((t) => !t.forfait);
  const summary = pouleSummary(activeTeams.length, concours.nbTerrains);

  const pouleMatches = (p: Poule) => matches.filter((m) => m.pouleId === p.id);
  const outcomes = poules.map((p) => pouleOutcome(p, pouleMatches(p)));
  /**
   * En formule par groupes, un groupe est fini sans barrage : `pouleOutcome`
   * l'attendrait indéfiniment. C'est le bilan par victoires qui fait foi.
   */
  const completeCount = concours.parGroupes
    ? poules.filter((p) => pouleGroupOutcome(p, pouleMatches(p)).complete).length
    : outcomes.filter((o) => o.complete).length;
  const allComplete = poules.length > 0 && completeCount === poules.length;
  const scoresLocked = concours.status === 'tableau' || concours.status === 'termine';
  /**
   * Statistiques des poules (manuel §3.D.1.G) : ce qui n'est pas fini, la plus
   * en retard d'abord, et les barrages prêts à annoncer.
   */
  const stats = statistiquesPoules(poules, matches);
  const maintenant = new Date().toISOString();

  /**
   * Contrôle des inscriptions au tirage (manuel §3.B.6) : le bilan est présenté
   * avant de tirer, et une seule fois — l'organisateur voit, puis décide. Il ne
   * bloque pas : le manuel non plus.
   */
  const bilan = useBilanAvantTirage(concours, teams);
  const [bilanOuvert, setBilanOuvert] = useState(false);
  const [bilanVu, setBilanVu] = useState(false);

  const avecControle = (tirer: () => void): void => {
    if (!bilanVu && bilan && bilan.lignes.length > 0) setBilanOuvert(true);
    else tirer();
  };

  const doDraw = async () => {
    setError(null);
    setBusy(true);
    try {
      await generatePoules(concours, !protection, seeds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tirage impossible');
    } finally {
      setBusy(false);
    }
  };

  const doTableau = async () => {
    setError(null);
    setBusy(true);
    try {
      // Formule par groupes : trois concours d'un coup, pas un tableau et sa
      // consolante (manuel §3.D.5).
      if (concours.parGroupes) await generateConcoursGroupes(concours);
      else await generateTableauFromPoules(concours);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Génération impossible');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Qualifiés connus qui n'ont pas encore de place au tableau. Non nul
   * seulement en « tirage à la reprise » : sinon ils entrent au fil de l'eau.
   */
  const enAttente = useMemo(
    () => (concours.mode === 'poules' ? qualifiesManquants(poules, matches).length : 0),
    [concours.mode, poules, matches],
  );

  const doPlacer = async () => {
    setError(null);
    setBusy(true);
    try {
      await placerQualifiesAction(concours, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Placement impossible');
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (
      window.confirm(
        'Annuler le tirage des poules ? Tous les scores de poules (et le tableau ' +
          'éventuel) seront supprimés.',
      )
    ) {
      await cancelPoules(concours);
    }
  };

  if (concours.status === 'inscriptions') {
    return (
      <div className="tab-content">
        <div className="draw-panel">
          <h2>Tirage des poules</h2>
          <p>
            {activeTeams.length} équipe{activeTeams.length > 1 ? 's' : ''} (hors forfaits)
            {summary ? ` → ${summary}` : ''}
          </p>
          {!summary && activeTeams.length > 0 && (
            <p className="form-error">
              Effectif incompatible avec des poules : ajoutez ou retirez une équipe (4, 6,
              7, 8, 9… équipes).
            </p>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={protection}
              onChange={(e) => setProtection(e.target.checked)}
            />
            Protection : séparer les équipes d'un même club dans une poule
          </label>
          {/* La protection club s'applique toujours ; les groupes de clubs
              sont un raffinement fédéral (manuel §3.B.5 niveau 2). */}
          {(modeFederal || concours.protections?.length) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setGroupesOuverts(true)}
              title="Traiter plusieurs clubs comme un seul au tirage (manuel 3.B.5)"
            >
              🛡 Groupes de protection
              {concours.protections?.length ? ` (${concours.protections.length})` : ''}
            </button>
          )}
          {groupesOuverts && (
            <ProtectionsModal
              concours={concours}
              teams={teams}
              onClose={() => setGroupesOuverts(false)}
            />
          )}
          <SeedPicker teams={teams} seeds={seeds} onChange={setSeeds} />
          {/* Le besoin en terrains se dit avant le tirage, pour tout concours —
              le rapport de contrôle des licences, lui, ne s'ouvre que sur un
              concours fédéral. */}
          <BesoinTerrainsHint
            besoin={besoinTerrains(concours, teams.filter((t) => !t.forfait).length)}
          />
          {error && <p className="form-error">{error}</p>}
          <button
            className="btn btn-primary"
            data-tour="tirer-poules"
            disabled={!summary || busy}
            onClick={() => avecControle(() => void doDraw())}
          >
            🎲 Tirer les poules
          </button>
          {bilanOuvert && bilan && (
            <BilanTirageModal
              bilan={bilan}
              concoursId={concours.id}
              onCorriger={() => setBilanOuvert(false)}
              onTirer={() => {
                setBilanOuvert(false);
                setBilanVu(true);
                void doDraw();
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="toolbar no-print">
        <span className="toolbar-info">
          Poules terminées : {completeCount} / {poules.length}
        </span>
        {error && <span className="form-error">{error}</span>}
        <span className="toolbar-actions">
          {!scoresLocked && (
            <label
              className="checkbox-label checkbox-inline"
              title="Manuel §3.D.1.A : les qualifiés attendent que vous tiriez, au lieu d'entrer au tableau au fil des poules"
            >
              <input
                type="checkbox"
                checked={concours.tirageDiffere ?? false}
                onChange={(e) =>
                  void updateConcours({ ...concours, tirageDiffere: e.target.checked || undefined })
                }
              />
              ⏸ Tirage à la reprise
            </label>
          )}
          {enAttente > 0 && (
            <button
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => void doPlacer()}
            >
              🎲 Placer {enAttente} qualifié{enAttente > 1 ? 's' : ''}
            </button>
          )}
          {poules.length > 4 && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setOverrides(Object.fromEntries(poules.map((p) => [p.id, false])))
                }
              >
                Tout déplier
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setOverrides({})}
                title="Replie les poules terminées"
              >
                Replier les terminées
              </button>
            </>
          )}
          <a
            className="btn btn-ghost btn-sm"
            href={`/concours/${concours.id}/imprimer/poules`}
            target="_blank"
            rel="noreferrer"
          >
            🖨 Feuilles de poules
          </a>
          <a
            className="btn btn-ghost btn-sm"
            href={`/concours/${concours.id}/imprimer/parties`}
            target="_blank"
            rel="noreferrer"
          >
            🎫 Tickets de parties
          </a>
          {concours.status === 'poules' && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => void doCancel()}>
                Annuler le tirage
              </button>
              <button
                className="btn btn-primary"
                disabled={!allComplete || busy}
                title={
                  allComplete
                    ? concours.parGroupes
                      ? 'Tire les concours A, B et C depuis les groupes'
                      : 'Clôture les poules et lance la consolante'
                    : concours.parGroupes
                      ? 'Tous les groupes doivent être terminés'
                      : 'Toutes les poules doivent être terminées'
                }
                onClick={() => void doTableau()}
              >
                {concours.parGroupes ? 'Tirer les concours A, B et C →' : 'Clôturer les poules →'}
              </button>
            </>
          )}
          {concours.status === 'poules' && (
            <span className="hint">
              Les qualifiés entrent au tableau au fil des poules : l'onglet Tableau se remplit
              sans attendre la dernière.
            </span>
          )}
          {scoresLocked && (
            <span className="hint">
              Poules clôturées : annulez le tableau pour les corriger.
            </span>
          )}
        </span>
      </div>

      {/* Statistiques des poules (manuel §3.D.1.G) : sur trente poules, c'est
          ce qui permet de trouver la retardataire sans tout parcourir. */}
      {stats.length > 0 && concours.status === 'poules' && (
        <details className="stats-poules no-print" open={stats.length <= 6}>
          <summary>
            🔍 {stats.length} poule{stats.length > 1 ? 's' : ''} en cours
            {stats.some((s) => s.barragePret) && (
              <span className="tag tag-warn">
                {stats.filter((s) => s.barragePret).length} barrage
                {stats.filter((s) => s.barragePret).length > 1 ? 's' : ''} à jouer
              </span>
            )}
          </summary>
          <ul className="stats-poules-liste">
            {stats.map((s) => {
              const minutes = s.depuis ? dureeMinutes(s.depuis, maintenant) : null;
              return (
                <li key={s.poule.id}>
                  <strong>Poule {s.poule.index}</strong>{' '}
                  <span className="hint">
                    {s.restantes} partie{s.restantes > 1 ? 's' : ''} à jouer
                  </span>
                  {s.barragePret && <span className="tag tag-warn">barrage à jouer</span>}
                  {minutes !== null && minutes > 0 && (
                    <span className="hint"> — en attente depuis {minutes} min</span>
                  )}
                  {s.depuis === null && <span className="hint"> — rien d'annoncé</span>}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <div className="poule-grid">
        {poules.map((poule, i) => {
          const outcome = outcomes[i]!;
          const collapsed = overrides[poule.id] ?? outcome.complete;
          return (
            <PouleCard
              key={poule.id}
              concours={concours}
              poule={poule}
              matches={pouleMatches(poule)}
              outcome={outcome}
              teamsById={teamsById}
              locked={scoresLocked}
              collapsed={collapsed}
              onToggle={() =>
                setOverrides((o) => ({ ...o, [poule.id]: !collapsed }))
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Terrain d'une partie de poule : sélecteur compact avec l'option « Terrain
 * libre » et les terrains disponibles. L'affectation fine (plan, affectation
 * auto) reste dans l'onglet Terrains, mais on peut assigner ou libérer
 * rapidement ici. Une fois le concours clôturé, on n'affiche que le terrain.
 */
/**
 * Heure d'annonce et signalement de retard, à même la partie — c'est là que
 * regarde la table de marque (manuel §3.D.1.D, l'outil « montre »). Le
 * panneau récapitulatif vit dans l'onglet Terrains, qui peut être masqué :
 * cette bascule doit donc rester ici.
 */
function MatchRetard({ match, locked }: { match: Match; locked: boolean }) {
  if (!match.lanceeA) return null;
  const heure = new Date(match.lanceeA).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <span className="pmatch-annonce">
      <span className="terrain-heure" title="Heure d'annonce de la partie">
        ⏱ {heure}
      </span>
      {!locked && !match.done && (
        <button
          className={match.retard ? 'btn-icon btn-icon-danger' : 'btn-icon'}
          title={
            match.retard
              ? 'Lever le retard'
              : 'Signaler un retard : le résultat n\'a pas été annoncé'
          }
          onClick={() => void setMatchRetard(match, !match.retard)}
        >
          ⏰
        </button>
      )}
    </span>
  );
}

function PouleMatchTerrain({
  match,
  locked,
  nbTerrains,
  decalageTerrain,
  terrain,
}: {
  match: Match;
  locked: boolean;
  nbTerrains: number;
  decalageTerrain?: number;
  /** Désigne un terrain comme le concours le demande — « 5 » ou « D ». */
  terrain: LibelleTerrain;
}) {
  // Clôturé : affichage seul (pas de modification).
  if (locked) {
    return match.terrain != null ? (
      <span className="pmatch-terrain pmatch-terrain-set">🟦 Terrain {terrain(match.terrain!)}</span>
    ) : null;
  }

  const plage = terrainNumeros(nbTerrains, decalageTerrain);
  // Un terrain hors plage (saisi avant un changement de paramètre) reste
  // proposé : on ne veut pas faire disparaître une affectation existante.
  const options =
    match.terrain != null && !plage.includes(match.terrain)
      ? [...plage, match.terrain].sort((a, b) => a - b)
      : plage;
  return (
    <label
      className={`pmatch-terrain pmatch-terrain-pick no-print${
        match.terrain != null ? ' has-terrain' : ''
      }`}
    >
      <select
        value={match.terrain ?? ''}
        aria-label="Terrain"
        onChange={(e) =>
          void setMatchTerrain(match, e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">Terrain libre</option>
        {options.map((n) => (
          <option key={n} value={n}>
            {/* La valeur reste le **numéro** : c'est lui qu'on enregistre. Seule
                l'étiquette porte la lettre. */}
            Terrain {terrain(n)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PouleCard({
  concours,
  poule,
  matches,
  outcome,
  teamsById,
  locked,
  collapsed,
  onToggle,
}: {
  concours: Concours;
  poule: Poule;
  matches: Match[];
  outcome: ReturnType<typeof pouleOutcome>;
  teamsById: Map<string, Team>;
  locked: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const ordered = [...matches].sort((a, b) => a.position - b.position);
  const remaining = pouleRemaining(matches);

  const badge = (teamId: string): string | null => {
    if (outcome.q1 === teamId) return '1er';
    if (outcome.q2 === teamId) return '2e';
    if (outcome.eliminated.includes(teamId)) return 'éliminé';
    return null;
  };

  return (
    <section
      className={`poule-card${outcome.complete ? ' poule-complete' : ''}${
        collapsed ? ' poule-collapsed' : ''
      }`}
    >
      <header className="poule-card-head">
        <button
          className="poule-toggle no-print"
          onClick={onToggle}
          aria-expanded={!collapsed}
          title={collapsed ? 'Déplier' : 'Replier'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <h3 onClick={onToggle} className="poule-title">
          Poule {poule.index}
        </h3>
        {outcome.complete ? (
          <span className="tag tag-ok">Terminée</span>
        ) : (
          <span className="tag">{remaining} partie{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}</span>
        )}
      </header>

      {collapsed && (
        <p className="poule-collapsed-summary" onClick={onToggle}>
          {outcome.complete && outcome.q1 && outcome.q2 ? (
            <>
              Qualifiés : <strong>n°{teamsById.get(outcome.q1)?.number}</strong> et{' '}
              <strong>n°{teamsById.get(outcome.q2)?.number}</strong>
            </>
          ) : (
            <>
              Équipes n°
              {poule.teamIds.map((id) => teamsById.get(id)?.number).filter(Boolean).join(', ')}
            </>
          )}
        </p>
      )}

      {collapsed ? null : (
      <>
      <ul className="poule-teams">
        {poule.teamIds.map((tid) => {
          const b = badge(tid);
          return (
            <li key={tid} className={b === 'éliminé' ? 'team-eliminated' : ''}>
              <TeamLabel team={teamsById.get(tid)} />
              {b && b !== 'éliminé' && (
                <span className={`tag ${b === '1er' ? 'tag-ok' : 'tag-info'}`}>
                  Qualifié {b}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <ul className="pmatches">
        {ordered.map((m) => (
          <li key={m.id} className={`pmatch${m.done ? ' pmatch-done' : ''}`}>
            <div className="pmatch-head">
              <span className="pmatch-slot">
                {POULE_SLOT_LABELS[m.pouleSlot ?? ''] ?? ''}
              </span>
              <PouleMatchTerrain
                match={m}
                locked={locked}
                nbTerrains={concours.nbTerrains}
                decalageTerrain={concours.decalageTerrain}
                terrain={formateurTerrain(concours)}
              />
              <MatchRetard match={m} locked={locked} />
            </div>
            <div className="pmatch-versus">
              <span className="pmatch-side">
                <TeamLabel team={m.teamAId ? teamsById.get(m.teamAId) : null} compact />
              </span>
              <div className="pmatch-score">
                <ScoreForm
                  concours={concours}
                  match={m}
                  labelA={m.teamAId ? `n°${teamsById.get(m.teamAId)?.number ?? '?'}` : undefined}
                  labelB={m.teamBId ? `n°${teamsById.get(m.teamBId)?.number ?? '?'}` : undefined}
                  disabled={locked}
                />
              </div>
              <span className="pmatch-side pmatch-side-right">
                <TeamLabel team={m.teamBId ? teamsById.get(m.teamBId) : null} compact />
              </span>
            </div>
          </li>
        ))}
      </ul>
      </>
      )}
    </section>
  );
}
