import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Concours, Match, Poule, Team } from '@shared';
import { designationCategorie } from '@shared';
import { db } from '../db/local';
import { finalRanking } from '../lib/results';
import { teamDisplayName } from '../components/TeamLabel';
import { formatDateFr, MODE_INFO } from '../lib/labels';

interface Bundle {
  concours: Concours[];
  teamsByConcours: Map<string, Team[]>;
  poulesByConcours: Map<string, Poule[]>;
  matchesByConcours: Map<string, Match[]>;
}

function usePalmaresData(): Bundle | undefined {
  return useLiveQuery(async () => {
    const rows = await db.entities.toArray();
    const concours: Concours[] = [];
    const teamsByConcours = new Map<string, Team[]>();
    const poulesByConcours = new Map<string, Poule[]>();
    const matchesByConcours = new Map<string, Match[]>();
    for (const r of rows) {
      if (r.deleted === 1 || !r.data) continue;
      if (r.type === 'concours') concours.push(r.data as Concours);
      else if (r.type === 'team')
        teamsByConcours.set(r.concoursId, [...(teamsByConcours.get(r.concoursId) ?? []), r.data as Team]);
      else if (r.type === 'poule')
        poulesByConcours.set(r.concoursId, [...(poulesByConcours.get(r.concoursId) ?? []), r.data as Poule]);
      else if (r.type === 'match')
        matchesByConcours.set(r.concoursId, [...(matchesByConcours.get(r.concoursId) ?? []), r.data as Match]);
    }
    concours.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return { concours, teamsByConcours, poulesByConcours, matchesByConcours };
  }, []);
}

interface Podium {
  concours: Concours;
  winners: Team[];
  runnersUp: Team[];
}

export function PalmaresPage() {
  const data = usePalmaresData();

  const podiums = useMemo<Podium[]>(() => {
    if (!data) return [];
    const out: Podium[] = [];
    for (const c of data.concours) {
      if (c.status !== 'termine') continue;
      const teams = data.teamsByConcours.get(c.id) ?? [];
      const byId = new Map(teams.map((t) => [t.id, t]));
      const ranking = finalRanking(
        c,
        teams,
        data.poulesByConcours.get(c.id) ?? [],
        data.matchesByConcours.get(c.id) ?? [],
      );
      const rank1 = ranking.find((g) => g.rank === 1);
      if (!rank1 || rank1.teamIds.length === 0) continue;
      const rank2 = ranking.find((g) => g.rank === 2);
      out.push({
        concours: c,
        winners: rank1.teamIds.map((id) => byId.get(id)).filter((t): t is Team => Boolean(t)),
        runnersUp: (rank2?.teamIds ?? []).map((id) => byId.get(id)).filter((t): t is Team => Boolean(t)),
      });
    }
    return out;
  }, [data]);

  // Tableau d'honneur par club : victoires puis finales.
  const clubBoard = useMemo(() => {
    const map = new Map<string, { club: string; wins: number; finals: number }>();
    const bump = (club: string | undefined, key: 'wins' | 'finals') => {
      const name = club?.trim() || 'Sans club';
      const e = map.get(name) ?? { club: name, wins: 0, finals: 0 };
      e[key] += 1;
      map.set(name, e);
    };
    for (const p of podiums) {
      for (const w of p.winners) bump(w.club, 'wins');
      for (const r of p.runnersUp) bump(r.club, 'finals');
    }
    return [...map.values()].sort((a, b) => b.wins - a.wins || b.finals - a.finals);
  }, [podiums]);

  if (!data) {
    return (
      <div className="page">
        <p className="empty-state">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>🏆 Palmarès du club</h1>
        <span className="page-head-actions">
          <Link className="btn btn-sm" to="/">
            ← Mes concours
          </Link>
          <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
        </span>
      </div>

      {podiums.length === 0 ? (
        <div className="empty-state">
          <p>Aucun concours terminé pour l'instant.</p>
          <p>Le palmarès se remplit dès qu'un concours est clôturé.</p>
        </div>
      ) : (
        <>
          <section className="palmares-section">
            <h2>Tableau d'honneur</h2>
            <div className="table-scroll">
            <table className="palmares-table">
              <thead>
                <tr>
                  <th>Concours</th>
                  <th>Date</th>
                  <th>🏆 Vainqueur</th>
                  <th>🥈 Finaliste</th>
                </tr>
              </thead>
              <tbody>
                {podiums.map((p) => (
                  <tr key={p.concours.id}>
                    <td>
                      <Link to={`/concours/${p.concours.id}/resultats`}>
                        {MODE_INFO[p.concours.mode].emoji} {p.concours.name}
                      </Link>
                      {designationCategorie(p.concours) && (
                        <span className="tag tag-cat">{designationCategorie(p.concours)}</span>
                      )}
                    </td>
                    <td className="palmares-date">{formatDateFr(p.concours.date)}</td>
                    <td className="palmares-winner">
                      {p.winners.map((t) => teamDisplayName(t)).join(' / ') || '—'}
                      {p.winners[0]?.club && (
                        <span className="palmares-club"> · {p.winners[0].club}</span>
                      )}
                    </td>
                    <td>
                      {p.runnersUp.map((t) => teamDisplayName(t)).join(' / ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>

          {clubBoard.length > 0 && (
            <section className="palmares-section">
              <h2>Classement des clubs</h2>
              <div className="table-scroll">
              <table className="palmares-table">
                <thead>
                  <tr>
                    <th>Club</th>
                    <th>🏆 Victoires</th>
                    <th>🥈 Finales</th>
                  </tr>
                </thead>
                <tbody>
                  {clubBoard.map((c, i) => (
                    <tr key={c.club} className={i === 0 ? 'rank-first' : ''}>
                      <td>{c.club}</td>
                      <td className="palmares-count">{c.wins}</td>
                      <td className="palmares-count">{c.finals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
