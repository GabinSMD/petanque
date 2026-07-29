/**
 * Identité de la version en cours d'exécution.
 *
 * Les trois constantes sont injectées au build par `define` (vite.config.ts) :
 * elles ne sont donc jamais recopiées à la main et ne peuvent pas mentir sur ce
 * que l'appareil exécute réellement. C'est ce dont on a besoin quand une
 * tablette du boulodrome reste bloquée sur un ancien service worker, ou quand un
 * message d'erreur demande de « mettre l'application à jour ».
 */

declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;

export const APP_VERSION = __APP_VERSION__;

/** Commit court, ou chaîne vide si le build n'avait pas accès à git. */
export const APP_COMMIT = __APP_COMMIT__;

/** Date de compilation, en ISO. */
export const APP_BUILT_AT = __APP_BUILT_AT__;

/** Étiquette courte, celle qu'on lit dans le pied de page. */
export function versionCourte(): string {
  return APP_COMMIT ? `v${APP_VERSION} · ${APP_COMMIT}` : `v${APP_VERSION}`;
}

/**
 * Phrase complète pour l'info-bulle : de quoi la lire au téléphone et la dicter
 * à celui qui dépanne.
 */
export function versionDetaillee(): string {
  const parts = [`Version ${APP_VERSION}`];
  if (APP_COMMIT) parts.push(`commit ${APP_COMMIT}`);
  const built = dateCompilation();
  if (built) parts.push(`compilée le ${built}`);
  return parts.join(' — ');
}

/** Date de compilation en français, ou chaîne vide si elle est illisible. */
export function dateCompilation(): string {
  const d = new Date(APP_BUILT_AT);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
