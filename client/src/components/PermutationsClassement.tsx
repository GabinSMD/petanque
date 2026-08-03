import { useState } from 'react';
import type { Concours, Standing, Team } from '@shared';
import {
  ajouterPermutation,
  permutationDepuisRangs,
  permutationsActives,
  retirerPermutation,
  memeNiveau,
} from '@shared';
import { updateConcours } from '../db/actions';
import { teamDisplayName } from './TeamLabel';

/**
 * « CHANGEMENT DANS LE CLASSEMENT — suite à une égalité » (manuel, classeur des
 * phases finales, copie d'écran p.110).
 *
 * La macro fédérale demande les deux **rangs** à intervertir — « chiffre à gauche
 * du Nom du joueur ». On fait pareil : c'est ce que l'organisateur a sous les
 * yeux. Ce qui est enregistré, en revanche, est la paire d'**équipes** : notre
 * classement se recalcule à chaque score, et une place ne désigne pas toujours la
 * même équipe.
 *
 * Le bouton fédéral précise « suite à une égalité ». On ne l'impose pas — la macro
 * ne le fait pas non plus — mais on le dit quand les deux équipes ne sont pas à
 * égalité : intervertir deux places que les critères séparent, c'est contredire le
 * règlement, et autant que ce soit en connaissance de cause.
 */
export function PermutationsClassement({
  concours,
  classement,
  teamsById,
}: {
  concours: Concours;
  classement: Standing[];
  teamsById: Map<string, Team>;
}) {
  const [rang1, setRang1] = useState('');
  const [rang2, setRang2] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const permutations = concours.permutationsClassement ?? [];
  const actives = permutationsActives(classement, permutations);

  const nom = (id: string): string => {
    const t = teamsById.get(id);
    return t ? `${t.number} ${teamDisplayName(t)}` : id;
  };

  const paire = permutationDepuisRangs(classement, Number(rang1), Number(rang2));
  const aEgalite = (() => {
    if (!paire) return true;
    const a = classement.find((s) => s.id === paire.a);
    const b = classement.find((s) => s.id === paire.b);
    return a && b ? memeNiveau(a, b) : true;
  })();

  const intervertir = async () => {
    setErreur(null);
    if (!paire) {
      setErreur('Indiquez deux places différentes du classement.');
      return;
    }
    await updateConcours({
      ...concours,
      permutationsClassement: ajouterPermutation(permutations, paire),
    });
    setRang1('');
    setRang2('');
  };

  const annuler = async (index: number) => {
    await updateConcours({
      ...concours,
      permutationsClassement: retirerPermutation(permutations, index),
    });
  };

  return (
    <div className="permutations-classement no-print">
      <h3>Changement dans le classement</h3>
      <p className="hint">
        À égalité après tous les départages — victoires, goal-average, points marqués,
        confrontation directe — c'est à l'organisateur de trancher. Indiquez les deux places à
        intervertir, comme dans le classeur fédéral.
      </p>
      <div className="form-row">
        <label>
          Première place
          <input
            value={rang1}
            onChange={(e) => setRang1(e.target.value)}
            inputMode="numeric"
            placeholder="ex. 5"
          />
        </label>
        <label>
          Seconde place
          <input
            value={rang2}
            onChange={(e) => setRang2(e.target.value)}
            inputMode="numeric"
            placeholder="ex. 6"
          />
        </label>
        <button type="button" className="btn btn-sm" onClick={() => void intervertir()}>
          ⇅ Intervertir
        </button>
      </div>
      {paire && !aEgalite && (
        <p className="hint hint-attention">
          Ces deux équipes ne sont pas à égalité : les critères les séparent. Le classeur fédéral
          réserve cette interversion aux égalités.
        </p>
      )}
      {erreur && <p className="form-error">{erreur}</p>}
      {permutations.length > 0 && (
        <ul className="permutations-liste">
          {permutations.map((p, i) => (
            <li key={`${p.a}-${p.b}`}>
              {nom(p.a)} ⇅ {nom(p.b)}
              {/* Une interversion ne vaut que tant que l'égalité dure. Quand les
                  résultats séparent les deux équipes, elle cesse d'agir — et il
                  faut le dire, sinon elle paraîtrait ignorée. */}
              {!actives.some((x) => x.a === p.a && x.b === p.b) && (
                <span className="hint hint-attention">
                  sans effet : ces équipes ne sont plus à égalité
                </span>
              )}
              <button
                type="button"
                className="btn-icon"
                onClick={() => void annuler(i)}
                title="Annuler cette interversion"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
