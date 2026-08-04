/**
 * Fraîcheur du fichier des licenciés (manuel « Gestion Concours » §2.1, p.8).
 *
 * Le logiciel fédéral affiche la date de sa base à chaque ouverture, et la
 * signale quand elle est vieille :
 *
 * > Dans le cas où la date de la base des Licenciés est en **« Fond ORANGE »**,
 * > télécharger la base […] cliquer sur le bouton « Maj Base ».
 *
 * Nous n'affichions qu'un **compte** — `📇 Licenciés (1 234)` — jamais une date,
 * alors que chaque fiche porte son `updatedAt`.
 *
 * ## Pourquoi une date manquante est un piège
 *
 * Le fichier est ce sur quoi reposent tous nos contrôles : catégorie d'âge,
 * année de reprise, certificat médical, mutation, nationalité. Ce sont
 * exactement les données qui se périment. Une tablette qui contrôle en août avec
 * un fichier de février de l'année précédente rejette des licences prises
 * entre-temps, valide des certificats expirés, et applique des changements de
 * club dépassés — jusqu'à la colonne CD (`engine/comites.ts`), qui lit la fiche
 * avant le numéro de licence. Et elle le fait **sans un mot** : un contrôle qui
 * a l'air de fonctionner.
 *
 * ## Le seuil est la saison, pas un nombre de jours
 *
 * Le manuel ne dit pas à partir de quand son fond passe à l'orange, et aucune
 * capture ne montre les deux états côte à côte pour le déduire. Nous choisissons
 * donc le nôtre, et il n'est pas arbitraire : une licence de l'année N+1 se
 * prend **dès novembre** de l'année N — c'est déjà la règle que `licences.ts`
 * applique à l'année de reprise. La saison fédérale court donc de novembre à
 * octobre, et c'est le seul franchissement qui rende une base *fausse* plutôt
 * que simplement incomplète : passée la saison, **toutes** les années de reprise
 * sont périmées et chaque licence ressort en anomalie.
 *
 * Un seuil en jours dirait « vieille de 90 jours » d'un fichier de décembre en
 * février, qui est parfaitement bon.
 *
 * ## Ce qu'on ne fait pas
 *
 * **Rien n'est bloqué.** Le manuel non plus ne bloque pas : il colore. Un
 * concours doit pouvoir se tenir avec une base imparfaite, à condition que
 * l'organisateur le sache.
 *
 * Et on ne crie pas au loup sur une date illisible : absence de preuve n'est pas
 * preuve de péremption, et une alerte à tort sur chaque écran apprendrait à
 * l'organisateur à ne plus la lire.
 */

/**
 * Saison fédérale d'une date : novembre et décembre appartiennent déjà à la
 * saison suivante.
 */
export function saisonFederale(dateISO: string): number {
  const annee = Number(dateISO.slice(0, 4));
  const mois = Number(dateISO.slice(5, 7));
  return mois >= 11 ? annee + 1 : annee;
}

export interface FraicheurLicencies {
  /** Nombre de fiches en base. */
  nombre: number;
  /** Date de la base : la plus récente des fiches. Absente si indatable. */
  date?: string;
  /** Saison de cette date. */
  saison?: number;
  /** Saison de la date du jour. */
  saisonCourante: number;
  /** La base est-elle d'une saison révolue ? C'est le fond orange fédéral. */
  perimee: boolean;
}

/** Une date que nous avons écrite nous-mêmes : ISO, donc `AAAA-MM-JJ…`. */
const ISO = /^\d{4}-\d{2}-\d{2}/;

/**
 * Date de la base : la plus récente des fiches, les dates illisibles écartées.
 *
 * Séparée du verdict à dessein. Sur une tablette, charger trente mille fiches
 * pour n'en lire qu'une date serait absurde : l'écran passe par l'index de
 * `updatedAt` et n'appelle que `fraicheurLicencies`. Cette fonction sert quand
 * les fiches sont **déjà** en mémoire, et elle donne la règle du maximum un seul
 * endroit.
 */
export function dateDeLaBase(licencies: { updatedAt: string }[]): string | undefined {
  let date: string | undefined;
  for (const l of licencies) {
    if (!ISO.test(l.updatedAt)) continue;
    if (!date || l.updatedAt > date) date = l.updatedAt;
  }
  return date;
}

export function fraicheurLicencies(
  date: string | undefined,
  nombre: number,
  maintenant: string,
): FraicheurLicencies {
  const saisonCourante = saisonFederale(maintenant);
  const lisible = date && ISO.test(date) ? date : undefined;
  const saison = lisible ? saisonFederale(lisible) : undefined;
  return {
    nombre,
    date: lisible,
    saison,
    saisonCourante,
    perimee: saison !== undefined && saison < saisonCourante,
  };
}
