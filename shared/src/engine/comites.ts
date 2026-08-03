/**
 * Comité d'un joueur — la colonne « CD » du manuel.
 *
 * Relevée trois fois, dans trois rôles, sur trois pages :
 *
 *  - **p.19** : une colonne `CD` devant le n° de licence dans la grille
 *    d'inscription, une par joueur ;
 *  - **p.25** : remplie `038` / `074` / `074` sur une **même équipe**, avec des
 *    clubs de deux départements. Le comité n'est donc pas une propriété de
 *    l'équipe qu'on déduirait du club ;
 *  - **p.51** : colonne d'une liste imprimée de ligue — `101 CD01`, `113 CD38`,
 *    `121 CD69` — un comité par équipe, et l'axe de lecture du document.
 *
 * Sur un concours de club, personne ne la regarde. Sur un qualificatif de ligue —
 * trente-deux équipes de huit comités, le cas de la p.51 — c'est ce que le
 * délégué vérifie.
 *
 * ## Deux écritures du même comité
 *
 * La grille de saisie porte le **code fédéral à trois chiffres** (`038`), la liste
 * imprimée écrit **`CD38`**. On garde le code en base et on ne met en forme qu'à
 * l'affichage : c'est le code qui se compare, et `001` doit s'écrire `CD01` et non
 * `CD1`.
 *
 * ## Ce qu'on n'ajoute pas
 *
 * **Pas de tri « par comité ».** La fenêtre fédérale n'offre que trois options —
 * Numérotation, Nom, Club (p.50) — et si la liste de ligue paraît groupée par
 * comité, c'est parce que les **dossards** ont été attribués comité par comité
 * (101-104 en CD01, 105-108 en CD07…). Ajouter une quatrième option serait
 * inventer un tri que le manuel ne propose pas.
 */
import type { Licencie, Player } from '../types';
import { departementDeLicence } from './rapportDelegue';

/**
 * Comité d'un joueur, du plus sûr au moins sûr : la valeur saisie, celle de sa
 * fiche fédérale, puis les trois premiers chiffres de sa licence.
 *
 * La saisie prime parce que la p.25 le prouve : un joueur peut relever d'un autre
 * comité que celui que son numéro de licence suggère.
 */
export function comiteDuJoueur(
  player: Player,
  fiches?: Map<string, Licencie>,
): string | undefined {
  const saisi = player.comite?.trim();
  if (saisi) return saisi;
  const fiche = player.licence ? fiches?.get(player.licence) : undefined;
  const deLaFiche = fiche?.comite?.trim();
  if (deLaFiche) return deLaFiche;
  return departementDeLicence(player.licence);
}

/** Comités distincts d'une équipe, dans l'ordre des joueurs. */
export function comitesEquipe(players: Player[], fiches?: Map<string, Licencie>): string[] {
  const vus = new Map<string, string>();
  for (const p of players) {
    const comite = comiteDuJoueur(p, fiches);
    if (comite) vus.set(comite, comite);
  }
  return [...vus.values()];
}

/**
 * Code de comité tel que la liste imprimée l'écrit : `038` → `CD38`, `001` →
 * `CD01`. Les codes d'outre-mer (971 à 976) gardent leurs trois chiffres, faute
 * de capture qui montre le contraire.
 */
export function codeComiteAffiche(code: string | undefined): string | undefined {
  const brut = code?.trim();
  if (!brut || !/^\d{1,3}$/.test(brut)) return undefined;
  const significatif = brut.replace(/^0+/, '');
  if (!significatif) return undefined;
  return `CD${significatif.length === 1 ? `0${significatif}` : significatif}`;
}

/** « CD38 / CD74 » — comme `libelleClubs`, pour les comités. */
export function libelleComites(players: Player[], fiches?: Map<string, Licencie>): string {
  return comitesEquipe(players, fiches)
    .map((c) => codeComiteAffiche(c) ?? c)
    .join(' / ');
}
