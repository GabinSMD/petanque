import { useState } from 'react';
import { useSession } from '../db/hooks';
import { appIsElsewhere, appUrl } from '../lib/appUrl';
import { Modal } from './Modal';

const VU_KEY = 'petanque.demenagementVu';

function dejaVu(): boolean {
  try {
    return localStorage.getItem(VU_KEY) === '1';
  } catch {
    return false;
  }
}

function memoriser(): void {
  try {
    localStorage.setItem(VU_KEY, '1');
  } catch {
    // Stockage refusé : la fenêtre reviendra. C'est le bon sens de l'erreur.
  }
}

/**
 * Avertissement affiché quand l'application tourne sur une origine qui n'est
 * plus la sienne — le cas d'un appareil qui l'utilisait avant qu'elle déménage
 * sur son propre nom de domaine.
 *
 * Le service worker de l'ancienne origine continue de servir l'application
 * depuis son cache : ces appareils fonctionnent parfaitement, l'API étant
 * servie sous les deux noms, et n'ont donc aucune raison de s'apercevoir de
 * quoi que ce soit. Le bandeau de la page vitrine ne les atteint pas : il ne
 * s'adresse qu'aux visiteurs **sans** session, et eux en ont une.
 *
 * D'où deux niveaux, et pas un seul :
 *
 * - une fenêtre à la première rencontre, qui explique ce qui se passe et ce
 *   qu'il y a à faire selon qu'on a un compte ou non ;
 * - un bandeau qui, lui, ne s'en va pas. Un avertissement qu'on peut renvoyer
 *   définitivement d'un clic ne déménage personne.
 */
export function AncienneAdresse() {
  const session = useSession();
  const [vu, setVu] = useState(dejaVu);
  const [fenetre, setFenetre] = useState(() => !dejaVu());

  if (!appIsElsewhere() || !session) return null;

  const invite = session.guest === true;
  const destination = appUrl(invite ? '/' : '/login');

  const fermer = () => {
    memoriser();
    setVu(true);
    setFenetre(false);
  };

  return (
    <>
      <div className="demenagement-bandeau no-print">
        <span aria-hidden>📦</span>
        <p>
          Cette adresse n’héberge plus l’application : elle a déménagé sur{' '}
          <strong>{hote(destination)}</strong>.
        </p>
        <a className="btn btn-sm" href={destination}>
          Y aller
        </a>
        {vu && !fenetre && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFenetre(true)}>
            Pourquoi ?
          </button>
        )}
      </div>

      {fenetre && (
        <Modal title="📦 L’application a déménagé" onClose={fermer}>
          <p>
            Elle vit désormais sur <strong>{hote(destination)}</strong>. Cette adresse-ci
            ne garde que la page de présentation — mais votre appareil continue d’ouvrir
            l’ancienne version, mise en cache pour le hors-ligne. Tout fonctionne, rien
            n’est perdu : il n’y a qu’un déménagement à finir.
          </p>

          {invite ? (
            <>
              <p>
                <strong>Vous êtes en mode invité</strong> : vos concours n’ont jamais été
                envoyés au serveur, ils n’existent que dans ce navigateur, et à cette
                adresse. Ils ne suivront pas tout seuls.
              </p>
              <p>
                Avant de partir, exportez chacun d’eux — onglet <strong>Résultats</strong>{' '}
                du concours, bouton <strong>💾 Sauvegarde (JSON)</strong> — puis
                réimportez-les à la nouvelle adresse depuis{' '}
                <strong>Importer une sauvegarde</strong>. Un concours en cours de journée
                peut attendre la fin du concours : rien ne presse.
              </p>
            </>
          ) : (
            <p>
              Vos concours <strong>synchronisés</strong> vous attendent à la nouvelle
              adresse : connectez-vous avec le même compte et ils redescendront. Si le
              compteur de synchronisation affiche encore des modifications en attente,
              laissez-les partir avant de changer d’adresse.
            </p>
          )}

          <div className="form-actions">
            <a className="btn btn-primary" href={destination}>
              Aller à la nouvelle adresse
            </a>
            <button className="btn" onClick={fermer}>
              Plus tard
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** « https://app.exemple.fr/login » → « app.exemple.fr ». */
function hote(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
