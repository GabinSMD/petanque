import { besoinModeFederal } from '@shared';
import { useConcoursList, useLicenciesCount } from '../db/hooks';
import { useModeFederal } from '../lib/modeFederal';
import { Modal } from './Modal';

/**
 * Réglages de l'appareil. Le seul pour l'instant : le mode fédéral, qui décide
 * de ce que l'application montre — pas de ce qu'elle fait.
 */
export function ReglagesModal({ onClose }: { onClose: () => void }) {
  const concours = useConcoursList() ?? [];
  const licencies = useLicenciesCount();
  const besoin = besoinModeFederal({ concours, licencies });
  const { actif, preference, choisir, oublier } = useModeFederal(besoin);

  return (
    <Modal title="⚙ Réglages" onClose={onClose}>
      <div className="reglages-modal">
        <label className="checkbox-label">
          <input type="checkbox" checked={actif} onChange={(e) => choisir(e.target.checked)} />
          Mode fédéral : concours officiels, licences et documents du comité
        </label>

        <p className="hint">
          Décoché, l'application s'en tient à ce qu'il faut pour un concours de club : inscriptions,
          tirage, poules, tableaux, scores et indemnités. Le fichier des licenciés, le championnat
          des clubs, les critères officiels et les documents remis au comité sont masqués.
        </p>

        <p className="hint">
          Ce réglage ne change <strong>que l'affichage</strong>. Un concours déjà déclaré officiel
          continue de contrôler ses licences, et ses écrans restent visibles sur lui — on ne
          désactive pas en silence une règle sur laquelle vous comptez.
        </p>

        {preference === null && (
          <p className="hint">
            {besoin
              ? 'Activé automatiquement : vous avez déjà un concours officiel ou un fichier de licenciés.'
              : 'Masqué par défaut : rien dans vos concours ne réclame le mode fédéral.'}
          </p>
        )}

        {preference !== null && (
          <p className="hint">
            Réglé à la main.{' '}
            <button className="btn-lien" onClick={oublier}>
              Revenir au choix automatique
            </button>
          </p>
        )}

        <div className="form-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}
