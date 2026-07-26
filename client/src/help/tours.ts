import type { TourStep } from './tourState';

/** Visite guidée du tableau de bord (première connexion). */
export const dashboardTour: TourStep[] = [
  {
    target: null,
    title: 'Bienvenue sur Pétanque Concours 👋',
    text:
      'En quelques écrans, voici comment organiser un concours de A à Z. ' +
      'Vous pourrez relancer cette visite à tout moment depuis l\'assistant (bulle en bas à droite).',
  },
  {
    target: '[data-tour="new-concours"]',
    title: 'Créer un concours',
    text:
      'Tout part d\'ici : nom, date, formation (tête-à-tête, doublette, triplette) ' +
      'et formule (poules puis élimination, ou élimination directe).',
  },
  {
    target: '[data-tour="sync"]',
    title: 'Synchronisation & hors ligne',
    text:
      'Ce badge indique l\'état de synchronisation. Sans réseau, tout continue de ' +
      'fonctionner : vos saisies sont conservées sur l\'appareil et envoyées ' +
      'automatiquement au retour de la connexion.',
  },
  {
    target: '[data-tour="help"]',
    title: 'L\'assistant est là pour vous',
    text:
      'Une question ? Ouvrez l\'assistant : il connaît les gestes courants ' +
      '(tirer les poules, corriger un score, consolante…) et vous guide pas à pas.',
  },
];

/** Visite guidée d'une page concours. */
export const concoursTour: TourStep[] = [
  {
    target: '[data-tour="next-step"]',
    title: 'Votre prochaine étape',
    text:
      'Ce bandeau vous dit toujours où vous en êtes et quoi faire ensuite : ' +
      'inscriptions, tirage, saisie des scores, tableau…',
  },
  {
    target: '[data-tour="tabs"]',
    title: 'Les étapes du concours',
    text:
      'Équipes pour les inscriptions, Poules pour le tirage et les scores, ' +
      'Tableau pour la phase finale (et la consolante), Résultats pour le palmarès.',
  },
  {
    target: '[data-tour="affichage"]',
    title: 'Affichage public',
    text:
      'Ouvrez cet écran sur une TV ou un vidéoprojecteur : poules, tableaux et ' +
      'résultats s\'y mettent à jour en direct, en grand format.',
  },
  {
    target: '[data-tour="params"]',
    title: 'Paramètres',
    text:
      'Nom, date, terrains, points par partie (13 par défaut), consolante : ' +
      'tout se règle ici.',
  },
];
