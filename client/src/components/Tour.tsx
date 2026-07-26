import { useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { getActiveTour, stopTour, subscribeTour } from '../help/tourState';

/**
 * Visite guidée sans dépendance : met en lumière l'élément ciblé
 * (découpe par box-shadow) et affiche une carte explicative.
 * Les étapes dont la cible est absente sont ignorées.
 */
export function TourHost() {
  const tour = useSyncExternalStore(subscribeTour, getActiveTour);
  if (!tour) return null;
  return <TourOverlay key={tour.steps[0]?.title} />;
}

function TourOverlay() {
  const tour = getActiveTour()!;
  const steps = tour.steps;
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[idx];

  const measure = useCallback(() => {
    if (!step) return;
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    setRect(el.getBoundingClientRect());
  }, [step]);

  // Cible absente (autre page, élément masqué) : passe l'étape.
  useEffect(() => {
    if (step?.target && !document.querySelector(step.target)) {
      if (idx < steps.length - 1) setIdx(idx + 1);
      else stopTour();
    }
  }, [idx, step, steps.length]);

  useEffect(() => {
    if (step?.target) {
      document.querySelector(step.target)?.scrollIntoView({ block: 'center' });
    }
    measure();
    const tick = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure, step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stopTour();
      if (e.key === 'ArrowRight' && idx < steps.length - 1) setIdx(idx + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, steps.length]);

  if (!step) return null;

  const pad = 7;
  const spotlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Position de la carte : sous la cible si possible, sinon au-dessus, sinon centrée.
  const cardW = 340;
  let cardStyle: CSSProperties;
  if (spotlight) {
    const below = spotlight.top + spotlight.height + 16;
    const spaceBelow = window.innerHeight - below;
    const left = Math.min(
      Math.max(12, spotlight.left),
      Math.max(12, window.innerWidth - cardW - 12),
    );
    cardStyle =
      spaceBelow > 190
        ? { top: below, left }
        : { top: Math.max(12, spotlight.top - 200), left };
  } else {
    cardStyle = {
      top: Math.max(60, window.innerHeight * 0.28),
      left: Math.max(12, (window.innerWidth - cardW) / 2),
    };
  }

  const last = idx === steps.length - 1;

  return (
    <div className="tour-layer" role="dialog" aria-label="Visite guidée">
      <div
        className={`tour-backdrop${spotlight ? '' : ' tour-backdrop-dim'}`}
        onClick={stopTour}
      />
      {spotlight && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}
      <div className="tour-card" style={cardStyle}>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-controls">
          <span className="tour-progress">
            {idx + 1} / {steps.length}
          </span>
          <span className="tour-buttons">
            <button className="btn btn-ghost btn-sm" onClick={stopTour}>
              Passer
            </button>
            {idx > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setIdx(idx - 1)}>
                ← Précédent
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => (last ? stopTour() : setIdx(idx + 1))}
            >
              {last ? 'Terminer ✓' : 'Suivant →'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
