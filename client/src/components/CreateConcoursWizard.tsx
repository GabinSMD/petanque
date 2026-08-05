import { useState, type FormEvent } from 'react';
import type { ConcoursMode, Discipline, TeamFormat } from '@shared';
import { TAILLE_FORMATION, bornesParties } from '@shared';
import type { ConcoursInput } from '../db/actions';
import {
  CATEGORY_SUGGESTIONS,
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  MODE_INFO,
  MODE_LABELS,
  isIndividualMode,
  isRondesMode,
  isTirMode,
  suggestedName,
} from '../lib/labels';

interface Props {
  onSubmit: (input: ConcoursInput) => void | Promise<void>;
  onCancel: () => void;
}

const MODES: ConcoursMode[] = [
  'poules',
  'elimination_directe',
  'melee',
  'suisse',
  'championnat',
  'tir_precision',
];
const FORMATS: TeamFormat[] = ['tete_a_tete', 'doublette', 'triplette'];
const FORMAT_EMOJI: Record<TeamFormat, string> = {
  tete_a_tete: '🧍',
  doublette: '🧍🧍',
  triplette: '🧍🧍🧍',
};

/**
 * Création de concours en 3 étapes pensées pour les novices :
 * formule (en langage courant) → formation → détails pré-remplis.
 */
