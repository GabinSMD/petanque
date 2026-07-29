import { useState } from 'react';
import { detailEcartees, resumeEcartees } from '@shared';
import { useDonneesEcartees } from '../db/hooks';
import { oublierDonneesEcartees } from '../sync/engine';
import { Modal } from './Modal';
import { APP_COMMIT, APP_VERSION } from '../lib/version';

/**
 * Signalement des données reçues mais illisibles.
 *
 * La synchronisation refuse d'appliquer un changement cassé plutôt que de
 * blanchir l'écran — mais le refuser en silence laisse l'organisateur devant
 * onze équipes ici et douze là-bas. Il cherche, ou il ressaisit ce qui existe
 * déjà ailleurs et se retrouve avec un dossard en double.
 *
 * D'où cette pastille, à côté du badge de synchronisation : discrète, mais
 * présente jusqu'à ce qu'on l'ait ouverte et acquittée. Un avertissement qu'on
 * ne peut pas faire taire devient du papier peint ; celui-ci s'efface quand
 * l'organisateur dit l'avoir vu.
 */
export function AlerteEcartees() {
  const ecartees = useDonneesEcartees();
  const [ouvert, setOuvert] = useState(false);
  const resume = resumeEcartees(ecartees);
  if (!resume) return null;

  const rapport = [
    'Pétanque Concours — données écartées',
    APP_COMMIT ? `Version ${APP_VERSION} (commit ${APP_COMMIT})` : `Version ${APP_VERSION}`,
    detailEcartees(ecartees),
  ].join('\n');

  return (
    <>
      <button
        className="sync-badge sync-ecartees"
        onClick={() => setOuvert(true)}
        title="Des données reçues n'ont pas pu être lues"
      >
        <span className="sync-dot" /> ⚠ {ecartees.length}
      </button>
      {ouvert && (
        <Modal title="Données reçues illisibles" onClose={() => setOuvert(false)}>
          <p>{resume}</p>
          <p className="hint">
            Cela arrive quand un appareil d'une autre version envoie une donnée que cette
            application ne sait pas lire. Elle reste sur le serveur : rien n'a été supprimé.
          </p>
          <details className="incident-details">
            <summary>Détail technique</summary>
            <pre>{rapport}</pre>
          </details>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                void oublierDonneesEcartees();
                setOuvert(false);
              }}
            >
              J'ai vu
            </button>
            <button className="btn btn-ghost" onClick={() => setOuvert(false)}>
              Garder le signalement
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
