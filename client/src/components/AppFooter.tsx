import { versionCourte, versionDetaillee } from '../lib/version';

/**
 * Pied de page : discret, mais toujours à la même place, pour qu'on puisse
 * répondre à « quelle version avez-vous ? » sans fouiller. Jamais imprimé, et
 * absent de l'affichage TV (qui ne passe pas par le Layout).
 */
export function AppFooter() {
  return (
    <footer className="app-footer no-print">
      <span className="app-footer-brand">
        Pétanque <strong>Concours</strong>
      </span>
      <span className="app-footer-version" title={versionDetaillee()}>
        {versionCourte()}
      </span>
    </footer>
  );
}
