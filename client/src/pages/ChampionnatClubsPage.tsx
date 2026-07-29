import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COMPETITIONS_CLUB, bilanRencontre, resumeFeuille, BAREME_CDC } from '@shared';
import {
  creerFeuilleMatch,
  deleteFeuilleMatch,
  reprendreFeuilleLocale,
} from '../db/actions';
import { useFeuillesMatch } from '../db/hooks';
import { formatDateFr } from '../lib/labels';

/**
 * Feuilles de match du club (manuel §3.E).
 *
 * Une feuille par rencontre : elles se conservent d'une rencontre à l'autre et
 * se synchronisent entre les tablettes du club. La version précédente n'en
 * gardait qu'une, dans le navigateur — la suivante écrasait la précédente.
 */
export function ChampionnatClubsPage() {
  const navigate = useNavigate();
  const feuilles = useFeuillesMatch();
  const [busy, setBusy] = useState(false);

  // Reprise de la feuille laissée par l'ancienne version, une seule fois.
  useEffect(() => {
    void reprendreFeuilleLocale();
  }, []);

  const creer = async (): Promise<void> => {
    setBusy(true);
    try {
      navigate(`/championnat-clubs/${await creerFeuilleMatch()}`);
    } finally {
      setBusy(false);
    }
  };

  const supprimer = async (id: string, resume: string): Promise<void> => {
    if (window.confirm(`Supprimer la feuille « ${resume} » ? Elle ne sera pas récupérable.`)) {
      await deleteFeuilleMatch(id);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>🏅 Feuilles de match</h1>
        <span className="page-head-actions">
          <Link className="btn btn-sm" to="/">
            ← Mes concours
          </Link>
          <button className="btn btn-primary" disabled={busy} onClick={() => void creer()}>
            + Nouvelle feuille
          </button>
        </span>
      </div>

      <p className="hint">
        Championnat des clubs et Coupe de France : contrôle de la composition, ordre des rencontres,
        résultats, signatures des capitaines. Une feuille par rencontre, conservée et synchronisée
        entre les appareils du club.
      </p>

      {feuilles && feuilles.length === 0 && (
        <div className="empty-state">
          <p>Aucune feuille de match.</p>
          <p>Créez-en une à chaque rencontre : elles restent ensuite consultables.</p>
        </div>
      )}

      {feuilles && feuilles.length > 0 && (
        <div className="table-scroll">
          <table className="teams-table">
            <thead>
              <tr>
                <th>Rencontre</th>
                <th>Date</th>
                <th>Compétition</th>
                <th>Résultat</th>
                <th>Signatures</th>
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feuilles.map((f) => {
                const bilan = bilanRencontre(BAREME_CDC, f.parties);
                const competition = COMPETITIONS_CLUB.find((c) => c.id === f.competition);
                const signees = [f.signatures.a, f.signatures.b].filter(Boolean).length;
                const resume = resumeFeuille(f);
                return (
                  <tr key={f.id}>
                    <td>
                      <Link to={`/championnat-clubs/${f.id}`}>{resume}</Link>
                      {f.division && <span className="tag"> {f.division}</span>}
                      {f.poule && <span className="tag"> poule {f.poule}</span>}
                    </td>
                    <td>{formatDateFr(f.date)}</td>
                    <td>{competition?.label ?? f.competition}</td>
                    <td>
                      {bilan.jouees === 0 ? (
                        <span className="hint">à jouer</span>
                      ) : (
                        <>
                          <strong>
                            {bilan.totalA} – {bilan.totalB}
                          </strong>
                          {!bilan.complete && <span className="hint"> (en cours)</span>}
                        </>
                      )}
                    </td>
                    <td>
                      {signees === 2 ? (
                        <span className="tag tag-ok">🔒 signée</span>
                      ) : signees === 1 ? (
                        <span className="tag tag-warn">1 sur 2</span>
                      ) : (
                        <span className="hint">—</span>
                      )}
                    </td>
                    <td className="no-print cell-actions">
                      <button
                        className="btn-icon btn-icon-danger"
                        title="Supprimer cette feuille"
                        onClick={() => void supprimer(f.id, resume)}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
