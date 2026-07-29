/**
 * Marque de l'application : une boule striée et son but.
 *
 * Ce composant vit à part parce que la page vitrine s'en sert et qu'elle est
 * construite comme un document indépendant : l'importer depuis `App.tsx`
 * entraînerait le routeur et toutes les pages de l'application dans le
 * paquet de la vitrine.
 */
export function BouleLogo() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#d8dde2" stroke="#4a545e" strokeWidth="2" />
      <path d="M4 12 A 14 14 0 0 1 28 12" fill="none" stroke="#4a545e" strokeWidth="1.5" />
      <path d="M4 20 A 14 14 0 0 0 28 20" fill="none" stroke="#4a545e" strokeWidth="1.5" />
      <circle cx="24" cy="25" r="4.5" fill="#d21c34" stroke="#7c1220" strokeWidth="1.5" />
    </svg>
  );
}
