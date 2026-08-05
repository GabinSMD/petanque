import { useState } from 'react';
import type { Concours, Match, Team } from '@shared';
import { classementFinales, configsPossibles, nomDuBloc } from '@shared';
import { enregistrerOrdreClassement, lancerPhasesFinales } from '../db/actions';
import { teamDisplayName } from './TeamLabel';

interface Props {
  concours: Concours;
  teams: Team[];
  matches: Match[];
}

/**
 * Passage des rondes à l'élimination directe (manuel §3.D.15).
 *
 * Le logiciel fédéral exporte ici le classement vers un classeur Excel qui
 * génère le tableau ; le concours vit alors dans deux fichiers. Ici tout reste
 * dans le même concours : le classement affiché est celui qui alimentera le
 * tableau, et on voit d'avance qui ira dans quel concours.
 *
 * Les égalités que rien ne départage sont signalées, et seules celles-là
 * peuvent être interverties à la main.
 */
export function PhasesFinalesPanel({ concours, teams, matches }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actifs = teams.filter((t) => !t.forfait);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const lignes = classementFinales(actifs, matches, concours.ordreClassement ?? []);
  const configs = configsPossibles(actifs.length);
  const [configId, setConfigId] = useState(configs[configs.length - 1]?.id ?? '');
  const config = configs.find((c) => c.id === configId) ?? configs[configs.length - 1];

  if (!config) {
    return (
      <div className="draw-panel no-print">
        <h3>🏆 Phases finales</h3>
        <p className="hint">
          Il faut au moins deux équipes classées pour disputer une phase finale.
        </p>
      </div>
    );
  }

  /** Tableau (concours A, B, C) qui accueillera le rang donné, ou rien. */
  const blocDuRang = (index: number): string | null => {
    let debut = 0;
    for (const [i, taille] of config.blocs.entries()) {
      if (index >= debut && index < debut + taille) return nomDuBloc(i);
      debut += taille;
    }
    return null;
  };
  const qualifies = Math.min(
    actifs.length,
    config.blocs.reduce((a, b) => a + b, 0),
  );

  /** Fait passer la ligne `i` devant la précédente, dans l'ordre affiché. */
  const intervertir = async (i: number): Promise<void> => {
    const ordre = lignes.map((l) => l.id);
    const precedent = ordre[i - 1]!;
    ordre[i - 1] = ordre[i]!;
    ordre[i] = precedent;
    await enregistrerOrdreClassement(concours, ordre);
  };

  const lancer = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await lancerPhasesFinales(concours, config.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="draw-panel no-print finales-panel">
      <h3>🏆 Phases finales</h3>
      <p className="hint">
        Le classement des rondes remplit le tableau : le 1er contre le dernier qualifié, et les
        mieux classés placés pour se rencontrer le plus tard possible. Aucun tirage au sort.
      </p>

      <div className="form-row">
        <label>
          Configuration
          <select value={config.id} onChange={(e) => setConfigId(e.target.value)}>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{config.hint}</p>
      </div>

      <table className="standings-table finales-classement">
        <thead>
          <tr>
            <th>Rang</th>
            <th>Équipe</th>
            <th title="Parties jouées">J</th>
            <th title="Victoires">V</th>
            <th title="Goal-average">+/−</th>
            <th title="Points marqués">Pts</th>
            {/* La suite des résultats sert surtout ici : c'est le tableau où l'on
                départage les égalités, et deux équipes à égalité de victoires et
                de goal-average n'ont pas forcément eu le même parcours. */}
            <th title="Résultats Parties : la suite des victoires (G) et défaites (P), tour par tour">
              Résultats
            </th>
            <th>Tableau</th>
            <th className="no-print"></th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const team = teamsById.get(l.id);
            const bloc = i < qualifies ? blocDuRang(i) : null;
            const precedente = lignes[i - 1];
            // On ne peut intervertir que deux équipes réellement à égalité.
            const echangeable = l.exAequo && precedente?.exAequo && precedente.rang === l.rang;
            return (
              <tr key={l.id} className={bloc ? undefined : 'row-non-qualifie'}>
                <td className="standing-rank">
                  {l.rang}
                  {l.exAequo && (
                    <span className="tag tag-warn" title="Égalité que rien ne départage">
                      ex æquo
                    </span>
                  )}
                </td>
                <td>
                  {team ? (
                    <>
                      <span className="team-number">{team.number}</span> {teamDisplayName(team)}
                    </>
                  ) : (
                    '…'
                  )}
                </td>
                <td>{l.played}</td>
                <td className="standing-wins">{l.wins}</td>
                <td>{l.diff > 0 ? `+${l.diff}` : l.diff}</td>
                <td>{l.pointsFor}</td>
                <td className="standing-resultats" title={`${l.wins} victoire(s) sur ${l.played}`}>
                  {l.resultatsParties || '—'}
                </td>
                <td>{bloc ?? <span className="hint">non qualifiée</span>}</td>
                <td className="no-print">
                  {echangeable && (
                    <button
                      className="btn-icon"
                      title={`Passer devant ${
                        teamsById.get(precedente.id)
                          ? teamDisplayName(teamsById.get(precedente.id)!)
                          : 'l\'équipe précédente'
                      } (égalité)`}
                      onClick={() => void intervertir(i)}
                    >
                      ↑
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {lignes.some((l) => l.exAequo) && (
        <p className="hint">
          Les équipes signalées « ex æquo » ne se sont pas rencontrées, ou se sont partagé leurs
          rencontres : le classement ne peut pas les départager. Utilisez ↑ pour trancher.
        </p>
      )}

      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={() => void lancer()}>
        🏆 Lancer les phases finales ({qualifies} qualifiée{qualifies > 1 ? 's' : ''})
      </button>
    </div>
  );
}
