/**
 * Adresse de l'application, vue depuis la page vitrine.
 *
 * La vitrine peut être servie sur un autre nom de domaine que l'application
 * (`petanque.exemple.fr` pour la présentation, `app.petanque.exemple.fr` pour
 * l'application). Dans ce cas `VITE_APP_ORIGIN` porte l'origine de
 * l'application au moment du build, et les liens de la vitrine sont absolus.
 *
 * Vide en développement et sur un déploiement à un seul nom de domaine : les
 * liens restent relatifs, rien ne change.
 */
const APP_ORIGIN = ((import.meta.env.VITE_APP_ORIGIN as string | undefined) ?? '').replace(
  /\/+$/,
  '',
);

/** Lien vers un chemin de l'application (absolu si elle est ailleurs). */
export function appUrl(path: string): string {
  return `${APP_ORIGIN}${path}`;
}

/**
 * Vrai si l'application est servie sur une autre origine que la page courante.
 *
 * Sert à prévenir un visiteur dont l'appareil garde des données locales de
 * l'époque où l'application vivait ici : ces données appartiennent à cette
 * origine et ne suivront pas le déménagement.
 */
export function appIsElsewhere(): boolean {
  if (!APP_ORIGIN || typeof window === 'undefined') return false;
  return APP_ORIGIN !== window.location.origin;
}
