/**
 * Bilan des équipes engagées du rapport d'arbitrage (manuel « Gestion Concours »
 * §3.D.1.B.4.5, documents p.55 et p.78).
 *
 * Le rapport d'arbitrage imprimé se termine par un bloc statistique que nous ne
 * produisions pas :
 *
 * ```
 * Equipe(s) Non Homogène(s) : 0/32 (0%)     Joueurs de la Ligue : 64/64 (100%)
 * Equipe(s) de la Ligue : 32/32 (100%)      Joueurs du Comité : 8/64 (12%)
 * Equipe(s) du Comité : 4/32 (12%)          Joueurs Classés : 30/64 (47%)
 * Joueurs Elite : 13/64                     Joueurs Inconnus ou Etranger : 0/64
 * Joueurs Honneur : 17/64
 * Joueurs Promotion : 34/64 (53%)
 * Critère X (% Joueur Promotion) = 53%
 * Critère Y (% Extérieur CD) = 88%
 * Critère Z (% Extérieur CT) = 0%
 *
 *                           Manifestation Classée Grille D
 * ```
 *
 * Ce n'est pas de la décoration : les critères décident de la **grille**, et la
 * grille décide des **points fédéraux** attribués aux joueurs.
 *
 * ## Ce que ce module calcule, et ce qu'il refuse de calculer
 *
 * Tout ce qui est **vérifiable sur les deux exemplaires du document** est ici.
 * Deux choses en sont délibérément absentes :
 *
 *  - le **critère X**. Son libellé dit « % Joueur Promotion », et l'exemplaire de
 *    la p.55 le confirme (34/64 = 53 %) — mais celui de la p.78 écrit
 *    `Joueurs Promotion : 20/99 (0%)` avec `X = 0 %`, alors que 20/99 fait 20 %.
 *    Les deux échantillons se contredisent. On ne devine pas une formule qui
 *    décide de points fédéraux ;
 *  - la **table des grilles**. Le manuel ne la donne nulle part. Deux points
 *    seulement sont connus : X=53/Y=88/Z=0 → grille **D**, et X=0/Y=100/Z=100 →
 *    grille **C**. C'est très loin d'une table.
 *
 * Les deux attendent le barème du comité. Le reste du bloc n'a pas à attendre.
 *
 * ## La ligue n'est pas déductible, elle se déclare
 *
 * Le rapport distingue le **comité** (`CD DROME`) de la **ligue**, qu'il nomme
 * `CT` (`RHONE ALPES`). Nous connaissons le comité de chaque joueur — c'est
 * `comiteDuJoueur`, du lot #124 — mais **aucune donnée ne dit à quelle ligue
 * appartient un comité**, et cette table n'est pas dans le manuel. L'inventer de
 * mémoire serait exactement la faute qui a produit `_JP_` au lieu de `_PROV_`.
 *
 * Elle se déclare donc : `comitesLigue` est la liste des comités de la ligue
 * organisatrice. Absente, les trois grandeurs de ligue et le critère Z restent
 * `undefined` — un bilan incomplet et honnête plutôt qu'un chiffre inventé.
 */
import type { Classification, Licencie, Player, Team } from '../types';
import { comiteDuJoueur } from './comites';
import { estHomogene } from './clubs';

/**
 * Pourcentage tel que le document l'écrit : entier, **demis arrondis au pair**.
 *
 * Les neuf pourcentages lisibles sur les deux exemplaires ne s'expliquent que
 * comme cela : `12,5` descend à **12** (4/32 et 8/64) tandis que `87,5` monte à
 * **88**. L'arrondi supérieur — celui de `Math.round` — donnerait 13 aux deux
 * premiers ; la troncature perdrait 47, 88 et 51.
 *
 * C'est l'arrondi de `Round()` en VB et Excel, ce qu'est le logiciel fédéral. La
 * coïncidence est trop exacte sur neuf valeurs pour en être une.
 */
export function pourcentageFederal(n: number, total: number): number {
  if (total <= 0) return 0;
  const exact = (n * 100) / total;
  const bas = Math.floor(exact);
  const reste = exact - bas;
  if (reste > 0.5) return bas + 1;
  if (reste < 0.5) return bas;
  // Pile un demi : on va au pair.
  return bas % 2 === 0 ? bas : bas + 1;
}

/** Joueurs par classification fédérale. */
export interface ComptesClassification {
  elite: number;
  honneur: number;
  promotion: number;
}

/**
 * Compte les joueurs par classification fédérale.
 *
 * Extraite parce que **deux** documents la demandent : le bilan du rapport
 * d'arbitrage (§3.D.1.B.4.5) et le rapport de validité avant tirage
 * (§3.B.6, « Nombre de Joueurs Elites / Honneurs / Promotions »). Deux écrans
 * qui compteraient chacun à leur façon finiraient par ne plus dire la même
 * chose du même champ.
 *
 * `Classification` est une **lettre** — `E`, `H`, `P` — et non un mot : c'est la
 * faute que le typecheck a rattrapée au lot #132, et c'est pour cela que le
 * paramètre est typé plutôt que laissé en `string`.
 *
 * Un joueur sans fiche, ou dont la fiche ne porte pas de classification, ne
 * compte nulle part — on ne le range pas d'office en promotion.
 */
