import { useRef, useState, type FocusEvent, type FormEvent } from 'react';
import type { Concours, Match } from '@shared';
import { evolutionEnTexte } from '@shared';
import {
  ajouterMeneAuMatch,
  clearScore,
  retirerMeneDuMatch,
  setMatchVainqueur,
  setScore,
} from '../db/actions';

interface Props {
  concours: Concours;
  match: Match;
  /** Libellés des deux camps, pour nommer les boutons de victoire. */
  labelA?: string;
  labelB?: string;
  disabled?: boolean;
  /** Partie terminée : n'afficher que le bouton de correction (les scores sont déjà visibles ailleurs). */
  editOnly?: boolean;
  /** Appelé après une saisie réussie (saisie rapide : revenir au champ n°). */
  onSaved?: () => void;
}

/**
 * Saisie / correction du score d'une partie.
 * Les deux scores se valident automatiquement (touche Entrée, ou dès qu'on
 * quitte les cases une fois les deux remplies) — aucun bouton à cliquer.
 */
export function ScoreForm({ concours, match, labelA, labelB, disabled, editOnly, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Saisir le score alors que le concours se joue au vainqueur seul. */
  const [scoreQuandMeme, setScoreQuandMeme] = useState(false);
  /** Panneau des mènes, replié par défaut. */
  const [menesOuvertes, setMenesOuvertes] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (match.byeA || match.byeB) {
    return <span className="score-view score-bye">exempt</span>;
  }
  const sideAKnown = Boolean(match.teamAId || (match.playersA && match.playersA.length > 0));
  const sideBKnown = Boolean(match.teamBId || (match.playersB && match.playersB.length > 0));
  if (!sideAKnown || !sideBKnown) {
    return <span className="score-view score-tbd">—</span>;
  }

  const ready = !match.done;
  const showForm = ready || editing;

  /** Valide dès que les deux cases sont remplies ; sinon ne fait rien. */
  const tryCommit = async () => {
    if (a.trim() === '' || b.trim() === '') return;
    setError(null);
    try {
      await setScore(concours, match, Number(a), Number(b));
      setEditing(false);
      setA('');
      setB('');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Score invalide');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void tryCommit();
  };

  /** Sauvegarde en quittant la saisie (sauf si le focus reste dans le formulaire). */
  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    void tryCommit();
  };

  const startEdit = () => {
    setA(match.scoreA !== null ? String(match.scoreA) : '');
    setB(match.scoreB !== null ? String(match.scoreB) : '');
    setEditing(true);
    setError(null);
  };

  const erase = async () => {
    await clearScore(concours, match);
    setEditing(false);
    setA('');
    setB('');
  };

  if (!showForm) {
    if (editOnly) {
      if (disabled) return null;
      return (
        <button type="button" className="btn-icon" onClick={startEdit} title="Corriger le score">
          ✎ corriger
        </button>
      );
    }
    if (match.scoreA === null || match.scoreB === null) {
      // Vainqueur désigné sans score.
      return (
        <span className="score-view score-done">
          <strong className="score-win">
            {match.vainqueur === 'A' ? (labelA ?? 'A') : (labelB ?? 'B')} gagne
          </strong>
          {!disabled && (
            <button
              type="button"
              className="btn-icon"
              onClick={startEdit}
              title="Corriger : saisir le score ou changer le vainqueur"
            >
              ✎
            </button>
          )}
        </span>
      );
    }
    return (
      <span className="score-view score-done">
        <strong className={match.scoreA! > match.scoreB! ? 'score-win' : ''}>
          {match.scoreA}
        </strong>
        <span className="score-sep">–</span>
        <strong className={match.scoreB! > match.scoreA! ? 'score-win' : ''}>
          {match.scoreB}
        </strong>
        {!disabled && (
          <button
            type="button"
            className="btn-icon"
            onClick={startEdit}
            title="Corriger le score"
          >
            ✎
          </button>
        )}
      </span>
    );
  }

  if (disabled) return <span className="score-view score-tbd">—</span>;

  // Concours au vainqueur seul : deux boutons, et le score reste accessible
  // pour qui veut le noter quand même.
  if (concours.vainqueurSeul && !scoreQuandMeme) {
    return (
      <span className="score-vainqueur">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            void setMatchVainqueur(concours, match, 'A').then(() => onSaved?.());
          }}
        >
          {labelA ?? 'A'} gagne
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            void setMatchVainqueur(concours, match, 'B').then(() => onSaved?.());
          }}
        >
          {labelB ?? 'B'} gagne
        </button>
        <button
          type="button"
          className="btn-icon"
          title="Saisir le score de cette partie"
          onClick={() => setScoreQuandMeme(true)}
        >
          123
        </button>
        {match.done && (
          <button type="button" className="btn-icon" title="Effacer" onClick={() => void erase()}>
            🗑
          </button>
        )}
      </span>
    );
  }

  return (
    <>
    <form ref={formRef} className="score-form" onSubmit={submit} onBlur={onBlur}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={concours.scoreMax}
        value={a}
        onChange={(e) => setA(e.target.value)}
        aria-label="Score équipe A"
        placeholder="–"
      />
      <span className="score-sep">–</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={concours.scoreMax}
        value={b}
        onChange={(e) => setB(e.target.value)}
        aria-label="Score équipe B"
        placeholder="–"
      />
      {/* Bouton de confirmation optionnel (surtout utile sur tablette). */}
      {a.trim() !== '' && b.trim() !== '' && (
        <button className="btn btn-primary btn-sm" title="Valider le score" aria-label="Valider">
          ✓
        </button>
      )}
      {editing && (
        <>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setEditing(false)}
            title="Annuler la correction"
          >
            ✕
          </button>
          <button
            type="button"
            className="btn-icon btn-icon-danger"
            onClick={() => void erase()}
            title="Effacer le score"
          >
            🗑
          </button>
        </>
      )}
      {error && <span className="score-error">{error}</span>}
      <button
        type="button"
        className="btn-icon"
        onClick={() => setMenesOuvertes(!menesOuvertes)}
        title="Saisir la partie mène par mène (manuel : « Evolution du Score »)"
        aria-expanded={menesOuvertes}
      >
        ⊕ mènes
      </button>
    </form>
    {menesOuvertes && (
      <MenesInline concours={concours} match={match} labelA={labelA} labelB={labelB} />
    )}
    </>
  );
}

