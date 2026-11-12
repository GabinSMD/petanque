import { besoinModeFederal, defautsPersonnalises } from '@shared';
import { useConcoursList, useLicenciesCount } from '../db/hooks';
import { useModeFederal } from '../lib/modeFederal';
import { useTheme, type Theme } from '../lib/theme';
import { oublierDefautsConcours, useDefautsConcours } from '../lib/defautsConcours';
import { Modal } from './Modal';

/**
 * Réglages de l'appareil : le mode fédéral, qui décide de ce que l'application
 * montre — pas de ce qu'elle fait — et l'apparence, claire ou sombre.
 */
const THEMES: { valeur: Theme; libelle: string; detail: string }[] = [
  { valeur: 'clair', libelle: 'Clair', detail: 'Le plus lisible en plein jour.' },
  { valeur: 'sombre', libelle: 'Sombre', detail: 'Repose les yeux le soir ou en salle.' },
  { valeur: 'auto', libelle: 'Comme l’appareil', detail: 'Suit le réglage du téléphone ou de l’ordinateur.' },
];

export function ReglagesModal({ onClose }: { onClose: () => void }) {
  const concours = useConcoursList() ?? [];
  const licencies = useLicenciesCount();
  const besoin = besoinModeFederal({ concours, licencies });
  const { actif, preference, choisir, oublier } = useModeFederal(besoin);
  const apparence = useTheme();
  const defauts = useDefautsConcours();

  return (
    <Modal title="Réglages" onClose={onClose}>
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

        <fieldset className="reglages-apparence">
          <legend>Apparence</legend>
          {THEMES.map((t) => (
            <label key={t.valeur} className="reglages-choix">
              <input
                type="radio"
                name="apparence"
                checked={apparence.theme === t.valeur}
                onChange={() => apparence.choisir(t.valeur)}
              />
              <span>
                <strong>{t.libelle}</strong>
                <small>{t.detail}</small>
              </span>
            </label>
          ))}
          <p className="hint">
            Ce choix vaut pour cet appareil. Les documents imprimés et l’écran d’affichage ne
            changent pas.
          </p>
        </fieldset>

        <fieldset className="reglages-apparence">
          <legend>Nouveaux concours</legend>
          <p className="hint">
            Chaque concours créé sur cet appareil repart des réglages du précédent :{' '}
            <strong>
              {defauts.nbTerrains} terrain{defauts.nbTerrains > 1 ? 's' : ''}, parties en{' '}
              {defauts.scoreMax} points
              {defauts.consolante ? ', avec consolante' : ', sans consolante'}
              {defauts.miseParJoueur !== undefined
                ? `, mise de ${defauts.miseParJoueur.toLocaleString('fr-FR')} € par joueur`
                : ''}
              {defauts.lieu ? `, à ${defauts.lieu}` : ''}
            </strong>
            . Tout reste modifiable à la création.
          </p>
          {defautsPersonnalises(defauts) && (
            <p className="hint">
              <button className="btn-lien" onClick={oublierDefautsConcours}>
                Revenir aux valeurs d’origine
              </button>
            </p>
          )}
        </fieldset>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}
