/**
 * Assistant de configuration, à la première ouverture.
 *
 * Le logiciel couvre tout le manuel FFPJP, et cette complétude est un mur pour
 * qui organise un concours entre amis. Trois écrans suffisent à le franchir :
 * le profil (ce que l'application affiche), deux ou trois questions concrètes
 * (ce qu'elle pré-remplira), la prise en main.
 *
 * Deux principes commandent tout ce fichier :
 *
 * 1. Le masquage est **annoncé**, jamais subi. Chaque carte de profil dit d'un
 *    même souffle ce que le niveau montre et ce qu'il masque — sans quoi
 *    l'utilisateur ne saurait pas quoi rouvrir quand une fonction lui manque.
 * 2. « Plus tard » ne doit **rien** dégrader. Il marque la configuration comme
 *    faite sans écrire la moindre préférence : l'heuristique reprend la main et
 *    l'utilisateur se retrouve exactement dans l'état d'avant l'assistant.
 *    C'est ce qui rend acceptable de l'afficher d'entrée.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NIVEAUX_INTERFACE,
  defautsDuProfil,
  montrer,
  parcoursDecouverte,
  type DefautsConcours,
  type NiveauInterface,
  type TeamFormat,
} from '@shared';
import { createDemoConcours } from '../db/actions';
import { demarrerParcours } from '../help/parcoursState';
import {
  oublierPreferenceNiveau,
  preferenceNiveau,
  setPreferenceNiveau,
} from '../lib/niveauInterface';
import { getDefauts, oublierDefauts, setDefauts } from '../lib/defauts';
import {
  FORMAT_EMOJI,
  FORMAT_LABELS,
  FORMATS,
  NIVEAU_INTERFACE_LABELS,
  libelleJoueurs,
} from '../lib/labels';
import { BouleLogo } from './BouleLogo';

/**
 * La clé de l'ancien écran de bienvenue, reprise telle quelle. Son nom ne dit
 * plus tout ce qu'elle garde, et c'est le prix à payer : la renommer ferait
 * surgir l'assistant chez tous les utilisateurs existants à la mise à jour.
 */
const CLE_FAITE = 'petanque.welcomeDone';

/** L'utilisateur a-t-il déjà vu l'assistant (ou l'ancien écran de bienvenue) ? */
export function isConfigurationFaite(): boolean {
  return localStorage.getItem(CLE_FAITE) === '1';
}

function marquerFaite(): void {
  localStorage.setItem(CLE_FAITE, '1');
}

/**
 * Les trois profils tels qu'ils sont présentés à l'utilisateur. Exporté parce
 * que les réglages réaffichent les mêmes cartes en format réduit : deux
 * descriptions divergentes du même choix seraient deux occasions de se tromper.
 *
 * Les titres viennent de `NIVEAU_INTERFACE_LABELS` et ne sont pas recopiés : le
 * bouton ⚙ du tableau de bord et la carte de l'assistant doivent nommer le même
 * niveau des mêmes mots, sans quoi l'un des deux finit par dériver.
 */
export const PROFILS: Record<
  NiveauInterface,
  { emoji: string; titre: string; montre: string; masque: string }
> = {
  amical: {
    emoji: '🎉',
    titre: NIVEAU_INTERFACE_LABELS.amical,
    montre: 'Concours du dimanche entre copains : inscriptions, tirage, poules, tableaux, scores.',
    masque: 'Masque les mises et indemnités, les formules du manuel, les groupes de protection et le multisite.',
  },
  club: {
    emoji: '🏆',
    titre: NIVEAU_INTERFACE_LABELS.club,
    montre: 'Concours du club, avec mises, indemnités, clubs des équipes et protections au tirage.',
    // Les quatre domaines que `NIVEAU_MINIMUM` réserve au niveau `federal`, et
    // pas trois : les critères officiels en font partie. Formulation reprise
    // mot pour mot du `ReglagesModal`, qui les cite tous depuis l'origine —
    // deux descriptions divergentes du même masquage seraient deux occasions
    // de croire une fonction perdue.
    masque:
      'Masque le fichier des licenciés, le championnat des clubs, les critères officiels et les documents du comité.',
  },
  federal: {
    emoji: '📋',
    titre: NIVEAU_INTERFACE_LABELS.federal,
    montre: 'Licences, critères officiels, championnat des clubs, documents remis au comité.',
    masque: 'Tout est affiché.',
  },
};

