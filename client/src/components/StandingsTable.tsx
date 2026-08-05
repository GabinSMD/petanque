import type { PermutationClassement, Standing, Team } from '@shared';
import { estPermutee, libelleClubs } from '@shared';
import { teamDisplayName } from './TeamLabel';

const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  standings: Standing[];
  teamsById: Map<string, Team>;
  /** Nombre de lignes affichées (affichage TV). */
  limit?: number;
  compact?: boolean;
  /**
   * Interversions décidées à la main : les lignes concernées sont marquées. Un
   * classement modifié par l'organisateur ne doit pas passer pour un classement
   * calculé — c'est la seule façon pour un tiers de comprendre pourquoi l'ordre
   * ne suit pas les colonnes.
   */
  permutations?: PermutationClassement[];
}

/**
 * Classement des formules en rondes : victoires, goal-average, puis
 * confrontation directe entre équipes à égalité (manuel §3.D.15).
 *
 * La colonne « Résultats » est le `Résultats Parties` du document fédéral : deux
 * équipes à trois points ne se lisent pas de la même façon selon qu'elles ont
 * fait `GGGP` ou `PGGG`.
 */
export function StandingsTable({ standings, teamsById, limit, compact, permutations }: Props) {
  const rows = limit ? standings.slice(0, limit) : standings;
  return (
    <table className={`standings-table${compact ? ' standings-compact' : ''}`}>
      <thead>
        <tr>
          <th></th>
          <th>Nom</th>
          <th title="Parties jouées">J</th>
          <th title="Victoires">V</th>
          <th title="Goal-average (points marqués − encaissés)">+/−</th>
          {!compact && <th title="Points marqués">Pts</th>}
          {/* « Résultats Parties » du document fédéral (p.106), montrée **aussi**
              en mode compact : le panneau étroit du logiciel fédéral affiche
              précisément cette colonne et renonce, lui, aux points marqués. La
              brièveté favorise donc la suite, pas l'inverse — et trois à sept
              lettres tiennent dans moins de place qu'un nom de club. */}
          <th title="Résultats Parties : la suite des victoires (G) et défaites (P), tour par tour">
            Résultats
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const team = teamsById.get(s.id);
          return (
            <tr
              key={s.id}
              className={[
                i < 3 ? `standing-top standing-${i + 1}` : '',
                estPermutee(permutations, s.id) ? 'standing-permutee' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <td className="standing-rank">
                {MEDALS[i] ?? i + 1}
                {estPermutee(permutations, s.id) && (
                  <span
                    className="standing-marque-permutee"
                    title="Place échangée à la main par l'organisateur, à égalité"
                  >
                    ⇅
                  </span>
                )}
              </td>
              <td>
                {team ? (
                  <>
                    <span className="team-number">{team.number}</span>{' '}
                    {teamDisplayName(team)}
                    {team.forfait && ' (FF)'}
                    {!compact && libelleClubs(team.players, team.club) && (
                      <span className="team-club"> {libelleClubs(team.players, team.club)}</span>
                    )}
                  </>
                ) : (
                  '…'
                )}
              </td>
              <td>{s.played}</td>
              <td className="standing-wins">{s.wins}</td>
              <td>{s.diff > 0 ? `+${s.diff}` : s.diff}</td>
              {!compact && <td>{s.pointsFor}</td>}
              <td className="standing-resultats" title={`${s.wins} victoire(s) sur ${s.played}`}>
                {s.resultatsParties || '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
