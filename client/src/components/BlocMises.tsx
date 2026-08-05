// Le champ « Mise par équipe » et le champ « Concours qualificatif » n'ont de
// sens qu'à partir du niveau d'interface « club » : un concours amical n'a ni
// mise ni phase finale à qualifier. C'est l'unité que `montrer('argent', …)`
// masque dans `ConcoursForm` — extraite ici pour que la condition d'affichage
// ne s'éparpille pas dans un `<div className="form-row">` de vingt lignes.
interface PropsBlocMises {
  miseParEquipe: number | '';
  setMiseParEquipe: (v: number | '') => void;
  nbQualifies: number | '';
  setNbQualifies: (v: number | '') => void;
  /** Le champ « nombre de qualifiés » ne concerne ni les rondes ni le tir. */
  avecQualifies: boolean;
}

export function BlocMises({
  miseParEquipe,
  setMiseParEquipe,
  nbQualifies,
  setNbQualifies,
  avecQualifies,
}: PropsBlocMises): JSX.Element {
  return (
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
          onChange={(e) => setMiseParEquipe(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </label>
      {avecQualifies && (
        <label>
          Concours qualificatif : nombre de qualifiés
          <select
            value={nbQualifies}
            onChange={(e) =>
              setNbQualifies(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">Non — jouer jusqu'au vainqueur</option>
            {[2, 4, 8, 16, 32, 64].map((n) => (
              <option key={n} value={n}>
                {n} équipes qualifiées
              </option>
            ))}
          </select>
          <span className="hint">
            Le tableau s'arrête dès que ce nombre est atteint, et la liste des qualifiés
            s'exporte pour la phase finale. Puissances de deux uniquement : un autre nombre
            demanderait un tour partiel que l'application ne construit pas encore.
          </span>
        </label>
      )}
    </div>
  );
}
