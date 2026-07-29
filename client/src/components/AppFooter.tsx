import { rappelerNouveautes } from '../help/nouveautesState';
import { versionCourte, versionDetaillee } from '../lib/version';

/**
 * Pied de page : discret, mais toujours à la même place, pour qu'on puisse
 * répondre à « quelle version avez-vous ? » sans fouiller. Jamais imprimé, et
 * absent de l'affichage TV (qui ne passe pas par le Layout).
 *
 * Cliquer sur la version rouvre le tour d'horizon des nouveautés : c'est le
 * seul endroit fixe où l'on est sûr de le retrouver.
 */
export function AppFooter() {
  return (
    <footer className="app-footer no-print">
      <span className="app-footer-brand">
        Pétanque <strong>Concours</strong>
      </span>
      <button
        type="button"
        className="app-footer-version"
        title={`${versionDetaillee()} — cliquez pour revoir les nouveautés`}
        onClick={rappelerNouveautes}
      >
        {versionCourte()}
      </button>
    </footer>
  );
}
