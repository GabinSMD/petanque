import { useMemo, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { bracketRanking, pouleOutcome, rondeStandings, type RankGroup } from '@shared';
import { updateConcours } from '../../db/actions';
import { StandingsTable } from '../../components/StandingsTable';
import { TeamLabel } from '../../components/TeamLabel';
import { TirRanking } from '../../components/TirRanking';
import { isIndividualMode, isRondesMode, isTirMode } from '../../lib/labels';

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
    return (
      <div className="tab-content results">
        <section className="result-section">
          <h2>
            Classement général{isIndividualMode(concours.mode) ? ' (individuel)' : ''}
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

  // Qualifiés pour une phase suivante : les meilleurs du tableau principal.
  const qualifiedIds = useMemo(() => {
    const n = concours.nbQualifies ?? 0;
    const ids = new Set<string>();
    if (n <= 0) return ids;
    for (const g of principalGroups) {
      if (ids.size >= n) break;
      g.teamIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [principalGroups, concours.nbQualifies]);

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
      {principalGroups.length > 0 && (
        <section className="result-section">
          <h2>Concours principal</h2>
          {qualifiedIds.size > 0 && (
            <p className="qualifies-banner">
              🎫 {qualifiedIds.size} qualifié{qualifiedIds.size > 1 ? 's' : ''} pour la phase
              suivante (les mieux classés).
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

  const weights = groups.map((_, i) => 2 ** Math.max(0, groups.length - 1 - i));
  const totalWeight = groups.reduce((s, g, i) => s + weights[i]! * g.teamIds.length, 0);
  const perTeam = (i: number) =>
    totalWeight > 0 ? Math.round(((pot * weights[i]!) / totalWeight) * 10) / 10 : 0;
  const distributed = groups.reduce((s, g, i) => s + perTeam(i) * g.teamIds.length, 0);

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
            <p className="hint">
              {nb} équipes × {mise.toFixed(2)} € − {frais}% ={' '}
              <strong>{pot.toFixed(2)} € à répartir</strong>
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
              {groups.map((g, i) => (
                <tr key={g.rank}>
                  <td>{g.label}</td>
                  <td>{g.teamIds.length}</td>
                  <td>{perTeam(i).toFixed(2)} €</td>
                  <td>{(perTeam(i) * g.teamIds.length).toFixed(2)} €</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>
                  <strong>Total distribué</strong>{' '}
                  <span className="hint">(arrondi à 0,10 €)</span>
                </td>
                <td>
                  <strong>{distributed.toFixed(2)} €</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
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
