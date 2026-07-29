/**
 * Ce qu'on retient, et ce qu'on dit, d'une donnée reçue mais inexploitable.
 *
 * La synchronisation refuse d'appliquer un changement cassé — c'est la règle de
 * `changementApplicable` : l'appliquer blanchirait l'écran. Mais le refuser en
 * silence est presque aussi mauvais. L'organisateur voit onze équipes sur la
 * tablette et douze sur le téléphone, et il cherche. Ou pire, il ressaisit une
 * équipe qui existe déjà ailleurs et se retrouve avec un dossard en double.
 *
 * D'où ce module : de quoi afficher une ligne honnête — combien, quoi, et la
 * conséquence — et un détail à transmettre à qui dépanne. La liste est
 * enregistrée sur l'appareil, donc elle est dédoublonnée et bornée : le serveur
 * renvoie la même ligne à chaque échange tant qu'un appareil y touche, et
 * « 47 données écartées » pour une seule serait un mensonge par accumulation.
 */

export interface DonneeEcartee {
  /** Type d'entité, tel qu'il circule dans la réplication. */
  type: string;
  id: string;
  /** Horodatage ISO du refus, sur cet appareil. */
  quand: string;
}

/** Au-delà, les plus anciennes sortent : la liste vit dans le stockage local. */
export const MAX_ECARTEES = 10;

const NOMS: Record<string, { un: string; plusieurs: string }> = {
  team: { un: 'équipe', plusieurs: 'équipes' },
  match: { un: 'partie', plusieurs: 'parties' },
  poule: { un: 'poule', plusieurs: 'poules' },
  concours: { un: 'concours', plusieurs: 'concours' },
  feuilleMatch: { un: 'feuille de match', plusieurs: 'feuilles de match' },
  licencie: { un: 'licencié', plusieurs: 'licenciés' },
};

/**
 * Ajoute un écart, le plus récent en tête. Une donnée déjà connue est
 * réactualisée plutôt que recomptée.
 */
export function ajouterEcart(liste: DonneeEcartee[], entree: DonneeEcartee): DonneeEcartee[] {
  const cle = `${entree.type}:${entree.id}`;
  const autres = liste.filter((e) => `${e.type}:${e.id}` !== cle);
  return [entree, ...autres].slice(0, MAX_ECARTEES);
}

/**
 * La phrase affichée, ou `null` s'il n'y a rien à signaler.
 *
 * Elle dit la conséquence — la donnée manque **sur cet appareil** — parce que
 * c'est ce qui évite la fausse manœuvre. Quand tous les écarts portent sur le
 * même type, on le nomme ; sinon on s'en tient à « données », plutôt que
 * d'énumérer.
 */
export function resumeEcartees(liste: DonneeEcartee[]): string | null {
  if (liste.length === 0) return null;
  const types = new Set(liste.map((e) => e.type));
  const nom = types.size === 1 ? NOMS[[...types][0]!] : undefined;
  const n = liste.length;

  if (n === 1) {
    const quoi = nom ? `Une ${nom.un}` : 'Une donnée';
    return `${quoi} reçue d'un autre appareil n'a pas pu être lue : elle n'apparaît pas ici. Rien n'est perdu ailleurs — vérifiez sur l'appareil qui l'a saisie plutôt que de la ressaisir.`;
  }
  const quoi = nom ? nom.plusieurs : 'données';
  return `${n} ${quoi} reçues d'un autre appareil n'ont pas pu être lues : elles n'apparaissent pas ici. Rien n'est perdu ailleurs — vérifiez sur l'appareil qui les a saisies plutôt que de les ressaisir.`;
}

/** Une ligne par écart, à recopier dans un message de signalement. */
export function detailEcartees(liste: DonneeEcartee[]): string {
  return liste.map((e) => `${e.quand} — ${e.type} ${e.id}`).join('\n');
}
