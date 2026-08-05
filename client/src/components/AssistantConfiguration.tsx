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
import { setDefauts } from '../lib/defauts';
import { FORMAT_LABELS } from '../lib/labels';
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
 */
export const PROFILS: Record<
  NiveauInterface,
  { emoji: string; titre: string; montre: string; masque: string }
> = {
  amical: {
    emoji: '🎉',
    titre: 'Entre amis',
    montre: 'Concours du dimanche entre copains : inscriptions, tirage, poules, tableaux, scores.',
    masque: 'Masque les mises et indemnités, les formules du manuel, les groupes de protection et le multisite.',
  },
  club: {
    emoji: '🏆',
    titre: 'Mon club',
    montre: 'Concours du club, avec mises, indemnités, clubs des équipes et protections au tirage.',
    masque: 'Masque le fichier des licenciés, le championnat des clubs et les documents du comité.',
  },
  federal: {
    emoji: '📋',
    titre: 'Concours officiels',
    montre: 'Licences, critères officiels, championnat des clubs, documents remis au comité.',
    masque: 'Tout est affiché.',
  },
};

const FORMATS: TeamFormat[] = ['tete_a_tete', 'doublette', 'triplette'];
const FORMAT_EMOJI: Record<TeamFormat, string> = {
  tete_a_tete: '🧍',
  doublette: '🧍🧍',
  triplette: '🧍🧍🧍',
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
  const [miseParEquipe, setMiseParEquipe] = useState<number | ''>('');

  /**
   * Sortir sans rien écrire d'autre que « c'est vu ». Utilisé par « Plus tard »
   * sur les trois écrans, et par le clic hors de la fenêtre. Sur l'écran 0, il
   * ne laisse donc aucune préférence derrière lui ; sur les suivants, le niveau
   * a bien été choisi et reste écrit — l'utilisateur renonce au détail, pas à
   * son profil.
   */
  const plusTard = () => {
    marquerFaite();
    onClose();
  };

  const choisirProfil = (n: NiveauInterface) => {
    setPreferenceNiveau(n);
    setNiveau(n);
    // Le profil donne le point de départ des questions suivantes : 4 terrains
    // sur le terrain du village, 8 au boulodrome.
    const d = defautsDuProfil(n);
    setNbTerrains(d.nbTerrains);
    setFormat(d.format);
    setScoreMax(d.scoreMax);
    setConsolante(d.consolante);
    setMiseParEquipe(d.miseParEquipe ?? '');
    setStep(1);
  };

  const revenirAuProfil = () => {
    if (preferenceInitiale) setPreferenceNiveau(preferenceInitiale);
    else oublierPreferenceNiveau();
    setNiveau(null);
    setStep(0);
  };

  const enregistrerHabitudes = (e: FormEvent) => {
    e.preventDefault();
    const d: DefautsConcours = {
      nbTerrains,
      scoreMax,
      format,
      consolante,
      // Une mise vide reste absente : proposer un tarif serait l'inventer.
      ...(miseParEquipe === '' ? {} : { miseParEquipe: Number(miseParEquipe) }),
    };
    setDefauts(d);
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
    <div className="modal-backdrop" onClick={plusTard}>
      <div className="modal welcome-modal" onClick={(e) => e.stopPropagation()}>
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
            <form onSubmit={enregistrerHabitudes}>
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
                    « Entre amis », l'argent est justement ce qu'on masque. */}
                {montrer('argent', { niveau }) && (
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
                    <span className="mode-card-tagline">
                      {f === 'tete_a_tete' ? '1 joueur' : f === 'doublette' ? '2 joueurs' : '3 joueurs'}
                    </span>
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
