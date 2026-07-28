import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Concours, ConcoursStatus, Match, Poule, Team } from '@shared';
import { pouleOutcome, pouleSizes, rondesTirees, seriesTirees, winnerOf } from '@shared';
import { updateConcours } from '../db/actions';
import { useConcours, useMatches, usePoules, useTeams } from '../db/hooks';
import { ConcoursForm } from '../components/ConcoursForm';
import { DeclarationsWatch } from '../components/DeclarationsWatch';
import { Modal } from '../components/Modal';
import { QuickScore } from '../components/QuickScore';
import { RoundTimer } from '../components/RoundTimer';
import { ShareModal } from '../components/ShareModal';
import { useCallNotifier } from '../lib/notifier';
import {
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  MODE_LABELS,
  entrantWord,
  formatDateFr,
  isIndividualMode,
  isRondesMode,
  isTirMode,
  statusLabel,
} from '../lib/labels';
import { TeamsTab } from './tabs/TeamsTab';
import { LicencesTab } from './tabs/LicencesTab';
import { PoulesTab } from './tabs/PoulesTab';
import { BracketTab } from './tabs/BracketTab';
import { RondesTab } from './tabs/RondesTab';
import { TirTab } from './tabs/TirTab';
import { TerrainsTab } from './tabs/TerrainsTab';
import { ResultsTab } from './tabs/ResultsTab';

