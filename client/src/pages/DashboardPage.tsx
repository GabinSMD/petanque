import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { createConcours, deleteConcours } from '../db/actions';
import { db } from '../db/local';
import { useConcoursList } from '../db/hooks';
import { ClubModal } from '../components/ClubModal';
import { CreateConcoursWizard } from '../components/CreateConcoursWizard';
import { ImportSauvegarde } from '../components/ImportSauvegarde';
import { Modal } from '../components/Modal';
import { WelcomeModal, isWelcomeDone } from '../components/WelcomeModal';
import { useSession } from '../db/hooks';
import {
  FORMAT_LABELS,
  MODE_INFO,
  MODE_LABELS,
  dateLongFr,
  entrantWord,
  formatDateFr,
  isTirMode,
  statusLabel,
} from '../lib/labels';

function useTeamCounts(): Map<string, number> {
  return (
    useLiveQuery(async () => {
      const rows = await db.entities.where('type').equals('team').toArray();
      const counts = new Map<string, number>();
      for (const r of rows) {
        if (r.deleted === 1) continue;
        counts.set(r.concoursId, (counts.get(r.concoursId) ?? 0) + 1);
      }
      return counts;
    }, []) ?? new Map()
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const concoursList = useConcoursList();
  const teamCounts = useTeamCounts();
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [club, setClub] = useState(false);

  // Raccourci PWA « Nouveau concours » (?nouveau=1) : ouvre l'assistant.
  useEffect(() => {
    if (searchParams.get('nouveau') !== null) {
      setCreating(true);
      searchParams.delete('nouveau');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [welcome, setWelcome] = useState(() => !isWelcomeDone());
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const session = useSession();

  const categories = [
    ...new Set((concoursList ?? []).map((c) => c.category).filter((c): c is string => Boolean(c))),
  ].sort((a, b) => a.localeCompare(b, 'fr'));

  const filtered = (concoursList ?? []).filter(
    (c) => !categoryFilter || c.category === categoryFilter,
  );

  // Regroupement par journée (date), déjà triées du plus récent au plus ancien.
  const byDate = new Map<string, typeof filtered>();
  for (const c of filtered) {
    byDate.set(c.date, [...(byDate.get(c.date) ?? []), c]);
  }

  const remove = async (id: string, name: string) => {
    if (window.confirm(`Supprimer le concours « ${name} » et toutes ses données ?`)) {
      await deleteConcours(id);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Mes concours</h1>
        <span className="page-head-actions">
          {!session?.guest && (
            <button className="btn btn-sm" onClick={() => setClub(true)}>
              👥 Mon club
            </button>
          )}
          <Link className="btn btn-sm" to="/licencies">
            📇 Licenciés
          </Link>
          <Link className="btn btn-sm" to="/palmares">
            🏆 Palmarès
          </Link>
          <Link className="btn btn-sm" to="/championnat-clubs" title="Contrôle des compositions et feuille de rencontre">
            🏅 Championnat des clubs
          </Link>
          <ImportSauvegarde />
          <button
            className="btn btn-primary"
            data-tour="new-concours"
            onClick={() => setCreating(true)}
          >
            + Nouveau concours
          </button>
        </span>
      </div>

      {concoursList && concoursList.length === 0 && (
        <div className="empty-state">
          <p>Aucun concours pour le moment.</p>
          <p>
            Créez votre premier concours : inscriptions, tirage des poules, tableaux et
            résultats — le tout utilisable même sans connexion.
          </p>
        </div>
      )}

      {categories.length > 0 && (
        <div className="category-filter no-print">
          <button
            className={`chip-filter${categoryFilter === '' ? ' active' : ''}`}
            onClick={() => setCategoryFilter('')}
          >
            Toutes
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`chip-filter${categoryFilter === cat ? ' active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {[...byDate.entries()].map(([date, list]) => (
        <section key={date} className="journee">
          <h2 className="journee-head">
            {dateLongFr(date)}
            <span className="journee-count">
              {list.length} concours{list.length > 1 ? '' : ''}
            </span>
          </h2>
          <div className="card-grid">
            {list.map((c) => (
              <div
                key={c.id}
                className="concours-card"
                onClick={() => navigate(`/concours/${c.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/concours/${c.id}`)}
              >
                <div className="concours-card-head">
                  <span className={`status-chip status-${c.status}`}>
                    {statusLabel(c.mode, c.status)}
                  </span>
                  <button
                    className="btn-icon btn-icon-danger no-print"
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove(c.id, c.name);
                    }}
                    title="Supprimer"
                  >
                    🗑
                  </button>
                </div>
                <h2>{c.name}</h2>
                <p className="concours-card-meta">
                  {formatDateFr(c.date)}
                  {c.lieu ? ` · ${c.lieu}` : ''}
                </p>
                <p className="concours-card-tags">
                  {c.category && <span className="tag tag-cat">{c.category}</span>}
                  {!isTirMode(c.mode) && <span className="tag">{FORMAT_LABELS[c.format]}</span>}
                  <span className="tag">
                    {MODE_INFO[c.mode].emoji} {MODE_LABELS[c.mode]}
                  </span>
                  {c.consolante && <span className="tag">Consolante</span>}
                </p>
                <p className="concours-card-count">
                  {teamCounts.get(c.id) ?? 0}{' '}
                  {entrantWord(c.mode, (teamCounts.get(c.id) ?? 0) > 1)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {creating && (
        <Modal title="Nouveau concours" onClose={() => setCreating(false)}>
          <CreateConcoursWizard
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              const id = await createConcours(input);
              setCreating(false);
              navigate(`/concours/${id}`);
            }}
          />
        </Modal>
      )}

      {club && <ClubModal onClose={() => setClub(false)} />}
      {welcome && <WelcomeModal onClose={() => setWelcome(false)} />}
    </div>
  );
}
