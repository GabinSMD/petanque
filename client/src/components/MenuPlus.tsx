import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Menu « Plus » : range les actions rares ou lourdes de conséquences à l'écart
 * de celles qu'on fait cent fois par jour, sans les cacher. Chaque entrée dit
 * ce qu'elle entraîne — c'est la place qu'un simple bouton n'avait pas.
 */
export function MenuPlus({ libelle = 'Plus', children }: { libelle?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const fermer = (e: Event) => {
      const menu = ref.current;
      if (!menu?.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        menu.open = false;
        menu.querySelector('summary')?.focus();
      } else if (!menu.contains(e.target as Node)) {
        menu.open = false;
      }
    };
    document.addEventListener('pointerdown', fermer);
    document.addEventListener('keydown', fermer);
    return () => {
      document.removeEventListener('pointerdown', fermer);
      document.removeEventListener('keydown', fermer);
    };
  }, []);

  return (
    <details className="menu-plus no-print" ref={ref}>
      <summary className="btn btn-ghost btn-sm">
        {libelle} <ChevronDown className="ic" aria-hidden />
      </summary>
      {/* Un clic sur une entrée referme le menu : l'action est partie. */}
      <div
        className="menu-plus-liste"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.menu-plus-item') && ref.current) {
            ref.current.open = false;
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function MenuPlusItem({
  icone,
  titre,
  detail,
  danger,
  onClick,
}: {
  icone?: ReactNode;
  titre: string;
  /** Ce que l'action entraîne, dit avant qu'on clique. */
  detail?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={danger ? 'menu-plus-item menu-plus-item-danger' : 'menu-plus-item'}
      onClick={onClick}
    >
      {icone}
      <span>
        <strong>{titre}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </button>
  );
}