/**
 * Saisie mène par mène — les boutons `+` de l'écran « Voir Scores » du manuel,
 * plus l'évolution en clair et une annulation.
 *
 * Replié par défaut : sur le terrain, la table de marque saisit un score final,
 * et n'ouvre ceci que pour suivre une partie en cours ou reconstituer une
 * contestation.
 */
function MenesInline({
  concours,
  match,
  labelA,
  labelB,
}: {
  concours: Concours;
  match: Match;
  labelA?: string;
  labelB?: string;
}) {
  const [points, setPoints] = useState(1);
  const [erreur, setErreur] = useState<string | null>(null);
  const menes = match.menes ?? [];

  const ajouter = async (camp: 'a' | 'b') => {
    setErreur(null);
    try {
      await ajouterMeneAuMatch(concours, match, camp, points);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Mène refusée');
    }
  };

  return (
    <div className="menes-inline">
      <span className="menes-evolution" title="Evolution du Score">
        {evolutionEnTexte(menes)}
      </span>
      <label className="menes-points">
        points
        <select value={points} onChange={(e) => setPoints(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn btn-sm" onClick={() => void ajouter('a')}>
        + {labelA ?? 'A'}
      </button>
      <button type="button" className="btn btn-sm" onClick={() => void ajouter('b')}>
        + {labelB ?? 'B'}
      </button>
      {menes.length > 0 && (
        <button
          type="button"
          className="btn-icon"
          onClick={() => void retirerMeneDuMatch(concours, match)}
          title="Annuler la dernière mène"
        >
          ↶
        </button>
      )}
      {erreur && <span className="score-error">{erreur}</span>}
    </div>
  );
}
