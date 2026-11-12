import { ICONE, LOGO } from './treizeroTraces';

/**
 * Marque Treizéro, tracée depuis le visuel validé (`assets/marque/*.svg`).
 *
 * Le bleu suit la couleur du texte (`currentColor`) : celui de la marque sur
 * une surface claire, blanc sur l'en-tête bleu, où une boule bleue ne se
 * verrait pas. Le rouge — le but, et le « o » final — se règle par la classe
 * `marque-rouge`.
 *
 * Ces composants vivent à part parce que la page vitrine s'en sert et qu'elle
 * est construite comme un document indépendant : les importer depuis
 * `App.tsx` entraînerait le routeur et toutes les pages de l'application dans
 * le paquet de la vitrine.
 */
function Traces({ source }: { source: typeof ICONE }) {
  return (
    <>
      <g fill="currentColor">
        {source.bleu.map((p, i) => (
          <path key={i} transform={p.t} d={p.d} />
        ))}
      </g>
      <g className="marque-rouge">
        {source.rouge.map((p, i) => (
          <path key={i} transform={p.t} d={p.d} />
        ))}
      </g>
    </>
  );
}

/** L'icône seule : la boule, sa strie et le but. Décorative à côté du nom. */
export function BouleLogo() {
  return (
    <svg className="boule-logo" viewBox={ICONE.viewBox} width="26" height="26" aria-hidden>
      <Traces source={ICONE} />
    </svg>
  );
}

/**
 * Le logo complet : la boule et le nom, dont le « o » final est le zéro de
 * « treize à zéro ». C'est une image du nom : elle le porte comme texte de
 * remplacement.
 */
export function LogoTreizero() {
  return (
    <svg className="logo-treizero" viewBox={LOGO.viewBox} role="img" aria-label="Treizéro">
      <Traces source={LOGO} />
    </svg>
  );
}

/** Le nom en toutes lettres, là où le logo serait trop petit pour se lire. */
export function Marque() {
  return (
    <span className="marque">
      Treizér<span className="marque-o">o</span>
    </span>
  );
}
