/**
 * Réglages de l'appareil : la porte de sortie de l'assistant de configuration.
 *
 * Tout ce que l'assistant a décidé pour l'utilisateur se reprend ici — le
 * niveau d'interface, les valeurs par défaut des nouveaux concours — et
 * l'assistant lui-même se relance. C'est la réponse à « où est passé X ? », et
 * c'est pour cela que le bouton du tableau de bord porte le niveau courant.
 *
 * ⚠️ **Cet écran ne masque rien, mise comprise, quel que soit le niveau.** Il
 * est le seul de l'application où un champ échappe à `montrer`, et c'est
 * délibéré : un utilisateur en « Entre amis » qui veut poser une mise par
 * défaut doit pouvoir le faire, sinon l'heuristique — qui promeut en « Mon
 * club » dès qu'un concours porte une mise — ne le promouvrait jamais. Ne pas
 * « corriger » ce point en important `montrer` ici : ce serait rétablir le
 * cercle vicieux que la conception résout. L'alternative écartée était un
 * interrupteur par domaine, soit un second système capable de contredire le
 * premier.
 */
import { useEffect, useId, useState } from 'react';
import {
  NIVEAUX_INTERFACE,
  besoinNiveau,
  defautsDuProfil,
  type DefautsConcours,
  type TeamFormat,
} from '@shared';
import { useClubsSurEquipes, useConcoursList, useLicenciesCount } from '../db/hooks';
import { useNiveauInterface } from '../lib/niveauInterface';
import { useDefauts } from '../lib/defauts';
import { FORMAT_LABELS, FORMATS, NIVEAU_INTERFACE_LABELS } from '../lib/labels';
import { AssistantConfiguration, PROFILS } from './AssistantConfiguration';
import { Modal } from './Modal';

interface ChampNombre {
  saisi: string;
  /** Pourquoi la dernière frappe n'a pas été enregistrée, ou `''`. */
  refus: string;
  saisir: (v: string, refus?: string) => void;
  /** Identifiant du message de refus, pour le relier au champ par `aria-describedby`. */
  idRefus: string;
}

/**
 * Un champ numérique dont la valeur de référence vit dans le stockage, mais qui
 * doit rester saisissable. Retaper un nombre passe forcément par des états
 * intermédiaires invalides — le champ vide, le temps d'effacer — qu'on ne veut
 * pas enregistrer : `Number('')` vaut zéro, et zéro terrain n'est pas un
 * réglage. On garde donc la frappe en local et on n'écrit que ce qui est
 * valide, tout en se resynchronisant quand la valeur change ailleurs :
 * « Revenir aux valeurs du profil », ou un autre onglet.
 *
 * Ce qui est refusé doit se voir. Sans `refus`, taper « 8,5 » terrains — le cas
 * réaliste, bien plus qu'un 500 — laissait le champ afficher 8,5 pendant que le
 * stockage gardait 8, et rien à l'écran ne disait lequel des deux valait. Le
 * message s'efface dès que la frappe redevient valide, et à toute
 * resynchronisation : il parle de la saisie en cours, pas d'un état durable.
 */
function useChampNombre(valeur: string): ChampNombre {
  const [saisi, setSaisi] = useState(valeur);
  const [refus, setRefus] = useState('');
  const idRefus = useId();
  useEffect(() => {
    setSaisi(valeur);
    setRefus('');
  }, [valeur]);
  return {
    saisi,
    refus,
    idRefus,
    saisir: (v, r = '') => {
      setSaisi(v);
      setRefus(r);
    },
  };
}

