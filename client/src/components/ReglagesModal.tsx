import { NIVEAUX_INTERFACE, besoinNiveau } from '@shared';
import { useClubsSurEquipes, useConcoursList, useLicenciesCount } from '../db/hooks';
import { useNiveauInterface } from '../lib/niveauInterface';
import { LIBELLE_NIVEAU } from '../lib/labels';
import { Modal } from './Modal';

/**
 * Réglages de l'appareil. Le seul pour l'instant : le niveau d'interface, qui
 * décide de ce que l'application montre — pas de ce qu'elle fait.
 */
export function ReglagesModal({ onClose }: { onClose: () => void }) {
  const concours = useConcoursList() ?? [];
  const licencies = useLicenciesCount();
  const clubsSurEquipes = useClubsSurEquipes();
  const besoin = besoinNiveau({ concours, licencies, clubsSurEquipes });
  const { niveau, preference, choisir, oublier } = useNiveauInterface(besoin);

  return (
    <Modal title="⚙ Réglages" onClose={onClose}>
      <div className="reglages-modal">
        {/* Trois boutons radio plutôt qu'une liste déroulante : les trois
            niveaux se lisent d'un coup, et on voit lequel est actif sans
            ouvrir quoi que ce soit. */}
        {NIVEAUX_INTERFACE.map((n) => {
          /*
           * `checked` suit le niveau **effectif** : sans préférence, c'est celui
           * de l'heuristique qui apparaît coché. `onChange` seul ne suffirait
           * donc pas — cliquer ce radio-là ne change aucune valeur, le
           * navigateur n'émet aucun `change`, et figer le niveau automatique
           * serait impossible. Or c'est le geste le plus utile du réglage : le
           * club à qui l'heuristique dit « Mon club » doit pouvoir verrouiller
           * ce niveau, sinon un import de licenciés le fera basculer en
           * « Officiel » sans qu'il l'ait demandé.
           *
           * `click`, lui, est émis dans tous les cas — à la souris comme aux
           * flèches du clavier, le navigateur cliquant le radio qu'il
           * sélectionne. Les deux gestionnaires appellent le même `choisir`, qui
           * est idempotent : sur un vrai changement il s'exécute deux fois avec
           * la même valeur, ce qui ne coûte rien.
           */
          const fixer = (): void => choisir(n);
          return (
            <label key={n} className="checkbox-label">
              <input
                type="radio"
                name="niveauInterface"
                checked={niveau === n}
                onChange={fixer}
                onClick={fixer}
              />
              {LIBELLE_NIVEAU[n]}
            </label>
          );
        })}

        <p className="hint">
          Au niveau « Entre amis », l'application s'en tient à ce qu'il faut pour un concours de
          club : inscriptions, tirage, poules, tableaux, scores et indemnités. Le fichier des
          licenciés, le championnat des clubs, les critères officiels et les documents remis au
          comité sont masqués.
        </p>

        <p className="hint">
          Ce réglage ne change <strong>que l'affichage</strong>. Un concours déjà déclaré officiel
          continue de contrôler ses licences, et ses écrans restent visibles sur lui — on ne
          désactive pas en silence une règle sur laquelle vous comptez.
        </p>

        {preference === null && (
          <p className="hint">
            Choisi automatiquement d'après vos concours : « {LIBELLE_NIVEAU[besoin]} ».
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
