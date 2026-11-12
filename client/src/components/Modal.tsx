import { X } from 'lucide-react';
import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Ce qui peut recevoir le focus au clavier dans la modale. */
const FOCUSABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusables(racine: HTMLElement): HTMLElement[] {
  return [...racine.querySelectorAll<HTMLElement>(FOCUSABLES)].filter(
    // Un élément masqué (`display: none`, `<details>` replié) n'a pas de boîte.
    (el) => el.getClientRects().length > 0,
  );
}

export function Modal({ title, onClose, children }: Props) {
  const titreId = useId();
  const boite = useRef<HTMLDivElement>(null);
  const fermeture = useRef<HTMLButtonElement>(null);
  // L'élément qui avait le focus à l'ouverture — le bouton qui a ouvert la
  // modale, le plus souvent. Lu au premier rendu, avant que le focus ne bouge.
  const origine = useRef<Element | null>(null);
  if (origine.current === null && typeof document !== 'undefined') {
    origine.current = document.activeElement;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // À l'ouverture : focus sur le premier champ ou bouton du contenu, le bouton
  // « Fermer » en dernier recours. Une modale qui pose déjà son focus
  // (`autoFocus`, ou un `ref` comme le lecteur de licences) le garde. À la
  // fermeture : retour à l'élément d'origine, pour que le clavier reprenne là
  // où il était au lieu de repartir du haut de la page.
  useEffect(() => {
    const racine = boite.current;
    if (racine && !racine.contains(document.activeElement)) {
      const premier = focusables(racine).find((el) => el !== fermeture.current);
      (premier ?? fermeture.current)?.focus();
    }
    const retour = origine.current;
    return () => {
      if (retour instanceof HTMLElement && retour.isConnected) retour.focus();
    };
  }, []);

  // Piège à focus : Tab et Maj+Tab tournent dans la modale, sans s'échapper
  // vers la page grisée derrière.
  const pieger = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !boite.current) return;
    const liste = focusables(boite.current);
    if (liste.length === 0) return;
    const premier = liste[0]!;
    const dernier = liste[liste.length - 1]!;
    const actif = document.activeElement;
    if (e.shiftKey && (actif === premier || !boite.current.contains(actif))) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && (actif === dernier || !boite.current.contains(actif))) {
      e.preventDefault();
      premier.focus();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={pieger}
      >
        <div className="modal-head">
          <h2 id={titreId}>{title}</h2>
          <button
            ref={fermeture}
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="ic" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