export function ReglagesModal({ onClose }: { onClose: () => void }) {
  const concours = useConcoursList() ?? [];
  const licencies = useLicenciesCount();
  const clubsSurEquipes = useClubsSurEquipes();
  const besoin = besoinNiveau({ concours, licencies, clubsSurEquipes });
  const { niveau, preference, choisir, oublier } = useNiveauInterface(besoin);
  const { defauts, personnalises, enregistrer, oublier: oublierDefauts } = useDefauts(niveau);
  const [assistant, setAssistant] = useState(false);

  const terrains = useChampNombre(String(defauts.nbTerrains));
  const scoreMax = useChampNombre(String(defauts.scoreMax));
  const mise = useChampNombre(defauts.miseParEquipe?.toString() ?? '');

  /** Les quatre champs toujours présents, sans la mise — qui, elle, s'absente. */
  const sansMise = (): DefautsConcours => ({
    nbTerrains: defauts.nbTerrains,
    scoreMax: defauts.scoreMax,
    format: defauts.format,
    consolante: defauts.consolante,
  });

  const majTerrains = (v: string): void => {
    const n = Number(v);
    // Le champ vidé n'est pas une erreur : c'est le passage obligé de qui
    // retape un nombre. On attend la suite sans rien dire ni rien écrire.
    if (v === '') {
      terrains.saisir(v);
      return;
    }
    if (Number.isInteger(n) && n >= 1 && n <= 200) {
      terrains.saisir(v);
      enregistrer({ ...defauts, nbTerrains: n });
      return;
    }
    terrains.saisir(v, 'Non enregistré : un nombre entier de terrains, de 1 à 200.');
  };

  const majScoreMax = (v: string): void => {
    const n = Number(v);
    if (v === '') {
      scoreMax.saisir(v);
      return;
    }
    if (Number.isInteger(n) && n >= 1 && n <= 100) {
      scoreMax.saisir(v);
      enregistrer({ ...defauts, scoreMax: n });
      return;
    }
    scoreMax.saisir(v, 'Non enregistré : un nombre entier de points, de 1 à 100.');
  };

  const majMise = (v: string): void => {
    // Une mise effacée n'est pas une mise à zéro : le champ redevient absent,
    // comme il l'est dans `defautsDuProfil`. Ce n'est pas l'heuristique qui est
    // en jeu — `domaineEnUsage('argent')` fait `Boolean(c.miseParEquipe || …)`,
    // donc un zéro n'est pas une trace d'usage et ne promeut personne. C'est le
    // pré-remplissage : un `0` enregistré s'écrirait dans le champ de chaque
    // nouveau concours à la place du « — », et chaque concours créé porterait
    // `miseParEquipe: 0` en base. Un champ facultatif qu'on vide doit redevenir
    // vide, pas valoir zéro.
    if (v === '') {
      mise.saisir(v);
      enregistrer(sansMise());
      return;
    }
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= 1000) {
      mise.saisir(v);
      // `defauts` et non `sansMise()` : la mise est réécrite juste après, donc
      // le retrait ne retirait rien. Il n'avait de sens que dans la branche
      // ci-dessus, et il écarterait en silence tout champ facultatif qu'une
      // version future ajouterait à `DefautsConcours`.
      enregistrer({ ...defauts, miseParEquipe: n });
      return;
    }
    mise.saisir(v, 'Non enregistré : une mise de 0 à 1000 €.');
  };

  /*
   * L'assistant relancé remplace la modale plutôt que de s'empiler dessus : il
   * porte son propre fond, et deux fonds superposés assombriraient l'écran deux
   * fois. Sa fermeture ferme aussi les réglages, parce que son dernier écran
   * peut lancer la visite guidée — que la modale des réglages, restée montée,
   * masquerait. Il ne touche pas à `petanque.welcomeDone` : la clé est déjà à
   * `1`, l'assistant se referme normalement et ne reviendra pas de lui-même.
   */
  if (assistant) {
    return (
      <AssistantConfiguration
        onClose={() => {
          setAssistant(false);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal title="⚙ Réglages" onClose={onClose}>
      <div className="reglages-modal">
        <section className="reglages-section">
          <h3>Niveau d'interface</h3>

          {/* Les mêmes cartes que l'assistant, en format réduit : les textes
              viennent de `PROFILS`, jamais recopiés. Deux descriptions du même
              choix sur deux écrans que l'utilisateur enchaîne finiraient par
              diverger, et c'est exactement ce qui était arrivé au paragraphe
              qui tenait cette place — il annonçait encore les indemnités
              visibles en « Entre amis », plusieurs versions après leur
              masquage. */}
          <div className="mode-cards">
            {NIVEAUX_INTERFACE.map((n) => (
              /*
               * Un bouton plutôt qu'un radio, et ce n'est pas un détail de
               * présentation. `checked` suivrait le niveau **effectif** : sans
               * préférence enregistrée, c'est celui de l'heuristique qui
               * apparaîtrait déjà coché, si bien que le cliquer ne changerait
               * aucune valeur et n'émettrait aucun `change`. Figer le niveau
               * automatique serait alors impossible — or c'est le geste le plus
               * utile du réglage : le club à qui l'heuristique dit « Mon club »
               * doit pouvoir verrouiller ce niveau, sinon un import de
               * licenciés le fera basculer en « Officiel » sans qu'il l'ait
               * demandé. Un `click` sur un bouton, lui, est émis dans tous les
               * cas, y compris sur la carte déjà active. `choisir` est
               * idempotent : le recliquer ne coûte rien.
               */
              <button
                key={n}
                type="button"
                className={`mode-card mode-card-reduite${niveau === n ? ' selected' : ''}`}
                aria-pressed={niveau === n}
                onClick={() => choisir(n)}
              >
                <span className="mode-card-emoji">{PROFILS[n].emoji}</span>
                <span className="mode-card-body">
                  <strong>{PROFILS[n].titre}</strong>
                  <span className="mode-card-tagline">{PROFILS[n].montre}</span>
                  <span className="mode-card-desc">{PROFILS[n].masque}</span>
                </span>
              </button>
            ))}
          </div>

          <p className="hint">
            Ce réglage ne change <strong>que l'affichage</strong>. Un concours déjà déclaré officiel
            continue de contrôler ses licences, et ses écrans restent visibles sur lui — on ne
            désactive pas en silence une règle sur laquelle vous comptez.
          </p>

          {/* « vos données » et non « vos concours » : `besoinNiveau` lit aussi
              le fichier des licenciés et le club porté par les équipes.
              Importer des licenciés sans avoir créé le moindre concours suffit
              à promouvoir en « Concours officiels » — et l'organisateur dans ce
              cas lirait une explication qui ne correspond pas à ce qu'il a
              fait, sur l'écran même qui doit répondre à « où est passé X ». */}
          {preference === null && (
            <p className="hint">
              Choisi automatiquement d'après vos données : « {NIVEAU_INTERFACE_LABELS[besoin]} ».
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
        </section>

        <section className="reglages-section">
          <h3>Valeurs par défaut des nouveaux concours</h3>
          <p className="hint">
            Elles pré-remplissent chaque nouveau concours et restent modifiables concours par
            concours.
          </p>

          {/* Un `form` pour la seule mise en page : les champs s'enregistrent à
              la frappe, il n'y a rien à soumettre. */}
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="form-row">
              <label>
                Terrains habituels
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={terrains.saisi}
                  aria-invalid={terrains.refus !== ''}
                  aria-describedby={terrains.refus ? terrains.idRefus : undefined}
                  onChange={(e) => majTerrains(e.target.value)}
                />
                {terrains.refus && (
                  <span id={terrains.idRefus} className="form-error">
                    {terrains.refus}
                  </span>
                )}
              </label>
              <label>
                Partie en
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={scoreMax.saisi}
                  aria-invalid={scoreMax.refus !== ''}
                  aria-describedby={scoreMax.refus ? scoreMax.idRefus : undefined}
                  onChange={(e) => majScoreMax(e.target.value)}
                />
                {scoreMax.refus && (
                  <span id={scoreMax.idRefus} className="form-error">
                    {scoreMax.refus}
                  </span>
                )}
              </label>
            </div>
            <div className="form-row">
              <label>
                Formation habituelle
                <select
                  value={defauts.format}
                  onChange={(e) =>
                    enregistrer({ ...defauts, format: e.target.value as TeamFormat })
                  }
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </label>
              {/* Ce champ est affiché à tous les niveaux, « Entre amis »
                  compris — voir l'avertissement en tête de fichier. */}
              <label>
                Mise par équipe (€, facultatif)
                <input
                  type="number"
                  min={0}
                  max={1000}
                  step={0.5}
                  value={mise.saisi}
                  placeholder="—"
                  aria-invalid={mise.refus !== ''}
                  aria-describedby={mise.refus ? mise.idRefus : undefined}
                  onChange={(e) => majMise(e.target.value)}
                />
                {mise.refus && (
                  <span id={mise.idRefus} className="form-error">
                    {mise.refus}
                  </span>
                )}
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={defauts.consolante}
                onChange={(e) => enregistrer({ ...defauts, consolante: e.target.checked })}
              />
              Consolante par défaut
            </label>
          </form>

          {personnalises ? (
            <p className="hint">
              Réglées à la main.{' '}
              <button className="btn-lien" onClick={oublierDefauts}>
                Revenir aux valeurs du profil
              </button>
            </p>
          ) : (
            <p className="hint">
              Ce sont les valeurs du profil « {NIVEAU_INTERFACE_LABELS[niveau]} » :{' '}
              {defautsDuProfil(niveau).nbTerrains} terrains, en{' '}
              {FORMAT_LABELS[defautsDuProfil(niveau).format].toLowerCase()}.
            </p>
          )}
        </section>

        <section className="reglages-section">
          <h3>Assistant de configuration</h3>
          <p className="hint">
            Les trois écrans du premier démarrage : le profil, vos habitudes, la prise en main.
          </p>
          <button className="btn" onClick={() => setAssistant(true)}>
            🧭 Relancer l'assistant de configuration
          </button>
        </section>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}
