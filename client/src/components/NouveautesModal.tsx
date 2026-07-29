import { useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NouveauteAction } from '@shared';
import { fermerNouveautes, getNouveautes, subscribeNouveautes } from '../help/nouveautesState';
import { startTour } from '../help/tourState';
import { concoursTour, dashboardTour } from '../help/tours';

/**
 * Pop-up « Nouveautés » : ce qui a changé depuis la dernière fois. Montée dans
 * le Layout, mais déclenchée seulement depuis le tableau de bord (pour ne pas
 * couper un tirage ou une saisie en cours) ou à la demande.
 */
export function NouveautesHost() {
  const vue = useSyncExternalStore(subscribeNouveautes, getNouveautes);
  const navigate = useNavigate();

  useEffect(() => {
    if (!vue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermerNouveautes();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vue]);

  if (!vue) return null;

  const suivre = (action: NouveauteAction) => {
    fermerNouveautes();
    if (action.tour) {
      startTour(action.tour === 'concours' ? concoursTour : dashboardTour);
      return;
    }
    if (action.path) navigate(action.path);
  };

  const versions = vue.entrees.map((e) => e.version);
  const titre = vue.rappel
    ? 'Quoi de neuf ?'
    : versions.length > 1
      ? `Nouveautés des versions ${versions[versions.length - 1]} à ${versions[0]}`
      : `Nouveautés de la version ${versions[0]}`;

  return (
    <div className="modal-backdrop no-print" onClick={fermerNouveautes}>
      <div
        className="modal nouveautes-modal"
        role="dialog"
        aria-label={titre}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nouveautes-head">
          <h2>✨ {titre}</h2>
          <p className="nouveautes-intro">
            {vue.rappel
              ? 'Le tour d\'horizon de ce que l\'application sait faire de plus.'
              : 'L\'application s\'est mise à jour toute seule. Voici ce qu\'elle a gagné.'}
          </p>
        </div>

        <div className="nouveautes-body">
          {vue.entrees.map((entree) => (
            <section key={entree.version} className="nouveautes-version">
              {vue.entrees.length > 1 && (
                <h3 className="nouveautes-version-title">
                  Version {entree.version}
                  <small>{dateCourte(entree.date)}</small>
                </h3>
              )}
              <ul className="nouveautes-list">
                {entree.items.map((item) => (
                  <li key={item.titre}>
                    {item.icone && (
                      <span className="nouveautes-icone" aria-hidden>
                        {item.icone}
                      </span>
                    )}
                    <div className="nouveautes-item-text">
                      <strong>{item.titre}</strong>
                      <p>{item.texte}</p>
                      {item.action && (
                        <button
                          className="btn btn-sm nouveautes-action"
                          onClick={() => suivre(item.action!)}
                        >
                          🧭 {item.action.label}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="nouveautes-actions">
          <button className="btn btn-primary" onClick={fermerNouveautes}>
            J'ai compris
          </button>
        </div>
        <p className="nouveautes-hint">
          Vous retrouverez cette fenêtre en cliquant sur le numéro de version, en bas de
          l'écran.
        </p>
      </div>
    </div>
  );
}

/** « 2026-07-29 » → « 29 juillet 2026 », et la date brute si elle est illisible. */
function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
