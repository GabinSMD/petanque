import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Concours, ConcoursStatus, Match, Poule, Team } from '@shared';
import { pouleOutcome, pouleSizes, winnerOf } from '@shared';
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
          <button
            className="btn btn-ghost btn-sm"
            data-tour="params"
            onClick={() => setEditing(true)}
          >
            ⚙ Paramètres
          </button>
          <a
            className="btn btn-ghost btn-sm"
            data-tour="affichage"
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

      <NextStepBanner
        concours={concours}
        teams={teams ?? []}
        poules={poules ?? []}
        matches={matches ?? []}
        activeTab={active}
        onGo={(tab) => navigate(`/concours/${concours.id}/${tab}`, { replace: true })}
      />

      <nav className="tabs no-print" data-tour="tabs">
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

interface NextStep {
  icon: string;
  text: string;
  /** Onglet où se joue la prochaine action. */
  tab?: string;
}

function nextStepOf(
  concours: Concours,
  teams: Team[],
  poules: Poule[],
  matches: Match[],
): NextStep {
  const active = teams.filter((t) => !t.forfait).length;

  if (concours.status === 'inscriptions') {
    if (concours.mode === 'poules') {
      if (active < 4) {
        return {
          icon: '✍️',
          text: `Inscrivez vos équipes (${active}/4 minimum pour des poules).`,
          tab: 'equipes',
        };
      }
      if (!pouleSizes(active)) {
        return {
          icon: '⚠️',
          text: `${active} équipes ne se répartissent pas en poules — inscrivez-en une de plus (ou retirez-en une).`,
          tab: 'equipes',
        };
      }
      return {
        icon: '🎲',
        text: `${active} équipes prêtes : place au tirage des poules !`,
        tab: 'poules',
      };
    }
    return active < 2
      ? { icon: '✍️', text: 'Inscrivez au moins 2 équipes.', tab: 'equipes' }
      : { icon: '🎲', text: `${active} équipes prêtes : tirez le tableau !`, tab: 'tableau' };
  }

  if (concours.status === 'poules') {
    const pouleMatches = matches.filter((m) => m.stage === 'poule');
    const remaining = pouleMatches.filter((m) => !m.done).length;
    if (remaining > 0) {
      return {
        icon: '⏱',
        text: `Saisissez les scores : ${remaining} partie${remaining > 1 ? 's' : ''} de poule restante${remaining > 1 ? 's' : ''}.`,
        tab: 'poules',
      };
    }
    const complete = poules.every((p) =>
      pouleOutcome(p, pouleMatches.filter((m) => m.pouleId === p.id)).complete,
    );
    if (complete) {
      return {
        icon: '🏁',
        text: 'Toutes les poules sont terminées : générez le tableau final.',
        tab: 'poules',
      };
    }
  }

  if (concours.status === 'tableau') {
    const bracket = matches.filter((m) => m.stage !== 'poule');
    const playable = bracket.filter((m) => !m.done && m.teamAId && m.teamBId).length;
    const maxRound = bracket.length
      ? Math.max(...bracket.filter((m) => m.stage === 'principal').map((m) => m.round))
      : 0;
    const finale = bracket.find(
      (m) => m.stage === 'principal' && m.round === maxRound && m.position === 0,
    );
    if (winnerOf(finale)) {
      return {
        icon: '🏆',
        text: 'La finale est jouée ! Clôturez le concours pour figer le palmarès.',
        tab: 'tableau',
      };
    }
    return {
      icon: '⏱',
      text: `Tableau en cours : ${playable} partie${playable > 1 ? 's' : ''} à saisir.`,
      tab: 'tableau',
    };
  }

  return {
    icon: '🎉',
    text: 'Concours terminé — consultez le palmarès ou imprimez les résultats.',
    tab: 'resultats',
  };
}

const TAB_NAMES: Record<string, string> = {
  equipes: 'Équipes',
  poules: 'Poules',
  tableau: 'Tableau',
  resultats: 'Résultats',
};

function NextStepBanner({
  concours,
  teams,
  poules,
  matches,
  activeTab,
  onGo,
}: {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
  activeTab: string;
  onGo: (tab: string) => void;
}) {
  const step = nextStepOf(concours, teams, poules, matches);
  return (
    <div className="next-step no-print" data-tour="next-step">
      <span className="next-step-icon">{step.icon}</span>
      <span className="next-step-text">{step.text}</span>
      {step.tab && step.tab !== activeTab && (
        <button className="btn btn-sm next-step-go" onClick={() => onGo(step.tab!)}>
          Aller à l'onglet {TAB_NAMES[step.tab] ?? step.tab} →
        </button>
      )}
    </div>
  );
}
