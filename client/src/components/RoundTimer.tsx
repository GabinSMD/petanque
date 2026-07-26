import { useEffect, useRef, useState } from 'react';

interface Props {
  concoursId: string;
  /** Durée d'une partie au temps, en minutes. */
  minutes: number;
}

interface Persisted {
  /** Timestamp de fin quand le chrono tourne, sinon null. */
  endsAt: number | null;
  /** Temps restant (ms) quand le chrono est en pause. */
  remainingMs: number;
}

function load(key: string, totalMs: number): Persisted {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (typeof parsed.remainingMs === 'number') return parsed;
    }
  } catch {
    /* stockage indisponible : on repart à zéro */
  }
  return { endsAt: null, remainingMs: totalMs };
}

/** Petit bip via Web Audio, ignoré si l'API est indisponible. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio bloqué : silencieux */
  }
}

/**
 * Chrono de ronde pour les parties au temps : décompte partagé (persisté
 * localement), démarrage / pause / remise à zéro, alerte « dernière mène »
 * puis « temps écoulé » avec un bip.
 */
export function RoundTimer({ concoursId, minutes }: Props) {
  const totalMs = minutes * 60_000;
  const key = `chrono:${concoursId}`;
  const [state, setState] = useState<Persisted>(() => load(key, totalMs));
  const [now, setNow] = useState(() => Date.now());
  const beepedRef = useRef(false);

  const running = state.endsAt !== null;
  const remaining = running ? Math.max(0, state.endsAt! - now) : state.remainingMs;

  // Tic-tac quand le chrono tourne.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Persistance locale (résiste au changement d'onglet / au rechargement).
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [key, state]);

  // Bip unique au passage à zéro.
  useEffect(() => {
    if (running && remaining <= 0 && !beepedRef.current) {
      beepedRef.current = true;
      beep();
      setState({ endsAt: null, remainingMs: 0 });
    }
    if (remaining > 0) beepedRef.current = false;
  }, [running, remaining]);

  const start = () => {
    const base = remaining > 0 ? remaining : totalMs;
    setNow(Date.now());
    setState({ endsAt: Date.now() + base, remainingMs: base });
  };
  const pause = () => setState({ endsAt: null, remainingMs: remaining });
  const reset = () => {
    beepedRef.current = false;
    setState({ endsAt: null, remainingMs: totalMs });
  };

  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);
  const expired = remaining <= 0;
  const warning = !expired && remaining <= 5 * 60_000;

  return (
    <div
      className={`round-timer${expired ? ' timer-expired' : warning ? ' timer-warning' : ''}`}
      role="timer"
      aria-live="polite"
    >
      <span className="timer-clock">
        {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
      </span>
      <span className="timer-state">
        {expired ? 'Temps écoulé' : warning ? 'Dernière mène' : `Partie au temps · ${minutes} min`}
      </span>
      <span className="timer-controls no-print">
        {running ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={pause}>
            ⏸ Pause
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={start}>
            {remaining > 0 && remaining < totalMs ? '▶ Reprendre' : '▶ Démarrer'}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset} title="Remettre à zéro">
          ↺
        </button>
      </span>
    </div>
  );
}
