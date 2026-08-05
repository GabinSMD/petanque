import type { ConcoursMode } from '@shared';
import { MODE_INFO } from '../lib/labels';

// Quatre cases que personne ne comprend sans le manuel FFPJP : formule par
// groupes A-B-C (§3.D.5), gagnant contre gagnant strict (§3.D.14.C),
// complémentaire et repêchage au cadrage. `montrer('formulesAvancees', …)`
// les masque en dessous du niveau « club » — extraites ici pour que la
// condition d'affichage ne s'éparpille pas dans `ConcoursForm`.
//
// La consolante n'en fait pas partie : c'est le repêchage que tout le monde
// comprend, et l'assistant de création la propose déjà. Elle reste possédée
// par `ConcoursForm`, qui la passe ici en lecture seule pour savoir s'il faut
// afficher ses deux cases filles (complémentaire, repêchage au cadrage).
interface PropsBlocFormulesAvancees {
  mode: ConcoursMode;
  parGroupes: boolean;
  setParGroupes: (v: boolean) => void;
  ggStrict: boolean;
  /**
   * Bascule du strict. Pas de `setGgStrict` : le parent doit aussi rabattre
   * `nbRondes` sur la nouvelle borne, et le bloc ne possède pas cet état.
   */
  onGgStrictChange: (actif: boolean) => void;
  consolante: boolean;
  complementaire: boolean;
  setComplementaire: (v: boolean) => void;
  recupCadrage: boolean;
  setRecupCadrage: (v: boolean) => void;
  /** Après tirage, la structure n'est plus modifiable. */
  lockStructure?: boolean;
}

export function BlocFormulesAvancees({
  mode,
  parGroupes,
  setParGroupes,
  ggStrict,
  onGgStrictChange,
  consolante,
  complementaire,
  setComplementaire,
  recupCadrage,
  setRecupCadrage,
  lockStructure,
}: PropsBlocFormulesAvancees): JSX.Element {
  return (
    <>
      {mode === 'poules' && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={parGroupes}
            onChange={(e) => setParGroupes(e.target.checked)}
            disabled={lockStructure}
          />
          Formule par groupes A-B-C (manuel §3.D.5) : tout le monde continue
          <span className="hint">
            Groupes de 4 sans barrage. L'équipe à 2 victoires va au concours A, les deux à 1 victoire
            au B, celle à 2 défaites au C — personne ne rentre après deux parties.
          </span>
        </label>
      )}
      {mode === 'suisse' && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={ggStrict}
            onChange={(e) => onGgStrictChange(e.target.checked)}
          />
          Gagnant contre gagnant strict (manuel §3.D.14.C)
          <span className="hint">
            N'oppose que des équipes à égalité stricte de victoires. Un groupe impair laisse une
            équipe exempte, créditée d'un 13-7 comme un forfait. Sans l'option, l'appariement suit
            le classement et un gagnant peut rencontrer un perdant.
          </span>
        </label>
      )}
      {/* Même garde que celle qui affiche la case « consolante » dans le
          parent : sans elle, un `parGroupes` ou un changement de mode
          laisserait ces cases filles apparaître sur la valeur figée d'un
          `consolante` désormais sans rapport. */}
      {mode !== 'elimination_directe' && MODE_INFO[mode].consolante && !parGroupes && consolante && (
        <>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={complementaire}
              onChange={(e) => setComplementaire(e.target.checked)}
              disabled={lockStructure}
            />
            Complémentaire (2ᵉ repêchage : perdants de la consolante)
          </label>
          {mode === 'poules' && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={recupCadrage}
                onChange={(e) => setRecupCadrage(e.target.checked)}
                disabled={lockStructure}
              />
              Repêchage au cadrage : les perdants du 1<sup>er</sup> tour du tableau rejoignent la
              2ᵉ partie de la consolante
            </label>
          )}
        </>
      )}
    </>
  );
}
