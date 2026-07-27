import { useState, type FormEvent } from 'react';
import type { Concours, ConcoursMode, Discipline, TeamFormat } from '@shared';
import type { ConcoursInput } from '../db/actions';
import {
  CATEGORY_SUGGESTIONS,
  DISCIPLINE_LABELS,
  FORMAT_LABELS,
  MODE_INFO,
  MODE_LABELS,
  isRondesMode,
  isTirMode,
} from '../lib/labels';

interface Props {
  initial?: Concours;
  onSubmit: (input: ConcoursInput) => void | Promise<void>;
  onCancel: () => void;
  /** Après tirage, la formule et la formation ne sont plus modifiables. */
  lockStructure?: boolean;
}

export function ConcoursForm({ initial, onSubmit, onCancel, lockStructure }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? today);
  const [lieu, setLieu] = useState(initial?.lieu ?? '');
  const [format, setFormat] = useState<TeamFormat>(initial?.format ?? 'doublette');
  const [mode, setMode] = useState<ConcoursMode>(initial?.mode ?? 'poules');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [discipline, setDiscipline] = useState<Discipline>(initial?.discipline ?? 'petanque');
  const [consolante, setConsolante] = useState(initial?.consolante ?? true);
  const [complementaire, setComplementaire] = useState(initial?.complementaire ?? false);
  const [nbQualifies, setNbQualifies] = useState<number | ''>(initial?.nbQualifies ?? '');
  const [miseParEquipe, setMiseParEquipe] = useState<number | ''>(initial?.miseParEquipe ?? '');
  const [scoreMax, setScoreMax] = useState(initial?.scoreMax ?? 13);
  const [nbTerrains, setNbTerrains] = useState(initial?.nbTerrains ?? 8);
  const [planTerrains, setPlanTerrains] = useState(initial?.planTerrains ?? true);
  const [nbRondes, setNbRondes] = useState(initial?.nbRondes ?? 4);
  const [tempsLimite, setTempsLimite] = useState<number | ''>(initial?.tempsLimite ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit({
      name: name.trim(),
      date,
      lieu: lieu.trim() || undefined,
      format,
      mode,
      discipline,
      category: category.trim() || undefined,
      nbQualifies: nbQualifies === '' ? undefined : Number(nbQualifies),
      consolante: MODE_INFO[mode].consolante ? consolante : false,
      complementaire: MODE_INFO[mode].consolante && consolante ? complementaire : false,
      scoreMax,
      nbTerrains,
      planTerrains,
      nbRondes: isRondesMode(mode) && mode !== 'championnat' ? nbRondes : undefined,
      tempsLimite: tempsLimite === '' ? undefined : Number(tempsLimite),
      miseParEquipe: miseParEquipe === '' ? undefined : Number(miseParEquipe),
    });
  };

  return (
    <form className="concours-form" onSubmit={submit}>
      <label>
        Nom du concours
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Concours du club — doublettes"
          required
          minLength={2}
        />
      </label>
      <div className="form-row">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Lieu
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
            disabled={lockStructure}
          >
            {Object.entries(DISCIPLINE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Catégorie
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Seniors, Vétérans, Féminines…"
            list="form-categories"
          />
          <datalist id="form-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="form-row">
        <label>
          Formation
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as TeamFormat)}
            disabled={lockStructure}
          >
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Formule
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ConcoursMode)}
            disabled={lockStructure}
          >
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
          Parties en
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
              min={1}
              max={12}
              value={nbRondes}
              onChange={(e) => setNbRondes(Number(e.target.value))}
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
      </div>
      <div className="form-row">
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
        {!isRondesMode(mode) && !isTirMode(mode) && (
          <label>
            Qualifiés pour la suite (facultatif)
            <input
              type="number"
              min={0}
              max={512}
              value={nbQualifies}
              placeholder="—"
              onChange={(e) =>
                setNbQualifies(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          </label>
        )}
      </div>
      {MODE_INFO[mode].consolante && (
        <>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={consolante}
              onChange={(e) => setConsolante(e.target.checked)}
              disabled={lockStructure}
            />
            Consolante (repêchage des éliminés)
          </label>
          {consolante && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={complementaire}
                onChange={(e) => setComplementaire(e.target.checked)}
                disabled={lockStructure}
              />
              Complémentaire (2ᵉ repêchage : perdants de la consolante)
            </label>
          )}
        </>
      )}
      {!isTirMode(mode) && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={planTerrains}
            onChange={(e) => setPlanTerrains(e.target.checked)}
          />
          Onglet « Plan des terrains » (décochez si vous gérez les terrains dans les poules)
        </label>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
        <button className="btn btn-primary">{initial ? 'Enregistrer' : 'Créer le concours'}</button>
      </div>
    </form>
  );
}
