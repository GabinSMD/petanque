/**
 * Paramétrage multisite (manuel « Gestion Concours » §3.B.10.D).
 *
 * « Utilisé en général pour des qualificatifs de championnat car nombre de
 * terrains insuffisant pour organiser le concours sur un seul site. Cette
 * fonction fractionne un concours déjà paramétré (équipes inscrites) en
 * plusieurs concours selon le nombre de sites demandés. »
 *
 * On inscrit donc tout le monde dans un concours, puis on le coupe : chaque
 * site joue le sien.
 *
 * Deux règles que le manuel ne fixe pas :
 *
 *  - **les effectifs suivent les terrains.** Sa copie d'écran montre « 2 sites
 *    de 100 équipes », mais c'est un cas où les deux sites ont autant de
 *    terrains. Donner 100 équipes à un site de 10 terrains et 100 à un site de
 *    20 ferait jouer le premier deux fois plus longtemps. Le partage est donc
 *    proportionnel — et redonne exactement l'exemple du manuel à terrains
 *    égaux ;
 *  - **un club reste sur un seul site.** Personne ne doit avoir à se rendre
 *    dans deux villes le même jour. C'est une préférence, pas une règle : un
 *    club plus nombreux qu'un site est réparti plutôt que laissé dehors.
 */
import type { Team } from '../types';
import type { EngineCtx } from './ctx';
import { shuffle } from './ctx';

/** Un site d'accueil : son nom (le lieu) et ses terrains. */
export interface Site {
  nom: string;
  nbTerrains: number;
}

/** Ce qu'un site reçoit du fractionnement. */
export interface RepartitionSite {
  site: Site;
  teamIds: string[];
}

/** Deux équipes : en dessous, un site n'a personne à faire jouer. */
const MINIMUM_PAR_SITE = 2;

/**
 * Effectif de chaque site, proportionnel à ses terrains. Le reste de la
 * division va aux sites dont la part est la plus amputée par l'arrondi (plus
 * fort reste), pour que la somme fasse exactement l'effectif engagé.
 */
export function effectifsParSite(nbEquipes: number, sites: Site[]): number[] {
  if (sites.length < 2) {
    throw new Error('Il faut au moins deux sites pour fractionner un concours');
  }
  if (sites.some((s) => s.nbTerrains <= 0)) {
    throw new Error('Chaque site doit avoir au moins un terrain');
  }

  const totalTerrains = sites.reduce((a, s) => a + s.nbTerrains, 0);
  const exacts = sites.map((s) => (nbEquipes * s.nbTerrains) / totalTerrains);
  const parts = exacts.map(Math.floor);

  let reste = nbEquipes - parts.reduce((a, b) => a + b, 0);
  const ordreDesRestes = exacts
    .map((exact, i) => ({ i, reste: exact - Math.floor(exact) }))
    .sort((a, b) => b.reste - a.reste);
  for (const { i } of ordreDesRestes) {
    if (reste <= 0) break;
    parts[i] = parts[i]! + 1;
    reste -= 1;
  }

  if (parts.some((p) => p < MINIMUM_PAR_SITE)) {
    throw new Error(
      `Effectif trop faible : chaque site doit recevoir au moins ${MINIMUM_PAR_SITE} équipes`,
    );
  }
  return parts;
}

/**
 * Répartit les équipes inscrites entre les sites : effectifs proportionnels aux
 * terrains, et les équipes d'un même club gardées ensemble tant qu'il reste de
 * la place. Les clubs les plus nombreux sont placés d'abord — sinon ce sont eux
 * qu'on finit par couper.
 */
export function repartirEntreSites(
  teams: Team[],
  sites: Site[],
  ctx: EngineCtx,
): RepartitionSite[] {
  const effectifs = effectifsParSite(teams.length, sites);
  const restant = [...effectifs];
  const out: RepartitionSite[] = sites.map((s) => ({ site: s, teamIds: [] }));

  // Regroupement par club. Une équipe sans club ne forme pas un groupe avec les
  // autres sans club : chacune se place librement.
  const groupes: Team[][] = [];
  const parClub = new Map<string, Team[]>();
  for (const t of teams) {
    const club = t.club?.trim();
    if (!club) {
      groupes.push([t]);
      continue;
    }
    const cle = club.toLowerCase();
    const g = parClub.get(cle);
    if (g) g.push(t);
    else parClub.set(cle, [t]);
  }
  groupes.push(...parClub.values());

  // Les gros clubs d'abord, hasard entre groupes de même taille.
  const ordonnes = shuffle(groupes, ctx.rng).sort((a, b) => b.length - a.length);

  for (const groupe of ordonnes) {
    let aPlacer = [...groupe];
    while (aPlacer.length > 0) {
      // Le site qui peut prendre le groupe entier ; sinon le plus disponible.
      const candidats = out
        .map((r, i) => ({ i, place: restant[i]! }))
        .filter((c) => c.place > 0);
      if (candidats.length === 0) break;
      const entiers = candidats.filter((c) => c.place >= aPlacer.length);
      const choisi = (entiers.length > 0 ? entiers : candidats).sort(
        (a, b) => b.place - a.place,
      )[0]!;
      const combien = Math.min(aPlacer.length, choisi.place);
      out[choisi.i]!.teamIds.push(...aPlacer.slice(0, combien).map((t) => t.id));
      restant[choisi.i] = choisi.place - combien;
      aPlacer = aPlacer.slice(combien);
    }
  }
  return out;
}
