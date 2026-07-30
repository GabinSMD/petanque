import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Concours, Match, MatchStage, Poule, Team } from '@shared';
import {
  bracketRanking,
  estConcoursOfficiel,
  nomDuBloc,
  estQualificatif,
  pouleOutcome,
  qualifiesTableau,
  repartitionIndemnites,
  rondeStandings,
  type RankGroup,
} from '@shared';
import { updateConcours } from '../../db/actions';
import { useModeFederalActif } from '../../db/hooks';
import { StandingsTable } from '../../components/StandingsTable';
import { PhotosPodium } from '../../components/PhotosPodium';
import { TeamLabel } from '../../components/TeamLabel';
import { TirRanking } from '../../components/TirRanking';
import { isIndividualMode, isRondesMode, isTirMode } from '../../lib/labels';
import {
  exportArbitrageCSV,
  exportQualifiesCSV,
  exportBackupJSON,
  exportClassementCSV,
  exportEngagesCSV,
} from '../../lib/export';

interface Props {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

export function ResultsTab({ concours, teams, poules, matches }: Props) {
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (isTirMode(concours.mode)) {
    const played = matches.some((m) => m.stage === 'ronde' && m.done);
    if (!played) {
      return (
        <div className="tab-content">
          <p className="empty-state">Le classement apparaîtra dès les premières séries saisies.</p>
        </div>
      );
    }
    return (
      <div className="tab-content results">
        <ExportBar concours={concours} teams={teams} poules={poules} matches={matches} />
        <PhotosPodium concours={concours} />
        <section className="result-section">
          <h2>Classement du tir de précision</h2>
          <TirRanking teams={teams} matches={matches} teamsById={teamsById} />
        </section>
      </div>
    );
  }

  if (isRondesMode(concours.mode)) {
    const played = matches.some((m) => m.stage === 'ronde' && m.done);
    if (!played) {
      return (
        <div className="tab-content">
          <p className="empty-state">Le classement apparaîtra dès les premières parties saisies.</p>
        </div>
      );
    }
    // Phases finales jouées (manuel §3.D.15) : ce sont elles qui désignent le
    // vainqueur. Le classement des rondes reste affiché en dessous — c'est lui
    // qui a distribué les équipes entre les concours A, B et C.
    const finales: { stage: MatchStage; titre: string }[] = (
      ['principal', 'consolante', 'complementaire'] as const
    ).map((stage, i) => ({ stage, titre: nomDuBloc(i) }));

    return (
      <div className="tab-content results">
        <ExportBar concours={concours} teams={teams} poules={poules} matches={matches} />
        <PhotosPodium concours={concours} />
        {finales.map(({ stage, titre }) => {
          const groups = bracketRanking(matches, stage);
          if (groups.length === 0) return null;
          return (
            <section className="result-section" key={stage}>
              <h2>{titre}</h2>
              <RankTable groups={groups} teamsById={teamsById} />
            </section>
          );
        })}
        <section className="result-section">
          <h2>
            Classement {matches.some((m) => m.stage !== 'ronde') ? 'des rondes' : 'général'}
            {isIndividualMode(concours.mode) ? ' (individuel)' : ''}
          </h2>
          <StandingsTable
            standings={rondeStandings(teams, matches)}
            teamsById={teamsById}
          />
        </section>
      </div>
    );
  }

  const principalGroups = bracketRanking(matches, 'principal');
  const consolanteGroups = bracketRanking(matches, 'consolante');
  const complementaireGroups = bracketRanking(matches, 'complementaire');
  const outcomes = poules.map((p) =>
    pouleOutcome(p, matches.filter((m) => m.pouleId === p.id)),
  );

  /**
   * Concours qualificatif : les qualifiés sont les vainqueurs du dernier tour
   * du tableau, qui s'arrête là (manuel §3.D.2 et §3.D.7). Sinon on retombe
   * sur les mieux classés, pour un concours joué jusqu'au bout où l'on veut
   * quand même désigner N équipes.
   */
  const qualificatif = estQualificatif(matches, 'principal');
  const qualifiesDuTableau = useMemo(
    () => (qualificatif ? qualifiesTableau(matches, 'principal') : []),
    [qualificatif, matches],
  );
  const qualifiedIds = useMemo(() => {
    if (qualificatif) return new Set(qualifiesDuTableau);
    const n = concours.nbQualifies ?? 0;
    const ids = new Set<string>();
    if (n <= 0) return ids;
    for (const g of principalGroups) {
      if (ids.size >= n) break;
      g.teamIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [qualificatif, qualifiesDuTableau, principalGroups, concours.nbQualifies]);

  const hasAnything =
    principalGroups.length > 0 || consolanteGroups.length > 0 || outcomes.length > 0;

  if (!hasAnything) {
    return (
      <div className="tab-content">
        <p className="empty-state">Les résultats apparaîtront au fil du concours.</p>
      </div>
    );
  }

  return (
    <div className="tab-content results">
      <ExportBar concours={concours} teams={teams} poules={poules} matches={matches} />
        <PhotosPodium concours={concours} />
      {principalGroups.length > 0 && (
        <section className="result-section">
          <h2>Concours principal</h2>
          {qualifiedIds.size > 0 && (
            <p className="qualifies-banner">
              🎫 {qualifiedIds.size} qualifié{qualifiedIds.size > 1 ? 's' : ''} pour la phase
              suivante{' '}
              {qualificatif
                ? '(vainqueurs du dernier tour — le tableau s\'arrête là).'
                : '(les mieux classés).'}
            </p>
          )}
          <RankTable
            groups={principalGroups}
            teamsById={teamsById}
            qualifiedIds={qualifiedIds}
          />
        </section>
      )}

      {principalGroups.length > 0 && (
        <IndemnitesSection concours={concours} teams={teams} groups={principalGroups} />
      )}

      {consolanteGroups.length > 0 && (
        <section className="result-section">
          <h2>Consolante</h2>
          <RankTable groups={consolanteGroups} teamsById={teamsById} />
        </section>
      )}

      {complementaireGroups.length > 0 && (
        <section className="result-section">
          <h2>Complémentaire</h2>
          <RankTable groups={complementaireGroups} teamsById={teamsById} />
        </section>
      )}

      {concours.mode === 'poules' && outcomes.length > 0 && (
        <section className="result-section">
          <h2>Issue des poules</h2>
          <table className="rank-table">
            <thead>
              <tr>
                <th>Poule</th>
                <th>1er (2 victoires)</th>
                <th>2e (barrage)</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.poule.id}>
                  <td>Poule {o.poule.index}</td>
                  <td>{o.q1 ? <TeamLabel team={teamsById.get(o.q1)} /> : '—'}</td>
                  <td>{o.q2 ? <TeamLabel team={teamsById.get(o.q2)} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/**
 * Répartition des indemnités : pot = mises × équipes − frais, partagé
 * entre les groupes du classement avec des poids géométriques
 * (vainqueur 2× le finaliste, etc.). Suggestion arrondie à 0,10 €.
 */
function IndemnitesSection({
  concours,
  teams,
  groups,
}: {
  concours: Concours;
  teams: Team[];
  groups: RankGroup[];
}) {
  const [open, setOpen] = useState(false);
  const nb = teams.filter((t) => !t.forfait).length;
  const mise = concours.miseParEquipe ?? 10;
  const frais = concours.fraisPct ?? 0;
  const pot = Math.max(0, mise * nb * (1 - frais / 100));
  const dernierRang = groups.length > 0 ? Math.max(...groups.map((g) => g.rank)) : 0;
  const seuil = concours.indemnitesJusquAuRang;
  const repartition = repartitionIndemnites(groups, pot, seuil, nb);

  return (
    <section className="result-section indemnites">
      <h2>
        💶 Indemnités{' '}
        <button className="btn btn-ghost btn-sm no-print" onClick={() => setOpen(!open)}>
          {open ? 'Masquer' : 'Calculer'}
        </button>
      </h2>
      {open && (
        <>
          <div className="indemnites-params no-print">
            <label>
              Mise par équipe (€)
              <input
                type="number"
                min={0}
                step={0.5}
                value={mise}
                onChange={(e) =>
                  void updateConcours({ ...concours, miseParEquipe: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Frais d'organisation (%)
              <input
                type="number"
                min={0}
                max={100}
                value={frais}
                onChange={(e) =>
                  void updateConcours({ ...concours, fraisPct: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Payer jusqu'au rang
              <select
                value={seuil ?? ''}
                onChange={(e) =>
                  void updateConcours({
                    ...concours,
                    indemnitesJusquAuRang: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              >
                <option value="">Tous les rangs classés</option>
                {groups.map((g) => (
                  <option key={g.rank} value={g.rank + g.teamIds.length - 1}>
                    Jusqu'au rang {g.rank + g.teamIds.length - 1} — {g.label.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              {nb} équipes × {mise.toFixed(2)} € − {frais}% ={' '}
              <strong>{pot.toFixed(2)} € à répartir</strong>
              {seuil !== undefined && seuil < dernierRang && (
                <>
                  {' '}
                  · au-delà du rang {seuil}, les équipes repartent avec des lots ou des tickets,
                  et tout le pot va aux rangs payés.
                </>
              )}
            </p>
          </div>
          <table className="rank-table">
            <thead>
              <tr>
                <th>Classement</th>
                <th>Équipes</th>
                <th>Par équipe</th>
                <th>Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {repartition.lignes.map((l) => (
                <tr key={l.rank} className={l.paye ? undefined : 'indemnite-non-payee'}>
                  <td>{l.label}</td>
                  <td>{l.nbEquipes}</td>
                  <td>{l.paye ? `${l.parEquipe.toFixed(2)} €` : '— lots / tickets'}</td>
                  <td>{l.paye ? `${l.sousTotal.toFixed(2)} €` : ''}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>
                  <strong>Total distribué</strong>{' '}
                  <span className="hint">(arrondi à 0,10 €)</span>
                </td>
                <td>
                  <strong>{repartition.totalDistribue.toFixed(2)} €</strong>
                </td>
              </tr>
              <tr>
                <td colSpan={3}>
                  Total par équipe engagée <span className="hint">({nb} équipes)</span>
                </td>
                <td>{repartition.parEquipeEngagee.toFixed(2)} €</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function ExportBar({ concours, teams, poules, matches }: Props) {
  // Le rapport d'arbitrage se lit dans le tableau principal : il n'a de sens
  // que pour les formules à tableau.
  const hasBracket = matches.some((m) => m.stage === 'principal');
  // Les documents du comité restent visibles sur un concours officiel, même si
  // le club a masqué le mode fédéral.
  const federal = useModeFederalActif() || estConcoursOfficiel(concours);
  // Concours qualificatif : la liste des qualifiés s'exporte pour servir
  // d'inscriptions à la phase finale.
  const idsQualifies = estQualificatif(matches, 'principal')
    ? new Set(qualifiesTableau(matches, 'principal'))
    : new Set<string>();
  const qualifies = teams.filter((t) => idsQualifies.has(t.id));
  /**
   * Phases finales jouées (manuel §3.D.15) : le délégué a son propre document.
   * Sans elles, le rapport d'arbitrage suffit — c'est le même contenu.
   */
  const avecFinales = isRondesMode(concours.mode) && matches.some((m) => m.stage === 'principal');
  return (
    <div className="export-bar no-print" data-tour="exporter">
      <span className="export-bar-label">Exporter :</span>
      {/* Documents remis au comité : sans objet pour un concours de club. */}
      {hasBracket && federal && (
        <>
          <Link
            className="btn btn-ghost btn-sm"
            to={`/concours/${concours.id}/imprimer/arbitrage`}
            title="Feuille à remettre au comité (points fédéraux)"
          >
            🧾 Arbitrage (impression)
          </Link>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => exportArbitrageCSV(concours, teams, matches)}
            title="Colonnes du tableur fédéral, pour la saisie dans Geslico"
          >
            🧾 Arbitrage (CSV)
          </button>
          {/* Phases finales en système suisse : le délégué a son propre
              document (manuel §3.D.15), même contenu dans l'ordre fédéral. */}
          {avecFinales && (
            <Link
              className="btn btn-ghost btn-sm"
              to={`/concours/${concours.id}/imprimer/delegue`}
              title="Résultat du concours à remplir par le délégué (phases finales)"
            >
              📋 Rapport du délégué
            </Link>
          )}
          <Link
            className="btn btn-ghost btn-sm"
            to={`/concours/${concours.id}/imprimer/presse`}
            title="Résultats détaillés par tour, pour le journal"
          >
            📰 Presse
          </Link>
        </>
      )}
      {/* Le graphique papier n'a rien de fédéral : tout club imprime son
          tableau pour l'afficher au boulodrome. */}
      {hasBracket && (
        <Link
          className="btn btn-ghost btn-sm"
          to={`/concours/${concours.id}/imprimer/graphique`}
          title="Graphique papier, pour le suivi manuel"
        >
          🗂 Graphique
        </Link>
      )}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => exportClassementCSV(concours, teams, poules, matches)}
      >
        📊 Classement (CSV)
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => exportEngagesCSV(concours, teams)}
      >
        📋 Engagés (CSV)
      </button>
      {qualifies.length > 0 && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => exportQualifiesCSV(concours, qualifies)}
          title="Liste à réutiliser comme inscriptions de la phase finale"
        >
          🎫 Qualifiés (CSV)
        </button>
      )}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => exportBackupJSON(concours, teams, poules, matches)}
        title="Sauvegarde complète réimportable"
      >
        💾 Sauvegarde (JSON)
      </button>
    </div>
  );
}

function RankTable({
  groups,
  teamsById,
  qualifiedIds,
}: {
  groups: ReturnType<typeof bracketRanking>;
  teamsById: Map<string, Team>;
  qualifiedIds?: Set<string>;
}) {
  return (
    <table className="rank-table">
      <tbody>
        {groups.map((g) => (
          <tr key={g.rank} className={g.rank === 1 ? 'rank-first' : ''}>
            <td className="rank-cell">
              {g.rank === 1 ? '🏆' : g.rank === 2 ? '🥈' : `${g.rank}e`}
            </td>
            <td className="rank-label">{g.label}</td>
            <td>
              <ul className="rank-teams">
                {g.teamIds.map((id) => (
                  <li key={id}>
                    <TeamLabel team={teamsById.get(id)} />
                    {qualifiedIds?.has(id) && (
                      <span className="tag tag-qualifie">Qualifié</span>
                    )}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
