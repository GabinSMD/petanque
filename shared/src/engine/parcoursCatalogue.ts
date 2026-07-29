/**
 * Les parcours guidés, un par cas d'usage.
 *
 * Deux règles de composition, tirées de ce qui casse en pratique :
 *
 * 1. **On ne surligne que du mobilier stable** — onglets, boutons d'action,
 *    panneaux. Jamais une ligne de liste ou une carte de partie : elles
 *    apparaissent, disparaissent et se réordonnent. Quand le geste se passe
 *    dans une liste, l'étape est une carte centrée (`cible: null`) doublée d'un
 *    jalon : on dit quoi faire, et on constate que c'est fait.
 * 2. **Un jalon regarde les données, pas l'écran.** L'utilisateur qui saisit son
 *    score par un autre chemin que celui suggéré fait avancer le parcours
 *    quand même — c'est lui qui mène.
 *
 * Les sélecteurs sont vérifiés par un test : ils doivent tous exister dans le
 * client (voir `parcoursCatalogue.test.ts`).
 */
import type { EtatParcours, Parcours } from './parcours';

const actives = (e: EtatParcours): number => e.teams.filter((t) => !t.forfait).length;
const dePoule = (e: EtatParcours) => e.matches.filter((m) => m.stage === 'poule');
const duTableau = (e: EtatParcours) =>
  e.matches.filter((m) => m.stage === 'principal' || m.stage === 'complementaire');
const saisis = (e: EtatParcours) => e.matches.filter((m) => m.done);