const DEFAULT_TAB: Record<ConcoursStatus, string> = {
  inscriptions: 'equipes',
  poules: 'poules',
  tableau: 'tableau',
  rondes: 'rondes',
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
  const [sharing, setSharing] = useState(false);
  useCallNotifier(concours, teams ?? [], poules ?? [], matches ?? []);

  if (!concours) {
    return (
      <div className="page">
        <p className="empty-state">
          Concours introuvable (ou pas encore synchronisé). <Link to="/">← Retour</Link>
        </p>
      </div>
    );
  }

  const rondesMode = isRondesMode(concours.mode);
  const tirMode = isTirMode(concours.mode);
  const controleLicences = Boolean(
    concours.categorieAge ||
      concours.homogene ||
      (concours.critereSexe && concours.critereSexe !== 'tous') ||
      (concours.critereClassification && concours.critereClassification !== 'tous'),
  );
  const tabs = [
    {
      key: 'equipes',
      label: `👥 ${
        tirMode ? 'Tireurs' : isIndividualMode(concours.mode) ? 'Participants' : 'Équipes'
      } (${teams?.length ?? 0})`,
    },
    ...(concours.mode === 'poules' ? [{ key: 'poules', label: '🎲 Poules' }] : []),
    ...(tirMode
      ? [{ key: 'series', label: '🏹 Séries' }]
      : rondesMode
        ? [
            { key: 'rondes', label: '🔄 Rondes' },
            // Les phases finales d'un concours en rondes (manuel §3.D.15) :
            // l'onglet n'apparaît que quand le tableau existe.
            ...((matches ?? []).some((m) => m.stage !== 'ronde')
              ? [{ key: 'tableau', label: '🏆 Phases finales' }]
              : []),
          ]
        : [{ key: 'tableau', label: '🏆 Tableau' }]),
    // Le dépôt des licences n'a de sens qu'avec des critères fédéraux : un
    // concours de club n'a rien à contrôler.
    ...(controleLicences ? [{ key: 'licences', label: '🪪 Licences' }] : []),
    ...(!tirMode && concours.status !== 'inscriptions' && concours.planTerrains !== false
      ? [{ key: 'terrains', label: '🟦 Terrains' }]
      : []),
    { key: 'resultats', label: '📋 Résultats' },
  ];
  const fallbackTab =
    tirMode && concours.status === 'rondes' ? 'series' : DEFAULT_TAB[concours.status];
  const active = tabs.some((t) => t.key === tab) ? tab! : fallbackTab;

  return (
    <div className="page">
      <div className="concours-head no-print">
        <div>
          <h1>{concours.name}</h1>
          <p className="concours-meta">
            {formatDateFr(concours.date)}
            {concours.lieu ? ` · ${concours.lieu}` : ''}
            {concours.discipline === 'jeu_provencal'
              ? ` · ${DISCIPLINE_LABELS.jeu_provencal}`
              : ''}
            {concours.category ? ` · ${concours.category}` : ''}
            {!tirMode && ` · ${FORMAT_LABELS[concours.format]}`} · {MODE_LABELS[concours.mode]}
            {concours.consolante ? ' · Consolante' : ''}
            {!tirMode && ` · Parties en ${concours.scoreMax} pts`}
            {concours.tempsLimite ? ` · Temps limité ${concours.tempsLimite} min` : ''}
          </p>
        </div>
        <div className="concours-actions">
          <span className={`status-chip status-${concours.status}`}>
            {statusLabel(concours.mode, concours.status)}
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
          <button
            className="btn btn-ghost btn-sm"
            data-tour="share"
            onClick={() => setSharing(true)}
          >
            🔗 Partager
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
        </div>
      </div>

      {concours.tempsLimite && concours.status !== 'inscriptions' && concours.status !== 'termine' && (
        <RoundTimer concoursId={concours.id} minutes={concours.tempsLimite} />
      )}

      <NextStepBanner
        concours={concours}
        teams={teams ?? []}
        poules={poules ?? []}
        matches={matches ?? []}
        activeTab={active}
        onGo={(tab) => navigate(`/concours/${concours.id}/${tab}`, { replace: true })}
      />

      <DeclarationsWatch
        concours={concours}
        teams={teams ?? []}
        poules={poules ?? []}
        matches={matches ?? []}
      />

      {concours.status !== 'termine' && !tirMode && (
        <QuickScore
          concours={concours}
          teams={teams ?? []}
          poules={poules ?? []}
          matches={matches ?? []}
        />
      )}

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
      {active === 'licences' && <LicencesTab concours={concours} teams={teams ?? []} />}
      {active === 'poules' && (
        <PoulesTab concours={concours} teams={teams ?? []} poules={poules ?? []} matches={matches ?? []} />
      )}
      {active === 'rondes' && (
        <RondesTab concours={concours} teams={teams ?? []} matches={matches ?? []} />
      )}
      {active === 'series' && (
        <TirTab concours={concours} teams={teams ?? []} matches={matches ?? []} />
      )}
      {active === 'terrains' && (
        <TerrainsTab
          concours={concours}
          teams={teams ?? []}
          poules={poules ?? []}
          matches={matches ?? []}
        />
      )}
      {active === 'tableau' && (
        <BracketTab concours={concours} teams={teams ?? []} matches={matches ?? []} poules={poules ?? []} />
      )}
      {active === 'resultats' && (
        <ResultsTab concours={concours} teams={teams ?? []} poules={poules ?? []} matches={matches ?? []} />
      )}

      {sharing && <ShareModal concours={concours} onClose={() => setSharing(false)} />}

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

  if (isTirMode(concours.mode)) {
    if (concours.status === 'inscriptions') {
      return active < 1
        ? { icon: '✍️', text: 'Inscrivez vos tireurs.', tab: 'equipes' }
        : {
            icon: '🏹',
            text: `${active} tireur${active > 1 ? 's' : ''} prêt${active > 1 ? 's' : ''} : ouvrez la série 1 !`,
            tab: 'series',
          };
    }
    if (concours.status === 'rondes') {
      const serieMs = matches.filter((m) => m.stage === 'ronde');
      const pending = serieMs.filter((m) => !m.done).length;
      const series = seriesTirees(serieMs);
      const planned = concours.nbRondes ?? 2;
      if (pending > 0) {
        return {
          icon: '⏱',
          text: `Saisissez les scores : ${pending} feuille${pending > 1 ? 's' : ''} de tir restante${pending > 1 ? 's' : ''} (série ${series}).`,
          tab: 'series',
        };
      }
      if (series < planned) {
        return {
          icon: '🏹',
          text: `Série ${series} complète : ouvrez la série ${series + 1}.`,
          tab: 'series',
        };
      }
      return {
        icon: '🏁',
        text: 'Toutes les séries sont tirées : clôturez le concours.',
        tab: 'series',
      };
    }
  }

  if (isRondesMode(concours.mode)) {
    const word = entrantWord(concours.mode, active > 1);
    if (concours.status === 'inscriptions') {
      if (active < 2) {
        return {
          icon: '✍️',
          text: `Inscrivez vos ${entrantWord(concours.mode, true)} (2 minimum).`,
          tab: 'equipes',
        };
      }
      return {
        icon: '🎲',
        text:
          concours.mode === 'championnat'
            ? `${active} ${word} : générez le calendrier !`
            : `${active} ${word} prêt${isIndividualMode(concours.mode) ? 's' : 'es'} : tirez la ronde 1 !`,
        tab: 'rondes',
      };
    }
    if (concours.status === 'rondes') {
      const rondeMs = matches.filter((m) => m.stage === 'ronde');
      const tirees = rondesTirees(rondeMs);
      const pending = rondeMs.filter((m) => !m.done).length;
      const planned =
        concours.mode === 'championnat' ? tirees : (concours.nbRondes ?? 4);
      if (pending > 0) {
        return {
          icon: '⏱',
          text: `Saisissez les scores : ${pending} partie${pending > 1 ? 's' : ''} restante${pending > 1 ? 's' : ''}.`,
          tab: 'rondes',
        };
      }
      if (tirees < planned) {
        return {
          icon: '🎲',
          text: `Ronde ${tirees} terminée : tirez la ronde ${tirees + 1}.`,
          tab: 'rondes',
        };
      }
      return {
        icon: '🏁',
        text: 'Toutes les rondes sont jouées : clôturez le concours (onglet Rondes).',
        tab: 'rondes',
      };
    }
  }

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
