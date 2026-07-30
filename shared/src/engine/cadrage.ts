/**
 * Où tombe le cadrage d'un tableau à élimination directe (manuel §3.D.2 et
 * §3.D.11).
 *
 * Un effectif qui n'est pas une puissance de deux doit être ramené à la
 * puissance inférieure : c'est le **cadrage**. Le logiciel fédéral le place au
 * premier tour par défaut — une partie des équipes est alors exempte et passe
 * un tour sans jouer — mais laisse le choix : « Si le nombre d'inscrits est
 * inférieur à 65 équipes vous devez choisir à quel tour vous voulez faire le
 * cadrage » (§3.D.11), et « Cocher la case pour cadrer au 1er tour après les
 * poules » (§3.D.2).
 *
 * L'enjeu est concret : à 48 équipes, cadrer au premier tour offre un tour
 * gratuit à 16 équipes ; le différer d'un tour fait jouer tout le monde, et ce
 * sont les vainqueurs qui se partagent les exempts au tour suivant. Les deux
 * usages existent, d'où le choix.
 *
 * Ce module ne fait que l'arithmétique de la forme — combien de parties réelles
 * et combien d'exempts à chaque tour. Le placement des équipes est le travail du
 * tirage, et il s'appuie là-dessus.
 */

/** Parties d'un tour : celles qui se jouent, et les exempts (une équipe seule). */
export interface TourTableau {
  reelles: number;
  exempts: number;
}

const estPuissanceDeDeux = (n: number): boolean => n >= 1 && (n & (n - 1)) === 0;

const puissanceInferieure = (n: number): number => 2 ** Math.floor(Math.log2(n));

/**
 * Tours où le cadrage peut tomber, du plus tôt au plus tard.
 *
 * Cadrer au tour `k` suppose que les tours précédents soient **pleins** : tout
 * le monde joue, donc l'effectif se divise en deux à chaque fois. Un effectif
 * impair ne permet donc aucun tour plein, et une puissance de deux n'a rien à
 * cadrer du tout.
 */
export function toursCadragePossibles(nbEquipes: number): number[] {
  if (nbEquipes < 2 || estPuissanceDeDeux(nbEquipes)) return [];
  const tours: number[] = [];
  let restants = nbEquipes;
  let tour = 0;
  // `restants` est l'effectif présent au tour `tour`. On s'arrête dès qu'il
  // n'est plus divisible par deux : un tour plein n'existe pas au-delà.
  while (restants >= 3 && !estPuissanceDeDeux(restants)) {
    tours.push(tour);
    if (restants % 2 !== 0) break;
    restants /= 2;
    tour += 1;
  }
  return tours;
}

/**
 * Forme du tableau, tour par tour, pour un cadrage au tour demandé.
 *
 * Le premier élément est le premier tour. Un tour porte `exempts` non nul
 * uniquement au tour du cadrage : ailleurs, l'effectif est une puissance de
 * deux et tout le monde joue.
 */
export function formeCadrage(nbEquipes: number, tourCadrage: number): TourTableau[] {
  if (nbEquipes < 2) throw new Error('Il faut au moins 2 équipes');
  const possibles = toursCadragePossibles(nbEquipes);
  if (possibles.length > 0 && !possibles.includes(tourCadrage)) {
    throw new Error(
      `Cadrage impossible au tour ${tourCadrage + 1} : il faut que tous les tours précédents soient pleins.`,
    );
  }
  if (possibles.length === 0 && tourCadrage !== 0) {
    throw new Error('Cadrage impossible : cet effectif n\'a pas de cadrage à placer.');
  }

  const tours: TourTableau[] = [];
  let presents = nbEquipes;

  // Tours pleins avant le cadrage.
  for (let r = 0; r < tourCadrage; r += 1) {
    tours.push({ reelles: presents / 2, exempts: 0 });
    presents /= 2;
  }

  // Le tour du cadrage : on ramène l'effectif à la puissance de deux
  // inférieure. Les équipes qui n'ont pas de partie sont exemptes et montent.
  if (!estPuissanceDeDeux(presents)) {
    const cible = puissanceInferieure(presents);
    const reelles = presents - cible;
    tours.push({ reelles, exempts: cible - reelles });
    presents = cible;
  }

  // Puis un tableau plein jusqu'à la finale.
  while (presents >= 2) {
    tours.push({ reelles: presents / 2, exempts: 0 });
    presents /= 2;
  }
  return tours;
}
