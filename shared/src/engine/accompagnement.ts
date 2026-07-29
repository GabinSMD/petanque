/**
 * De quoi l'assistant a besoin pour **accompagner** au lieu de proposer un
 * menu : où en est le concours, et donc quoi proposer ensuite.
 *
 * L'assistant se comportait comme un moteur de recherche dans une FAQ — il
 * répondait, puis retombait sur des « sujets voisins », c'est-à-dire un
 * catalogue. Quelqu'un au milieu d'un geste n'a pas besoin d'un catalogue : il
 * a besoin de l'étape suivante.
 *
 * Le bandeau « prochaine étape » calcule déjà cette information pour l'afficher.
 * Ce module la rend disponible sous une forme exploitable — un état nommé, pas
 * une phrase — pour que l'assistant et le bandeau ne puissent pas se
 * contredire. Le découpage suit volontairement les mêmes branches.
 */
import type { Match } from '../types';
import { winnerOf } from './match';
import { pouleOutcome, pouleSizes } from './poules';
import { rondesTirees } from './rondes';
import { seriesTirees } from './tir';
import type { EtatParcours } from './parcours';

/** Où en est le concours, du point de vue de l'accompagnement. */
export type EtapeCourante =
  | 'aucun-concours'
  /** Pas encore assez d'équipes pour la formule choisie. */
  | 'inscriptions-insuffisantes'
  /** Poules : l'effectif ne se répartit pas (5 équipes, par exemple). */
  | 'effectif-impossible'
  | 'pret-au-tirage'
  /** Des parties sont ouvertes et attendent leur score. */
  | 'scores-a-saisir'
  /** Les poules sont finies : place au tableau. */
  | 'poules-terminees'
  /** La ronde courante est complète, il reste des rondes à tirer. */
  | 'ronde-suivante'
  | 'tableau-a-saisir'
  /** Tout est joué, il ne reste qu'à figer le palmarès. */
  | 'a-cloturer'
  | 'termine';

/** Ce que l'assistant propose, une fois qu'il a répondu. */
export interface Suite {
  /** Phrase d'accompagnement, telle que l'assistant la dit. */
  phrase: string;
  /** Parcours guidé à proposer. Toujours un identifiant du catalogue. */
  parcours: string;
}

const actives = (etat: EtatParcours): number => etat.teams.filter((t) => !t.forfait).length;
const ouvertes = (ms: Match[]): number => ms.filter((m) => !m.done).length;

/**
 * Classement de l'état du concours. Les branches suivent celles du bandeau
 * « prochaine étape » : mêmes seuils, mêmes cas particuliers.
 */
export function etapeCourante(etat: EtatParcours): EtapeCourante {
  const c = etat.concours;
  if (!c) return 'aucun-concours';
  if (c.status === 'termine') return 'termine';

  const nb = actives(etat);

  if (c.status === 'inscriptions') {
    if (c.mode === 'poules') {
      if (nb < 4) return 'inscriptions-insuffisantes';
      return pouleSizes(nb) ? 'pret-au-tirage' : 'effectif-impossible';
    }
    return nb < 2 ? 'inscriptions-insuffisantes' : 'pret-au-tirage';
  }

  if (c.status === 'poules') {
    const dePoule = etat.matches.filter((m) => m.stage === 'poule');
    if (ouvertes(dePoule) > 0) return 'scores-a-saisir';
    const toutesFinies = etat.poules.every(
      (p) => pouleOutcome(p, dePoule.filter((m) => m.pouleId === p.id)).complete,
    );
    return toutesFinies ? 'poules-terminees' : 'scores-a-saisir';
  }

  if (c.status === 'rondes') {
    const deRonde = etat.matches.filter((m) => m.stage === 'ronde');
    if (ouvertes(deRonde) > 0) return 'scores-a-saisir';
    // Championnat : le calendrier est généré d'un coup, il n'y a rien à tirer.
    const tir = c.mode === 'tir_precision';
    const tirees = tir ? seriesTirees(deRonde) : rondesTirees(deRonde);
    const prevues = c.mode === 'championnat' ? tirees : (c.nbRondes ?? (tir ? 2 : 4));
    return tirees < prevues ? 'ronde-suivante' : 'a-cloturer';
  }

  if (c.status === 'tableau') {
    const duTableau = etat.matches.filter((m) => m.stage !== 'poule');
    const principal = duTableau.filter((m) => m.stage === 'principal');
    const dernierTour = principal.length ? Math.max(...principal.map((m) => m.round)) : 0;
    const finale = principal.find((m) => m.round === dernierTour && m.position === 0);
    return winnerOf(finale) ? 'a-cloturer' : 'tableau-a-saisir';
  }

  return 'termine';
}