export function comptesClassification(
  players: Player[],
  fiches: Map<string, Licencie>,
): ComptesClassification {
  const parLettre = (attendue: Classification): number =>
    players.filter((p) => (p.licence ? fiches.get(p.licence)?.classification : undefined) === attendue)
      .length;
  return {
    elite: parLettre('E'),
    honneur: parLettre('H'),
    promotion: parLettre('P'),
  };
}

/** Un compte du document : un effectif, son total, et son pourcentage. */
export interface CompteBilan {
  n: number;
  total: number;
  pourcentage: number;
}

const compte = (n: number, total: number): CompteBilan => ({
  n,
  total,
  pourcentage: pourcentageFederal(n, total),
});

export interface CriteresBilanArbitrage {
  /** Code du comité organisateur, à trois chiffres (`026`). */
  comiteOrganisateur?: string;
  /**
   * Comités de la ligue organisatrice. **Déclarés**, jamais déduits : la table
   * comité → ligue n'est pas dans le manuel. Absents, les grandeurs de ligue et
   * le critère Z ne sont pas rendus.
   */
  comitesLigue?: string[];
}

export interface BilanArbitrage {
  equipes: {
    total: number;
    nonHomogenes: CompteBilan;
    comite: CompteBilan;
    /** Absent quand les comités de la ligue ne sont pas déclarés. */
    ligue?: CompteBilan;
  };
  joueurs: {
    total: number;
    elite: CompteBilan;
    honneur: CompteBilan;
    promotion: CompteBilan;
    /** Élite **ou** honneur : le document fait 13 + 17 = 30. */
    classes: CompteBilan;
    /** Absents du fichier des licenciés, ou porteurs d'une licence étrangère. */
    inconnus: CompteBilan;
    comite: CompteBilan;
    ligue?: CompteBilan;
  };
  /** « Critère Y (% Extérieur CD) » : les joueurs qui ne sont pas du comité. */
  critereY: number;
  /** « Critère Z (% Extérieur CT) ». Absent sans comités de ligue déclarés. */
  critereZ?: number;
}

/**
 * Bilan du champ engagé.
 *
 * Les **forfaits sont écartés** : ils ne composent pas le champ, et le document
 * compte des équipes présentes. C'est la même règle que `depotStats`.
 *
 * Une équipe est « du comité » quand **tous** ses joueurs en sont. Le document le
 * prouve par son arithmétique : 4 équipes du comité pour 8 joueurs du comité, en
 * doublette — 4 × 2 = 8, donc aucune équipe mixte n'est comptée. Même lecture
 * pour la ligue, où 32 équipes répondent à 64 joueurs.
 */
export function bilanArbitrage(
  teams: Team[],
  fiches: Map<string, Licencie>,
  criteres: CriteresBilanArbitrage,
): BilanArbitrage {
  const engagees = teams.filter((t) => !t.forfait);
  const players = engagees.flatMap((t) => t.players);
  const nbEquipes = engagees.length;
  const nbJoueurs = players.length;

  const comiteOrg = criteres.comiteOrganisateur?.trim();
  const ligue = criteres.comitesLigue?.length
    ? new Set(criteres.comitesLigue.map((c) => c.trim()).filter(Boolean))
    : undefined;

  const ficheDe = (p: Player): Licencie | undefined =>
    p.licence ? fiches.get(p.licence) : undefined;

  /** Inconnu du fichier, ou licencié à l'étranger : hors du champ français. */
  const estInconnu = (p: Player): boolean => Boolean(p.licenceEtrangere) || !ficheDe(p);

  const duComite = (p: Player): boolean =>
    Boolean(comiteOrg) && comiteDuJoueur(p, fiches) === comiteOrg;
  const deLaLigue = (p: Player): boolean => {
    if (!ligue) return false;
    const c = comiteDuJoueur(p, fiches);
    return Boolean(c) && ligue.has(c!);
  };

  // Une seule définition du comptage par classification, partagée avec le
  // rapport de validité avant tirage : voir `comptesClassification`.
  const { elite, honneur, promotion } = comptesClassification(players, fiches);
  const joueursComite = players.filter(duComite).length;
  const joueursLigue = players.filter(deLaLigue).length;

  /** Une équipe compte quand **tous** ses joueurs répondent. */
  const equipesOu = (predicat: (p: Player) => boolean): number =>
    engagees.filter((t) => t.players.length > 0 && t.players.every(predicat)).length;

  return {
    equipes: {
      total: nbEquipes,
      nonHomogenes: compte(
        engagees.filter((t) => !estHomogene(t.players, t.club)).length,
        nbEquipes,
      ),
      comite: compte(equipesOu(duComite), nbEquipes),
      ...(ligue ? { ligue: compte(equipesOu(deLaLigue), nbEquipes) } : {}),
    },
    joueurs: {
      total: nbJoueurs,
      elite: compte(elite, nbJoueurs),
      honneur: compte(honneur, nbJoueurs),
      promotion: compte(promotion, nbJoueurs),
      classes: compte(elite + honneur, nbJoueurs),
      inconnus: compte(players.filter(estInconnu).length, nbJoueurs),
      comite: compte(joueursComite, nbJoueurs),
      ...(ligue ? { ligue: compte(joueursLigue, nbJoueurs) } : {}),
    },
    critereY: pourcentageFederal(nbJoueurs - joueursComite, nbJoueurs),
    ...(ligue ? { critereZ: pourcentageFederal(nbJoueurs - joueursLigue, nbJoueurs) } : {}),
  };
}
