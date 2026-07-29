/**
 * Journal des nouveautés : quoi montrer à l'utilisateur après une mise à jour.
 *
 * L'application est une PWA en mise à jour automatique : elle se remplace
 * silencieusement. Sans rien, les fonctionnalités livrées ne sont jamais
 * découvertes. C'est le rôle de la pop-up « Nouveautés » — et de ce module, qui
 * décide *ce qu'il y a à montrer*, sans toucher au stockage ni à l'affichage.
 *
 * C'est le **journal** qui fait référence, pas le numéro du `package.json` :
 * la version affichée est une étiquette utile au dépannage, mais un oubli de
 * bump ne doit pas rendre la détection muette. La version retenue est donc
 * toujours la plus haute que le journal publie, et le tri ne suppose rien de
 * l'ordre du tableau.
 */

/** Ce qu'un point de nouveauté propose de faire, une fois lu. */
export interface NouveauteAction {
  label: string;
  /**
   * Écran à ouvrir. Toujours une route de premier niveau : le journal parle de
   * l'application, pas d'un concours en particulier.
   */
  path?: string;
  /** Visite guidée à lancer à la place de la navigation. */
  tour?: 'dashboard' | 'concours';
}

export interface NouveauteItem {
  /** Émoji d'appui, facultatif. */
  icone?: string;
  titre: string;
  texte: string;
  action?: NouveauteAction;
}

/** Une version publiée, et ce qu'elle a apporté. */
export interface Nouveaute {
  version: string;
  /** Date de mise en ligne, au format AAAA-MM-JJ. */
  date: string;
  items: NouveauteItem[];
}

export interface RecapNouveautes {
  /** Versions à présenter, la plus récente d'abord. Vide = rien à annoncer. */
  entrees: Nouveaute[];
  /**
   * Version à retenir comme « vue ». Renseignée même quand il n'y a rien à
   * montrer : c'est ce qui évite de rouvrir la pop-up au prochain démarrage.
   */
  aMemoriser: string | null;
}

/**
 * Découpe `major.minor.patch`. Tolère un `v` en tête, les parties absentes et
 * un suffixe de pré-version. Renvoie `null` sur ce qui n'est pas une version :
 * une valeur illisible sort d'un stockage corrompu, et la confondre avec
 * `0.0.0` déroulerait tout le journal à la figure de l'utilisateur.
 */
export function analyserVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1] ?? 0), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/**
 * Ordonne deux versions par leurs nombres. La comparaison de texte se
 * tromperait dès `0.10.0` face à `0.9.0`.
 */
export function comparerVersions(a: string, b: string): number {
  const [aMaj, aMin, aCor] = analyserVersion(a) ?? [0, 0, 0];
  const [bMaj, bMin, bCor] = analyserVersion(b) ?? [0, 0, 0];
  if (aMaj !== bMaj) return aMaj < bMaj ? -1 : 1;
  if (aMin !== bMin) return aMin < bMin ? -1 : 1;
  if (aCor !== bCor) return aCor < bCor ? -1 : 1;
  return 0;
}

/** La plus haute version que le journal publie, ou `null` s'il est vide. */
export function versionJournal(journal: Nouveaute[]): string | null {
  return trier(journal)[0]?.version ?? null;
}

/**
 * Ce qu'il faut présenter, sachant la dernière version vue.
 *
 * - `premiereInstallation` : l'écran de bienvenue joue déjà ce rôle, on se
 *   contente de retenir la version pour ne rien annoncer plus tard.
 * - `vue` à `null` sur une installation qui n'est *pas* neuve : l'utilisateur
 *   vient d'une version d'avant le journal, il a droit au tour d'horizon
 *   complet.
 * - Versions sautées : tout est cumulé en une seule pop-up.
 */
export function recapNouveautes(
  journal: Nouveaute[],
  vue: string | null,
  options: { premiereInstallation: boolean },
): RecapNouveautes {
  const triees = trier(journal);
  const derniere = triees[0]?.version ?? null;
  if (!derniere) return { entrees: [], aMemoriser: null };

  // Ne jamais faire reculer la version retenue : un onglet resté sur un ancien
  // bundle réarmerait la pop-up pour ce qui a déjà été lu.
  const aMemoriser =
    vue && analyserVersion(vue) && comparerVersions(vue, derniere) > 0 ? vue : derniere;

  if (options.premiereInstallation) return { entrees: [], aMemoriser };
  if (vue === null) return { entrees: triees, aMemoriser };
  if (!analyserVersion(vue)) return { entrees: [], aMemoriser };

  return { entrees: triees.filter((e) => comparerVersions(e.version, vue) > 0), aMemoriser };
}

/** Copie triée du plus récent au plus ancien, entrées illisibles écartées. */
function trier(journal: Nouveaute[]): Nouveaute[] {
  return journal
    .filter((e) => analyserVersion(e.version) !== null)
    .slice()
    .sort((a, b) => comparerVersions(b.version, a.version));
}
