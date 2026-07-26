import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ConcoursStatus } from '@shared';
import { updateConcours } from '../db/actions';
import { useConcours, useMatches, usePoules, useTeams } from '../db/hooks';
import { ConcoursForm } from '../components/ConcoursForm';
import { Modal } from '../components/Modal';
import { FORMAT_LABELS, MODE_LABELS, STATUS_LABELS, formatDateFr } from '../lib/labels';
import { TeamsTab } from './tabs/TeamsTab';
import { PoulesTab } from './tabs/PoulesTab';
import { BracketTab } from './tabs/BracketTab';
import { ResultsTab } from './tabs/ResultsTab';

const DEFAULT_TAB: Record<ConcoursStatus, string> = {
  inscriptions: 'equipes',
  poules: 'poules',
  tableau: 'tableau',
  termine: 'resultats',
};

export function ConcoursPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const concours = useConcours(id);
  const teams = useTeams(id);
  const poules = usePoules(id);
  const matches = useMatches(id);
  const [editing, setEditing] = useState(false);

  if (!concours) {
    return (
      <div className="page">
        <p className="empty-state">
          Concours introuvable (ou pas encore synchronisé). <Link to="/">← Retour</Link>
        </p>
      </div>
    );
  }

  const tabs = [
    { key: 'equipes', label: `Équipes (${teams?.length ?? 0})` },
    ...(concours.mode === 'poules' ? [{ key: 'poules', label: 'Poules' }] : []),
    { key: 'tableau', label: 'Tableau' },
    { key: 'resultats', label: 'Résultats' },
  ];
  const active = tabs.some((t) => t.key === tab) ? tab! : DEFAULT_TAB[concours.status];

  return (
    <div className="page">
      <div className="concours-head no-print">
        <div>
          <h1>{concours.name}</h1>
          <p className="concours-meta">
            {formatDateFr(concours.date)}
            {concours.lieu ? ` · ${concours.lieu}` : ''} · {FORMAT_LABELS[concours.format]} ·{' '}
            {MODE_LABELS[concours.mode]}
            {concours.consolante ? ' · Consolante' : ''} · Parties en {concours.scoreMax} pts
          </p>
        </div>
        <div className="concours-actions">
          <span className={`status-chip status-${concours.status}`}>
            {STATUS_LABELS[concours.status]}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            ⚙ Paramètres
          </button>
          <a
            className="btn btn-ghost btn-sm"
            href={`/concours/${concours.id}/affichage`}
            target="_blank"
            rel="noreferrer"
            title="Affichage public (TV / vidéoprojecteur)"
          >
            📺 Affichage
          </a>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
        </div>
      </div>

      <nav className="tabs no-print">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={active === t.key ? 'tab active' : 'tab'}
            onClick={() => navigate(`/concours/${concours.id}/${t.key}`, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="print-title print-only">
        <h1>{concours.name}</h1>
        <p>
          {formatDateFr(concours.date)}
          {concours.lieu ? ` · ${concours.lieu}` : ''} · {FORMAT_LABELS[concours.format]}
        </p>
      </div>

      {active === 'equipes' && <TeamsTab concours={concours} teams={teams ?? []} />}
      {active === 'poules' && (
        <PoulesTab concours={concours} teams={teams ?? []} poules={poules ?? []} matches={matches ?? []} />
      )}
      {active === 'tableau' && (
        <BracketTab concours={concours} teams={teams ?? []} matches={matches ?? []} poules={poules ?? []} />
      )}
      {active === 'resultats' && (
        <ResultsTab concours={concours} teams={teams ?? []} poules={poules ?? []} matches={matches ?? []} />
      )}

      {editing && (
        <Modal title="Paramètres du concours" onClose={() => setEditing(false)}>
          <ConcoursForm
            initial={concours}
            lockStructure={concours.status !== 'inscriptions'}
            onCancel={() => setEditing(false)}
            onSubmit={async (input) => {
              await updateConcours({ ...concours, ...input });
              setEditing(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
