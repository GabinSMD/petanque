import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { createConcours, deleteConcours } from '../db/actions';
import { db } from '../db/local';
import { useConcoursList } from '../db/hooks';
import { ConcoursForm } from '../components/ConcoursForm';
import { Modal } from '../components/Modal';
import { FORMAT_LABELS, MODE_LABELS, STATUS_LABELS, formatDateFr } from '../lib/labels';

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

  const remove = async (id: string, name: string) => {
    if (window.confirm(`Supprimer le concours « ${name} » et toutes ses données ?`)) {
      await deleteConcours(id);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Mes concours</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau concours
        </button>
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

      <div className="card-grid">
        {concoursList?.map((c) => (
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
                {STATUS_LABELS[c.status]}
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
              <span className="tag">{FORMAT_LABELS[c.format]}</span>
              <span className="tag">{MODE_LABELS[c.mode]}</span>
              {c.consolante && <span className="tag">Consolante</span>}
            </p>
            <p className="concours-card-count">
              {teamCounts.get(c.id) ?? 0} équipe{(teamCounts.get(c.id) ?? 0) > 1 ? 's' : ''}{' '}
              inscrite{(teamCounts.get(c.id) ?? 0) > 1 ? 's' : ''}
            </p>
          </div>
        ))}
      </div>

      {creating && (
        <Modal title="Nouveau concours" onClose={() => setCreating(false)}>
          <ConcoursForm
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              const id = await createConcours(input);
              setCreating(false);
              navigate(`/concours/${id}`);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