/** Créer son premier concours, depuis le tableau de bord. */
export const parcoursCreerConcours: Parcours = {
  id: 'creer-concours',
  retour: '/',
  titre: 'Créer un concours',
  etapes: [
    {
      cible: null,
      titre: 'On crée votre concours ensemble',
      texte:
        'Trois écrans : la formule, la formation, puis les détails. Je reste avec vous ' +
        'à chaque étape — c\'est vous qui cliquez.',
      route: '/',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="new-concours"]',
      titre: 'Cliquez sur « + Nouveau concours »',
      texte: 'L\'assistant de création s\'ouvre. Rien n\'est enregistré avant votre validation.',
      declencheur: { type: 'clic' },
    },
    {
      cible: null,
      titre: 'À vous : remplissez et validez',
      texte:
        'Choisissez la formule (chaque carte dit à qui elle s\'adresse), la formation, ' +
        'puis ajustez date, lieu et terrains. Terminez par « Créer le concours 🎉 » — ' +
        'je vous retrouve dedans.',
      declencheur: { type: 'jalon', atteint: (e) => e.concours !== null },
    },
    {
      cible: '[data-tour="next-step"]',
      titre: 'Votre concours existe ✓',
      texte:
        'Ce bandeau vous dira toujours quoi faire ensuite. La suite, c\'est d\'inscrire ' +
        'les équipes.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Inscrire les équipes. */
export const parcoursInscrireEquipes: Parcours = {
  id: 'inscrire-equipes',
  retour: '/concours/:id/equipes',
  titre: 'Inscrire les équipes',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="tab-equipes"]',
      titre: 'Ouvrez l\'onglet « Équipes »',
      texte: 'C\'est là que se font toutes les inscriptions.',
      declencheur: { type: 'clic' },
    },
    {
      cible: '[data-tour="inscrire"]',
      titre: 'Saisissez la première équipe',
      texte:
        'Tapez les noms des joueurs (l\'autocomplétion propose vos licenciés), puis ' +
        '« Inscrire ». Le numéro de dossard est attribué tout seul.',
      declencheur: { type: 'jalon', atteint: (e) => actives(e) >= 1 },
    },
    {
      cible: '[data-tour="inscrire"]',
      titre: 'Continuez : il en faut au moins deux',
      texte:
        'Enchaînez les équipes — le formulaire reste prêt pour la suivante. Vous ' +
        'pourrez toujours en ajouter, en retirer, ou déclarer un forfait ensuite.',
      declencheur: { type: 'jalon', atteint: (e) => actives(e) >= 2 },
    },
    {
      cible: '[data-tour="next-step"]',
      titre: 'Vos équipes sont inscrites ✓',
      texte:
        'Ce bandeau vous dira toujours quoi faire ensuite. Quand tout le monde est là, ' +
        'passez au tirage.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Tirer les poules. */
export const parcoursTirerPoules: Parcours = {
  id: 'tirer-poules',
  retour: '/concours/:id/poules',
  titre: 'Tirer les poules',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="tab-poules"]',
      titre: 'Ouvrez l\'onglet « Poules »',
      texte: 'Le tirage se prépare ici.',
      declencheur: { type: 'clic' },
    },
    {
      cible: '[data-tour="tirer-poules"]',
      titre: 'Cliquez sur « 🎲 Tirer les poules »',
      texte:
        'La répartition suit le manuel fédéral : poules de 4, et de 3 avec barrage quand ' +
        'le compte ne tombe pas juste. Au-dessus, vous pouvez protéger des équipes pour ' +
        'les séparer au tirage.',
      declencheur: { type: 'jalon', atteint: (e) => e.poules.length > 0 },
    },
    {
      cible: null,
      titre: 'Les poules sont tirées ✓',
      texte:
        'Chaque poule affiche ses deux premières parties, avec son terrain. Le tirage ' +
        'reste annulable tant qu\'aucun score n\'est saisi. On passe aux scores ?',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Saisir un score. */
export const parcoursSaisirScore: Parcours = {
  id: 'saisir-score',
  retour: '/concours/:id/poules',
  titre: 'Saisir un score',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="quick-score"]',
      titre: 'Le plus rapide : la saisie par numéro',
      texte:
        'Tapez le numéro d\'une équipe : sa partie en cours apparaît, vous n\'avez plus ' +
        'qu\'à entrer le score. C\'est la barre à utiliser le jour du concours.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: null,
      titre: 'À vous : saisissez une première partie',
      texte:
        'Par la barre ci-dessus, ou directement sur la partie dans l\'onglet Poules. ' +
        'Les deux marchent — je constate le résultat, peu importe le chemin.',
      declencheur: { type: 'jalon', atteint: (e) => saisis(e).length >= 1 },
    },
    {
      cible: '[data-tour="next-step"]',
      titre: 'Score enregistré ✓',
      texte:
        'Le classement de la poule s\'est mis à jour, et la partie suivante s\'est ' +
        'ouverte toute seule quand elle était jouable.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Corriger un score déjà saisi. */
export const parcoursCorrigerScore: Parcours = {
  id: 'corriger-score',
  retour: '/concours/:id/poules',
  titre: 'Corriger un score',
  besoinConcours: true,
  etapes: [
    {
      cible: null,
      titre: 'Un score se corrige à tout moment',
      texte:
        'Rien n\'est figé. Cliquez sur la partie déjà saisie — dans la poule ou dans le ' +
        'tableau — et modifiez le score.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: null,
      titre: 'Ce que la correction entraîne',
      texte:
        'Si l\'équipe corrigée était déjà passée au tour suivant, la correction se ' +
        'répercute en cascade : les parties construites sur ce résultat suivent. Vous ' +
        'n\'avez rien à défaire à la main.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="tab-poules"]',
      titre: 'À vous d\'essayer',
      texte:
        'Ouvrez une partie déjà jouée et changez son score : vous verrez le classement ' +
        'bouger aussitôt. Vous pouvez aussi l\'effacer pour la remettre à jouer.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Gérer un barrage de poule. */
export const parcoursBarrage: Parcours = {
  id: 'barrage',
  retour: '/concours/:id/poules',
  titre: 'Gérer un barrage',
  besoinConcours: true,
  etapes: [
    {
      cible: null,
      titre: 'Le barrage, c\'est la poule de 3',
      texte:
        'Dans une poule de 3, deux équipes finissent à une victoire chacune : elles se ' +
        'départagent au barrage. L\'application le crée toute seule, vous n\'avez rien à ' +
        'déclencher.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="tab-poules"]',
      titre: 'Ouvrez l\'onglet « Poules »',
      texte:
        'Le barrage apparaît dans sa poule, sous les deux premières parties, dès que ses ' +
        'deux équipes sont connues.',
      declencheur: { type: 'clic' },
    },
    {
      cible: null,
      titre: 'À vous : saisissez le barrage',
      texte:
        'Même geste qu\'une partie ordinaire. Son vainqueur prend la deuxième place ' +
        'qualificative de la poule.',
      declencheur: {
        type: 'jalon',
        atteint: (e) => dePoule(e).some((m) => m.pouleSlot === 'BARRAGE' && m.done),
      },
    },
    {
      cible: null,
      titre: 'Barrage joué ✓',
      texte:
        'La poule est complète. Si vous vous êtes trompé, le score du barrage se corrige ' +
        'comme n\'importe quel autre — la qualification suit.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Lancer le tableau final. */
export const parcoursLancerTableau: Parcours = {
  id: 'lancer-tableau',
  retour: '/concours/:id/tableau',
  titre: 'Lancer le tableau final',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="tab-tableau"]',
      titre: 'Ouvrez l\'onglet « Tableau »',
      texte:
        'Le tableau se remplit au fil des poules : les qualifiés y entrent sans attendre ' +
        'la poule la plus lente.',
      declencheur: { type: 'clic' },
    },
    {
      cible: null,
      titre: 'À vous : lancez le tableau',
      texte:
        'En élimination directe, c\'est « 🎲 Tirer le tableau ». Après des poules, le ' +
        'bouton apparaît dès que les qualifiés sont connus. Le cadrage est calculé pour ' +
        'vous quand le compte n\'est pas une puissance de deux.',
      declencheur: { type: 'jalon', atteint: (e) => duTableau(e).length > 0 },
    },
    {
      cible: null,
      titre: 'Le tableau est en place ✓',
      texte:
        'Les parties se saisissent comme celles des poules, et les vainqueurs montent ' +
        'automatiquement au tour suivant.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** La consolante. */
export const parcoursConsolante: Parcours = {
  id: 'consolante',
  retour: '/concours/:id/tableau',
  titre: 'Faire rejouer les perdants (consolante)',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="params"]',
      titre: 'La consolante est une option du concours',
      texte:
        'Elle se règle dans les paramètres, à la création ou en cours de route. Activée, ' +
        'elle fait rejouer les perdants du premier tour du tableau.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="tab-tableau"]',
      titre: 'Elle vit dans l\'onglet « Tableau »',
      texte:
        'La consolante s\'affiche sous le tableau principal et s\'alimente toute seule : ' +
        'chaque perdant du premier tour y prend sa place.',
      declencheur: { type: 'clic' },
    },
    {
      cible: null,
      titre: 'À vous : faites-la démarrer',
      texte:
        'Saisissez les parties du premier tour du tableau principal — la consolante se ' +
        'remplit à mesure. Elle se joue ensuite exactement comme le tableau.',
      declencheur: {
        type: 'jalon',
        atteint: (e) => e.matches.some((m) => m.stage === 'consolante'),
      },
    },
    {
      cible: null,
      titre: 'La consolante est lancée ✓',
      texte:
        'Personne ne rentre chez lui après une seule partie. Si les paramètres le ' +
        'prévoient, une complémentaire repêche même les perdants de la consolante.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Publier l'affichage public. */
export const parcoursAffichagePublic: Parcours = {
  id: 'affichage-public',
  retour: '/concours/:id',
  titre: 'Publier les résultats en direct',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="affichage"]',
      titre: 'L\'écran d\'affichage, pour la TV du boulodrome',
      texte:
        'Il s\'ouvre en grand format et se met à jour en direct : poules, tableaux, ' +
        'résultats. Branchez-le sur un téléviseur ou un vidéoprojecteur.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="share"]',
      titre: 'Cliquez sur « 🔗 Partager »',
      texte:
        'Vous obtenez un lien public et un QR code à afficher. Les joueurs suivent le ' +
        'concours sur leur téléphone, sans compte — et le lien est révocable.',
      declencheur: { type: 'clic' },
    },
    {
      cible: null,
      titre: 'Deux parcours pour les joueurs',
      texte:
        '« Je joue » : l\'équipe saisit son numéro, ne voit que sa partie et reçoit ses ' +
        'convocations. « Je consulte » : tout le concours en lecture. Fermez cette ' +
        'fenêtre quand vous avez noté le lien.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Imprimer les documents officiels. */
export const parcoursImpressions: Parcours = {
  id: 'impressions',
  retour: '/concours/:id/resultats',
  titre: 'Imprimer les documents officiels',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="tab-resultats"]',
      titre: 'Ouvrez l\'onglet « Résultats »',
      texte: 'Les documents à imprimer et à exporter y sont rassemblés.',
      declencheur: { type: 'clic' },
    },
    {
      cible: '[data-tour="exporter"]',
      titre: 'La barre des documents',
      texte:
        'Feuille d\'arbitrage pour le comité, résultats pour la presse, graphique du ' +
        'tableau à afficher, liste des inscrits, absents. Les documents fédéraux ' +
        'n\'apparaissent qu\'en mode fédéral.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="imprimer"]',
      titre: 'Et l\'impression de l\'écran courant',
      texte:
        'Ce bouton imprime ce que vous avez sous les yeux — poules, tableau — mis en page ' +
        'pour le papier. À vous de jouer.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Remplir une feuille de match (championnat des clubs). */
export const parcoursFeuilleMatch: Parcours = {
  id: 'feuille-match',
  retour: '/championnat-clubs',
  titre: 'Remplir une feuille de match',
  etapes: [
    {
      cible: null,
      titre: 'La feuille de match, sans papier',
      texte:
        'Pour le championnat des clubs et la Coupe de France : compositions, résultats ' +
        'des rencontres, signature des deux capitaines.',
      route: '/championnat-clubs',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="nouvelle-feuille"]',
      titre: 'Créez la feuille de la rencontre',
      texte:
        'Renseignez les deux clubs et la date. La feuille est une entité synchronisée : ' +
        'elle suit sur les autres appareils du club.',
      declencheur: { type: 'clic' },
    },
    {
      cible: null,
      titre: 'À vous : remplissez, puis faites signer',
      texte:
        'Composez les équipes, saisissez les résultats. Les deux clubs peuvent échanger ' +
        'leurs compositions par QR code, sans réseau. Terminez par les signatures, puis ' +
        'imprimez ou exportez la feuille en fichier.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Exporter les résultats. */
export const parcoursExporterResultats: Parcours = {
  id: 'exporter-resultats',
  retour: '/concours/:id/resultats',
  titre: 'Exporter les résultats',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="tab-resultats"]',
      titre: 'Ouvrez l\'onglet « Résultats »',
      texte: 'Le palmarès et les exports sont ici.',
      declencheur: { type: 'clic' },
    },
    {
      cible: '[data-tour="exporter"]',
      titre: 'Choisissez votre export',
      texte:
        'Classement et engagés en CSV pour un tableur, qualifiés à réutiliser comme ' +
        'inscriptions d\'une phase finale, arbitrage en CSV pour la saisie fédérale.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="exporter"]',
      titre: 'Et la sauvegarde complète',
      texte:
        '« 💾 Sauvegarde (JSON) » enregistre tout le concours dans un fichier ' +
        'réimportable depuis le tableau de bord. C\'est le filet de sécurité à prendre ' +
        'avant de ranger le concours.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Découverte générale, au premier lancement : on regarde, on ne fait pas. */
export const parcoursDecouverte: Parcours = {
  id: 'decouverte',
  retour: '/',
  titre: 'Découvrir l\'application',
  etapes: [
    {
      cible: null,
      titre: 'Bienvenue sur Pétanque Concours 👋',
      texte:
        'En quelques écrans, de quoi organiser un concours de A à Z. Vous pourrez ' +
        'relancer cette visite à tout moment depuis l\'assistant (bulle en bas à droite).',
      route: '/',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="new-concours"]',
      titre: 'Créer un concours',
      texte:
        'Tout part d\'ici : nom, date, formation (tête-à-tête, doublette, triplette) et ' +
        'formule (poules puis élimination, ou élimination directe).',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="sync"]',
      titre: 'Synchronisation & hors ligne',
      texte:
        'Ce badge indique l\'état de synchronisation. Sans réseau, tout continue de ' +
        'fonctionner : vos saisies restent sur l\'appareil et partent au retour de la ' +
        'connexion.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="help"]',
      titre: 'L\'assistant vous accompagne',
      texte:
        'Une question ? Ouvrez l\'assistant : il connaît les gestes courants et sait vous ' +
        'guider pas à pas, en vous laissant faire.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Visite d'un concours ouvert : présentation des écrans. */
export const parcoursVisiteConcours: Parcours = {
  id: 'visite-concours',
  retour: '/concours/:id',
  titre: 'Visiter un concours',
  besoinConcours: true,
  etapes: [
    {
      cible: '[data-tour="next-step"]',
      titre: 'Votre prochaine étape',
      texte:
        'Ce bandeau dit toujours où vous en êtes et quoi faire ensuite : inscriptions, ' +
        'tirage, saisie des scores, tableau…',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="tabs"]',
      titre: 'Les étapes du concours',
      texte:
        'Équipes pour les inscriptions, Poules pour le tirage et les scores, Tableau pour ' +
        'la phase finale (et la consolante), Résultats pour le palmarès.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="affichage"]',
      titre: 'Affichage public',
      texte:
        'À ouvrir sur une TV ou un vidéoprojecteur : poules, tableaux et résultats s\'y ' +
        'mettent à jour en direct, en grand format.',
      declencheur: { type: 'lecture' },
    },
    {
      cible: '[data-tour="params"]',
      titre: 'Paramètres',
      texte:
        'Nom, date, terrains, points par partie (13 par défaut), consolante : tout se ' +
        'règle ici.',
      declencheur: { type: 'lecture' },
    },
  ],
};

/** Tous les parcours, dans l'ordre d'un concours. */
export const PARCOURS: Parcours[] = [
  parcoursDecouverte,
  parcoursCreerConcours,
  parcoursVisiteConcours,
  parcoursInscrireEquipes,
  parcoursTirerPoules,
  parcoursSaisirScore,
  parcoursCorrigerScore,
  parcoursBarrage,
  parcoursLancerTableau,
  parcoursConsolante,
  parcoursAffichagePublic,
  parcoursImpressions,
  parcoursExporterResultats,
  parcoursFeuilleMatch,
];

export function parcoursParId(id: string): Parcours | undefined {
  return PARCOURS.find((p) => p.id === id);
}
