import { useRef, useState, type FocusEvent, type FormEvent } from 'react';
import type { Concours, Match } from '@shared';
import { clearScore, setScore } from '../db/actions';

interface Props {
  concours: Concours;
  match: Match;
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
export function ScoreForm({ concours, match, disabled, editOnly, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  return (
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
    </form>
  );
}
