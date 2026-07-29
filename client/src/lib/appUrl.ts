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

/** Origine de la page vitrine, pour y revenir depuis l'application. */
const SITE_ORIGIN = ((import.meta.env.VITE_SITE_ORIGIN as string | undefined) ?? '').replace(
  /\/+$/,
  '',
);

/** Lien vers un chemin de l'application (absolu si elle est ailleurs). */
export function appUrl(path: string): string {
  return `${APP_ORIGIN}${path}`;
}

/** Lien vers la page de présentation, où qu'elle soit servie. */
export function siteUrl(): string {
  return SITE_ORIGIN || '/';
}

/**
 * Vrai si la présentation est un site à part, sur son propre nom de domaine.
 *
 * C'est ce qui décide de ce que l'application fait de sa racine quand personne
 * n'est connecté : s'il existe une vitrine ailleurs, elle y accueille déjà les
 * visiteurs, et l'application n'a plus qu'à demander de se connecter. Sur un
 * déploiement à un seul nom de domaine, en revanche, la racine reste le seul
 * endroit où présenter le logiciel.
 */
export function vitrineSeparee(): boolean {
  return APP_ORIGIN !== '';
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