/**
 * L'étape suivante, dite comme l'assistant la dirait, avec le parcours qui
 * l'accompagne. Jamais vide : il y a toujours quelque chose de plus utile à
 * proposer qu'une liste de sujets.
 */
export function suiteSuggeree(etat: EtatParcours): Suite {
  const etape = etapeCourante(etat);
  const poules = etat.concours?.mode === 'poules';

  switch (etape) {
    case 'aucun-concours':
      // Formulation vraie dans les deux cas : le tableau de bord peut très bien
      // contenir des concours, aucun n'est simplement ouvert ici.
      return {
        phrase:
          'Je ne suis rattaché à aucun concours pour l\'instant. Ouvrez-en un depuis la ' +
          'liste, ou créons-en un ensemble.',
        parcours: 'creer-concours',
      };
    case 'inscriptions-insuffisantes':
      return {
        phrase: 'Il manque des équipes pour aller plus loin. On les inscrit ?',
        parcours: 'inscrire-equipes',
      };
    case 'effectif-impossible':
      return {
        phrase:
          'Cet effectif ne se répartit pas en poules : il en faut une de plus, ou une de ' +
          'moins. On retouche les inscriptions ?',
        parcours: 'inscrire-equipes',
      };
    case 'pret-au-tirage':
      return poules
        ? { phrase: 'Tout le monde est inscrit — on tire les poules ?', parcours: 'tirer-poules' }
        : { phrase: 'Tout le monde est inscrit — on lance le tableau ?', parcours: 'lancer-tableau' };
    case 'scores-a-saisir':
      return {
        phrase: 'Il reste des parties à saisir. Je vous montre le chemin le plus rapide ?',
        parcours: 'saisir-score',
      };
    case 'poules-terminees':
      return {
        phrase: 'Les poules sont finies : place au tableau. On y va ?',
        parcours: 'lancer-tableau',
      };
    case 'ronde-suivante':
      return {
        phrase: 'La ronde est complète : il reste à tirer la suivante. Je vous accompagne ?',
        parcours: 'saisir-score',
      };
    case 'tableau-a-saisir':
      return {
        phrase: 'Le tableau est en cours. On saisit la prochaine partie ?',
        parcours: 'saisir-score',
      };
    case 'a-cloturer':
      return {
        phrase: 'Tout est joué : clôturez, puis sortez les documents. Je vous montre ?',
        parcours: 'impressions',
      };
    case 'termine':
      return {
        phrase: 'Le concours est terminé. On exporte les résultats ?',
        parcours: 'exporter-resultats',
      };
  }
}

/**
 * Deux ou trois pistes ancrées dans l'état du concours, pour quand la question
 * n'est pas comprise. Mieux vaut demander une précision que dérouler tout le
 * sommaire : à ce moment-là, l'utilisateur cherche encore ses mots.
 */
export function pistesContextuelles(etat: EtatParcours): string[] {
  switch (etapeCourante(etat)) {
    case 'aucun-concours':
      return ['creer-concours', 'feuille-match', 'decouverte'];
    case 'inscriptions-insuffisantes':
    case 'effectif-impossible':
      return ['inscrire-equipes', 'creer-concours'];
    case 'pret-au-tirage':
      return etat.concours?.mode === 'poules'
        ? ['tirer-poules', 'inscrire-equipes']
        : ['lancer-tableau', 'inscrire-equipes'];
    case 'scores-a-saisir':
      return ['saisir-score', 'corriger-score', 'barrage'];
    case 'poules-terminees':
      return ['lancer-tableau', 'consolante', 'corriger-score'];
    case 'ronde-suivante':
      return ['saisir-score', 'corriger-score'];
    case 'tableau-a-saisir':
      return ['saisir-score', 'corriger-score', 'consolante'];
    case 'a-cloturer':
      return ['impressions', 'exporter-resultats', 'affichage-public'];
    case 'termine':
      return ['exporter-resultats', 'impressions'];
  }
}