export function CreateConcoursWizard({ onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<ConcoursMode | null>(null);
  const [format, setFormat] = useState<TeamFormat | null>(null);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [date, setDate] = useState(today);
  const [lieu, setLieu] = useState('');
  const [category, setCategory] = useState('');
  const [discipline, setDiscipline] = useState<Discipline>('petanque');
  const [nbTerrains, setNbTerrains] = useState(8);
  const [planTerrains, setPlanTerrains] = useState(true);
  const [scoreMax, setScoreMax] = useState(13);
  const [nbRondes, setNbRondes] = useState(4);
  /**
   * Bornes du nombre de parties (§3.D.14). L'appariement strict ne se choisit pas
   * ici mais dans les paramètres : à la création, ce sont donc les bornes de la
   * formule non stricte.
   */
  const bornes = mode ? bornesParties({ mode }) : undefined;
  // Marathon : championnat tronqué. Vide = calendrier complet.
  const [marathonRondes, setMarathonRondes] = useState<number | ''>('');
  const [tempsLimite, setTempsLimite] = useState<number | ''>('');
  const [miseParJoueur, setMiseParJoueur] = useState<number | ''>('');
  const [consolante, setConsolante] = useState(true);

  const pickMode = (m: ConcoursMode) => {
    setMode(m);
    if (isTirMode(m)) {
      // Pas de formation en tir de précision : on passe aux détails.
      setFormat('tete_a_tete');
      if (!nameTouched) setName(suggestedName(m, 'tete_a_tete', date));
      setNbRondes(2);
      setStep(2);
      return;
    }
    setStep(1);
  };

  const pickFormat = (f: TeamFormat) => {
    setFormat(f);
    if (!nameTouched && mode) setName(suggestedName(mode, f, date));
    setStep(2);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!mode || !format) return;
    void onSubmit({
      name: name.trim() || suggestedName(mode, format, date),
      date,
      lieu: lieu.trim() || undefined,
      format,
      mode,
      discipline,
      category: category.trim() || undefined,
      consolante: MODE_INFO[mode].consolante ? consolante : false,
      scoreMax,
      nbTerrains,
      planTerrains,
      nbRondes:
        mode === 'championnat'
          ? marathonRondes === ''
            ? undefined
            : Number(marathonRondes)
          : isRondesMode(mode) || isTirMode(mode)
            ? nbRondes
            : undefined,
      tempsLimite:
        tempsLimite === '' || isTirMode(mode) ? undefined : Number(tempsLimite),
      miseParJoueur: miseParJoueur === '' ? undefined : Number(miseParJoueur),
    });
  };

  return (
    <div className="wizard">
      <div className="wizard-progress" aria-hidden>
        {['Formule', 'Formation', 'Détails'].map((label, i) => (
          <span key={label} className={`wizard-dot${i === step ? ' current' : ''}${i < step ? ' done' : ''}`}>
            <em>{i + 1}</em> {label}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div>
          <p className="wizard-question">Quel type de concours organisez-vous ?</p>
          <div className="mode-cards">
            {MODES.map((m) => (
              <button key={m} type="button" className="mode-card" onClick={() => pickMode(m)}>
                <span className="mode-card-emoji">{MODE_INFO[m].emoji}</span>
                <span className="mode-card-body">
                  <strong>{MODE_LABELS[m]}</strong>
                  <span className="mode-card-tagline">{MODE_INFO[m].tagline}</span>
                  <span className="mode-card-desc">{MODE_INFO[m].description}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {step === 1 && mode && (
        <div>
          <p className="wizard-question">
            {isIndividualMode(mode)
              ? 'Quelle taille d\'équipes tire-t-on au sort à chaque ronde ?'
              : 'En quelle formation joue-t-on ?'}
          </p>
          <div className="format-cards">
            {FORMATS.map((f) => (
              <button key={f} type="button" className="format-card" onClick={() => pickFormat(f)}>
                <span className="format-card-emoji">{FORMAT_EMOJI[f]}</span>
                <strong>{FORMAT_LABELS[f]}</strong>
                <span className="mode-card-tagline">
                  {f === 'tete_a_tete' ? '1 joueur' : f === 'doublette' ? '2 joueurs' : '3 joueurs'}
                  {isIndividualMode(mode) && f !== 'tete_a_tete' ? ' tirés au sort' : ''}
                </span>
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
              ← Retour
            </button>
          </div>
        </div>
      )}

      {step === 2 && mode && format && (
        <form onSubmit={submit}>
          <p className="wizard-recap">
            {MODE_INFO[mode].emoji} {MODE_LABELS[mode]}
            {!isTirMode(mode) && ` · ${FORMAT_LABELS[format]}`}
            {isIndividualMode(mode) && ' · inscriptions individuelles'}
          </p>
          <label>
            Nom du concours
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
              required
              minLength={2}
            />
          </label>
          <div className="form-row">
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (!nameTouched) setName(suggestedName(mode, format, e.target.value));
                }}
                required
              />
            </label>
            <label>
              Lieu (facultatif)
              <input
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                placeholder="Boulodrome municipal"
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Discipline
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as Discipline)}
              >
                {Object.entries(DISCIPLINE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Catégorie (facultatif)
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Seniors, Vétérans, Féminines…"
                list="wizard-categories"
              />
              <datalist id="wizard-categories">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="form-row">
            <label>
              Terrains disponibles
              <input
                type="number"
                min={1}
                max={200}
                value={nbTerrains}
                onChange={(e) => setNbTerrains(Number(e.target.value))}
              />
            </label>
            <label>
              Parties en (points)
              <input
                type="number"
                min={7}
                max={21}
                value={scoreMax}
                onChange={(e) => setScoreMax(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="form-row">
            {((isRondesMode(mode) && mode !== 'championnat') || isTirMode(mode)) && (
              <label>
                {isTirMode(mode) ? 'Nombre de séries' : 'Nombre de rondes'}
                <input
                  type="number"
                  min={bornes?.min ?? 1}
                  max={bornes?.max ?? 12}
                  value={nbRondes}
                  onChange={(e) => setNbRondes(Number(e.target.value))}
                />
                {bornes && (
                  <span className="hint">
                    De {bornes.min} à {bornes.max} parties (manuel §3.D.14).
                  </span>
                )}
              </label>
            )}
            {mode === 'championnat' && (
              <label>
                Rondes du marathon (facultatif)
                <input
                  type="number"
                  min={bornes?.min ?? 1}
                  max={bornes?.max ?? 20}
                  value={marathonRondes}
                  placeholder="calendrier complet"
                  onChange={(e) =>
                    setMarathonRondes(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </label>
            )}
            {!isTirMode(mode) && (
              <label>
                Temps limité (min, facultatif)
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={tempsLimite}
                  placeholder="—"
                  onChange={(e) =>
                    setTempsLimite(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </label>
            )}
            <label>
              Mise par joueur (€, facultatif)
              <input
                type="number"
                min={0}
                max={1000}
                step={0.5}
                value={miseParJoueur}
                placeholder="—"
                onChange={(e) =>
                  setMiseParJoueur(e.target.value === '' ? '' : Number(e.target.value))
                }
              />
              {/* Le total d'équipe se lit à la saisie : c'est l'unité que le
                  barème fédéral donne, et celle qu'un organisateur recopie. */}
              {miseParJoueur !== '' && format && (
                <small className="form-hint">
                  soit {(Number(miseParJoueur) * TAILLE_FORMATION[format]).toLocaleString('fr-FR')} €
                  par équipe en {FORMAT_LABELS[format].toLowerCase()}
                </small>
              )}
            </label>
          </div>
          {MODE_INFO[mode].consolante && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={consolante}
                onChange={(e) => setConsolante(e.target.checked)}
              />
              Consolante (les éliminés rejouent dans un second tableau)
            </label>
          )}
          {!isTirMode(mode) && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={planTerrains}
                onChange={(e) => setPlanTerrains(e.target.checked)}
              />
              Onglet « Plan des terrains » (décochez si vous gérez les terrains dans les
              poules)
            </label>
          )}
          {mode === 'championnat' && (
            <p className="hint">
              Le nombre de rondes découle de l'effectif : chacun rencontre chacun.
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              ← Retour
            </button>
            <button className="btn btn-primary">Créer le concours 🎉</button>
          </div>
        </form>
      )}
    </div>
  );
}