const ETAPES = ['Profil', 'Habitudes', 'Prise en main'];

export function AssistantConfiguration({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  /**
   * Le niveau retenu à l'écran 0. Il n'est ici que pour composer l'écran 1
   * (le champ de mise, le rappel du profil) : la source de vérité est déjà
   * écrite dans les préférences au clic sur la carte.
   */
  const [niveau, setNiveau] = useState<NiveauInterface | null>(null);
  /**
   * La préférence telle qu'elle était avant l'assistant — presque toujours
   * `null`. « ← Retour » la rétablit : sans cela, revenir à l'écran 0 puis
   * cliquer « Plus tard » laisserait derrière lui un choix que l'utilisateur
   * vient justement de reprendre, et l'écran 0 n'écrirait plus « rien ».
   */
  const [preferenceInitiale] = useState<NiveauInterface | null>(preferenceNiveau);
  const [nbTerrains, setNbTerrains] = useState(8);
  const [format, setFormat] = useState<TeamFormat>('doublette');
  const [scoreMax, setScoreMax] = useState(13);
  const [consolante, setConsolante] = useState(true);
  /**
   * La mise par défaut déjà enregistrée, lue une fois au montage.
   * `defautsDuProfil` n'en propose jamais — la chiffrer serait inventer un
   * tarif — donc le niveau passé à `getDefauts` est indifférent pour ce seul
   * champ, et le lire au montage évite que le champ apparaisse ou disparaisse
   * au fil de la saisie.
   *
   * Elle sert à deux choses, et sans elle relancer l'assistant depuis les
   * réglages effaçait en silence la mise qu'on venait d'y saisir : l'écran 1 la
   * réinitialisait depuis le profil, qui n'en a pas, et le champ masqué en
   * « Entre amis » ne montrait rien de cette perte.
   */
  const [miseEnregistree] = useState<number | undefined>(
    () => getDefauts('amical').miseParEquipe,
  );
  const [miseParEquipe, setMiseParEquipe] = useState<number | ''>(miseEnregistree ?? '');

  /**
   * Sortir sans rien écrire d'autre que « c'est vu ». Utilisé par « Plus tard »
   * sur les trois écrans, et par lui seul. Sur l'écran 0, il ne laisse donc
   * aucune préférence derrière lui ; sur les suivants, le niveau a bien été
   * choisi et reste écrit — l'utilisateur renonce au détail, pas à son profil.
   */
  const plusTard = () => {
    marquerFaite();
    onClose();
  };

  const choisirProfil = (n: NiveauInterface) => {
    setPreferenceNiveau(n);
    setNiveau(n);
    // Ce que le profil suggère, et ce qui est déjà enregistré (le profil
    // recouvert, champ par champ, par les valeurs de l'utilisateur).
    const profil = defautsDuProfil(n);
    const enregistres = getDefauts(n);

    // Le profil donne le point de départ des terrains : 4 sur le terrain du
    // village, 8 au boulodrome. C'est le sens du geste, et l'écran suivant
    // ouvre sur ce champ — l'utilisateur voit la valeur changer et la corrige.
    setNbTerrains(profil.nbTerrains);

    // Les champs que l'écran suivant **n'affiche pas** repartent de
    // l'enregistrement, jamais du profil. Sans cela, relancer l'assistant
    // depuis les réglages pour changer de niveau ramenait en silence les
    // parties en 13 et la consolante : ces deux-là ne se règlent que dans ⚙,
    // rien à l'écran n'aurait montré la perte. Même faute que sur la mise
    // ci-dessus, même remède.
    setScoreMax(enregistres.scoreMax);
    setConsolante(enregistres.consolante);

    // La formation est affichée, et elle part pourtant de l'enregistrement
    // elle aussi. Décidé ainsi parce que `defautsDuProfil` répond
    // « doublette » aux trois profils : la reprendre du profil n'apprend rien
    // du niveau choisi, elle ne peut qu'écraser une triplette enregistrée. Et
    // ses cartes sont en bas de l'écran, sous la ligne de flottaison d'une
    // tablette : la perte serait aussi discrète que celle des points. Le seul
    // champ dont le profil dit vraiment quelque chose est le nombre de
    // terrains, et c'est le seul qu'on réinitialise.
    setFormat(enregistres.format);

    // La mise n'a pas de valeur de profil : la « réinitialiser » ne ferait que
    // perdre celle qui était enregistrée.
    setMiseParEquipe(enregistres.miseParEquipe ?? '');
    setStep(1);
  };

  const revenirAuProfil = () => {
    if (preferenceInitiale) setPreferenceNiveau(preferenceInitiale);
    else oublierPreferenceNiveau();
    setNiveau(null);
    setStep(0);
  };

  /**
   * Écrit les habitudes — **si elles disent autre chose que le profil**.
   *
   * L'écran écrit ses quatre champs quoi qu'il arrive, y compris les deux qu'il
   * n'affiche pas. Traverser l'assistant en cliquant « Continuer » suffisait
   * donc à poser un enregistrement, et `aDesDefauts()` répondait « oui » : les
   * réglages annonçaient « Réglées à la main » avec un bouton « Revenir aux
   * valeurs du profil » à quelqu'un qui n'avait rien réglé.
   *
   * Le remède retenu est le tout ou rien plutôt que l'écriture champ par champ
   * des seuls écarts. Les deux réparent l'étiquette ; celui-ci ne touche pas au
   * contrat de `defauts.ts` (`setDefauts` prend un enregistrement complet) et
   * garde la règle simple à dire : *un enregistrement qui ne répéterait que le
   * profil n'est pas une personnalisation*. Qui personnalise un seul champ voit
   * bien les quatre enregistrés — c'est le comportement d'aujourd'hui, et il
   * fige ses habitudes même s'il change de profil ensuite.
   */
  const enregistrerHabitudes = (e: FormEvent, niveauChoisi: NiveauInterface) => {
    e.preventDefault();
    const d: DefautsConcours = {
      nbTerrains,
      scoreMax,
      format,
      consolante,
      // Une mise vide reste absente : proposer un tarif serait l'inventer.
      ...(miseParEquipe === '' ? {} : { miseParEquipe: Number(miseParEquipe) }),
    };
    const profil = defautsDuProfil(niveauChoisi);
    // La mise n'est jamais dans le profil : en poser une est toujours un écart.
    const commeLeProfil =
      d.miseParEquipe === undefined &&
      d.nbTerrains === profil.nbTerrains &&
      d.scoreMax === profil.scoreMax &&
      d.format === profil.format &&
      d.consolante === profil.consolante;
    if (commeLeProfil) oublierDefauts();
    else setDefauts(d);
    setStep(2);
  };

  const visite = () => {
    marquerFaite();
    onClose();
    demarrerParcours(parcoursDecouverte);
  };

  const demo = async () => {
    setBusy(true);
    marquerFaite();
    const id = await createDemoConcours();
    onClose();
    navigate(`/concours/${id}`);
  };

  return (
    /* Le fond ne ferme pas, et c'est un écart assumé avec le reste des modales.
       L'ancien écran de bienvenue tenait sur une page : cliquer à côté après
       l'avoir lu ne coûtait rien. Ici, un clic mal placé pendant l'écran 0 ou 1
       supprimerait la configuration initiale — la seule occasion qu'a
       l'utilisateur de choisir son profil — sans qu'aucune trace dans
       l'interface ne rappelle qu'elle a existé.

       Des deux remèdes possibles, celui-ci plutôt qu'une fermeture qui ne
       marque pas la clé : un assistant qui reviendrait tout seul au prochain
       démarrage, après qu'on l'a manifestement écarté, serait sa propre
       mauvaise surprise. La sortie reste ouverte et nommée — « Plus tard » est
       sur les trois écrans.

       Échap n'est pas câblé non plus, volontairement : deux voies de sortie qui
       ne feraient pas la même chose vaudraient moins que pas de voie du tout. */
    <div className="modal-backdrop">
      <div className="modal welcome-modal">
        <div className="wizard">
          <div className="wizard-progress" aria-hidden>
            {ETAPES.map((label, i) => (
              <span
                key={label}
                className={`wizard-dot${i === step ? ' current' : ''}${i < step ? ' done' : ''}`}
              >
                <em>{i + 1}</em> {label}
              </span>
            ))}
          </div>

          {step === 0 && (
            <div>
              <p className="wizard-question">Comment allez-vous vous servir de l'application ?</p>
              <p className="hint">
                Ce choix règle ce que l'application <strong>affiche</strong>, jamais ce
                qu'elle sait faire. Vous en changerez quand vous voudrez par le bouton ⚙.
              </p>
              <div className="mode-cards">
                {NIVEAUX_INTERFACE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="mode-card"
                    onClick={() => choisirProfil(n)}
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
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={plusTard}>
                  Plus tard
                </button>
              </div>
            </div>
          )}

          {step === 1 && niveau && (
            <form onSubmit={(e) => enregistrerHabitudes(e, niveau)}>
              <p className="wizard-recap">
                {PROFILS[niveau].emoji} {PROFILS[niveau].titre}
              </p>
              <p className="wizard-question">Vos habitudes, pour ne plus les retaper</p>
              <p className="hint">
                Elles pré-rempliront chaque nouveau concours. Rien n'est figé : tout reste
                modifiable concours par concours.
              </p>
              <div className="form-row">
                <label>
                  Terrains habituels
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={nbTerrains}
                    onChange={(e) => setNbTerrains(Number(e.target.value))}
                  />
                </label>
                {/* La mise n'a de sens qu'à partir du niveau `club` : en
                    « Entre amis », l'argent est justement ce qu'on masque.

                    Sauf pour qui en a déjà posé une. Les défauts enregistrés
                    sont une trace d'usage au même titre qu'un concours, mais
                    personne ne les passait à `montrer` : il n'y a pas de
                    concours en contexte sur cet écran, donc pas de clause de
                    sûreté, donc un champ masqué qui écrase en silence ce que
                    l'utilisateur avait demandé. On passe donc la mise
                    enregistrée comme usage. `domaineEnUsage` traite `undefined`
                    et `0` comme « pas d'usage » : rien n'apparaît à qui n'a
                    rien demandé. */}
                {montrer('argent', {
                  niveau,
                  concours: { miseParEquipe: miseEnregistree },
                }) && (
                  <label>
                    Mise par équipe (€, facultatif)
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      step={0.5}
                      value={miseParEquipe}
                      placeholder="—"
                      onChange={(e) =>
                        setMiseParEquipe(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  </label>
                )}
              </div>
              <p className="wizard-sous-titre">En quelle formation joue-t-on d'habitude ?</p>
              <div className="format-cards">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`format-card${format === f ? ' selected' : ''}`}
                    aria-pressed={format === f}
                    onClick={() => setFormat(f)}
                  >
                    <span className="format-card-emoji">{FORMAT_EMOJI[f]}</span>
                    <strong>{FORMAT_LABELS[f]}</strong>
                    <span className="mode-card-tagline">{libelleJoueurs(f)}</span>
                  </button>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={revenirAuProfil}>
                  ← Retour
                </button>
                <button type="button" className="btn btn-ghost" onClick={plusTard}>
                  Plus tard
                </button>
                <button className="btn btn-primary">Continuer</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div>
              <div className="welcome-brand">
                <BouleLogo />
                <h2>Bienvenue sur Pétanque Concours !</h2>
              </div>
              <p>Organisez vos concours de bout en bout, même sans connexion :</p>
              <ul className="welcome-list">
                <li>🎲 <strong>Poules à la FFPJP</strong> — tirage, barrage, qualifications automatiques.</li>
                <li>🏆 <strong>Tableaux</strong> — cadrage, consolante, correction en cascade.</li>
                <li>📡 <strong>Hors ligne</strong> — tout fonctionne au boulodrome, la synchronisation reprend au retour du réseau.</li>
              </ul>
              <div className="welcome-actions">
                <button className="btn btn-primary" onClick={visite}>
                  🎓 Commencer la visite guidée
                </button>
                <button className="btn" onClick={() => void demo()} disabled={busy}>
                  {busy ? 'Création…' : '🎯 Créer un concours d\'exemple'}
                </button>
                <button className="btn btn-ghost" onClick={plusTard}>
                  Plus tard
                </button>
              </div>
              <p className="welcome-hint">
                Vous retrouverez la visite guidée et tous les guides pas à pas dans
                l'assistant 💬 (en bas à droite).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
