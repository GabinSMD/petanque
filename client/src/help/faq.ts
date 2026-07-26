/**
 * Base de connaissances de l'assistant : questions fréquentes avec
 * pas-à-pas. Entièrement hors-ligne — aucun service externe.
 * Les libellés cités correspondent exactement à ceux de l'interface.
 */

export interface FaqAction {
  label: string;
  /** Chemin cible ; `:id` est remplacé par le concours ouvert. */
  path: string;
  /** L'action n'a de sens que dans un concours ouvert. */
  needsConcours?: boolean;
}

export interface FaqEntry {
  id: string;
  category: string;
  question: string;
  keywords: string[];
  intro?: string;
  steps?: string[];
  note?: string;
  action?: FaqAction;
}

export const FAQ: FaqEntry[] = [
  /* ------------------------------ Démarrer ------------------------------ */
  {
    id: 'creer-concours',
    category: 'Démarrer',
    question: 'Comment créer un concours ?',
    keywords: ['creer', 'nouveau', 'concours', 'organiser', 'commencer', 'demarrer'],
    steps: [
      'Sur le tableau de bord, cliquez sur « + Nouveau concours ».',
      'Renseignez le nom, la date et le lieu.',
      'Choisissez la formation : tête-à-tête, doublette ou triplette.',
      'Choisissez la formule : « Poules puis élimination » (la plus courante) ou « Élimination directe ».',
      'Cochez « Consolante » si les éliminés doivent être repêchés dans un second tableau.',
      'Indiquez le nombre de terrains et validez avec « Créer le concours ».',
    ],
    action: { label: 'Aller au tableau de bord', path: '/' },
  },
  {
    id: 'inscrire-equipes',
    category: 'Démarrer',
    question: 'Comment inscrire les équipes ?',
    keywords: ['inscrire', 'inscription', 'equipe', 'joueur', 'ajouter', 'licence', 'club'],
    steps: [
      'Ouvrez le concours puis l\'onglet « Équipes ».',
      'Saisissez le nom de chaque joueur (le n° de licence est facultatif).',
      'Renseignez le club si vous voulez éviter que deux équipes du même club se rencontrent au tirage.',
      'Cliquez sur « Inscrire » : l\'équipe reçoit automatiquement son numéro de dossard.',
      'Répétez pour chaque équipe — le pied de page indique la répartition en poules prévue.',
    ],
    note: 'Les inscriptions se verrouillent après le tirage. Utilisez « Annuler le tirage » pour les rouvrir.',
    action: { label: 'Ouvrir l\'onglet Équipes', path: '/concours/:id/equipes', needsConcours: true },
  },
  {
    id: 'modifier-equipe',
    category: 'Démarrer',
    question: 'Comment modifier ou supprimer une équipe ?',
    keywords: ['modifier', 'supprimer', 'renommer', 'equipe', 'erreur', 'faute', 'orthographe'],
    steps: [
      'Onglet « Équipes », sur la ligne de l\'équipe : cliquez sur ✎ pour corriger les noms, licences ou le club.',
      'Validez avec « OK ».',
      'Pour supprimer : cliquez sur 🗑 (possible uniquement avant le tirage).',
    ],
  },
  {
    id: 'effectif-poules',
    category: 'Démarrer',
    question: 'Combien d\'équipes faut-il pour des poules ?',
    keywords: ['combien', 'effectif', 'nombre', 'equipes', 'poules', 'incompatible', 'cinq', '5'],
    intro:
      'Les poules sont de 4 équipes, complétées par des poules de 3 quand l\'effectif ne tombe pas juste (ex. : 7 → une poule de 4 et une de 3 ; 9 → trois poules de 3).',
    steps: [
      'Effectifs possibles : 4, puis 6 et plus (5 équipes ne se répartissent pas).',
      'Le pied de l\'onglet « Équipes » affiche en direct la répartition prévue.',
      'Si l\'effectif est incompatible, inscrivez une équipe de plus ou passez en élimination directe (⚙ Paramètres).',
    ],
  },

  /* ------------------------------- Poules ------------------------------- */
  {
    id: 'tirer-poules',
    category: 'Poules',
    question: 'Comment tirer les poules ?',
    keywords: ['tirage', 'tirer', 'poules', 'sort', 'aleatoire', 'generer'],
    steps: [
      'Ouvrez l\'onglet « Poules ».',
      'Cochez si besoin « Éviter deux équipes du même club dans une poule ».',
      'Cliquez sur « 🎲 Tirer les poules ».',
      'Chaque poule reçoit un terrain par défaut pour ses premières parties — modifiable sur chaque partie.',
    ],
    note: 'Un tirage peut être annulé tant que le concours n\'est pas terminé : bouton « Annuler le tirage » (les scores de poules sont alors effacés).',
    action: { label: 'Ouvrir l\'onglet Poules', path: '/concours/:id/poules', needsConcours: true },
  },
  {
    id: 'deroulement-poule',
    category: 'Poules',
    question: 'Comment se déroule une poule (barrage, qualifiés) ?',
    keywords: ['deroulement', 'barrage', 'qualifie', 'gagnants', 'perdants', 'poule', 'fonctionne'],
    intro: 'Le déroulement est celui de la FFPJP :',
    steps: [
      'Poule de 4 : deux premières parties tirées au sort, puis partie des gagnants et partie des perdants.',
      'Le vainqueur des gagnants (2 victoires) est qualifié 1er de poule.',
      'Le perdant des perdants (2 défaites) est éliminé.',
      'Barrage : perdant des gagnants contre vainqueur des perdants — le vainqueur est qualifié 2e.',
      'Poule de 3 : la 3e équipe est exempte de la 1ère partie et rencontre son vainqueur ; le barrage oppose les deux perdants.',
    ],
    note: 'L\'application enchaîne tout automatiquement : dès qu\'un score est saisi, la partie suivante se remplit.',
  },
  {
    id: 'saisir-score',
    category: 'Scores',
    question: 'Comment saisir un score ?',
    keywords: ['saisir', 'score', 'resultat', 'points', 'valider', 'entrer', 'marquer'],
    steps: [
      'Trouvez la partie (onglet « Poules » ou « Tableau »).',
      'Saisissez les points de chaque équipe dans les deux cases (le gagnant doit être à 13, ou au total choisi dans les paramètres).',
      'Cliquez sur « OK » : le vainqueur avance automatiquement (partie suivante, tableau…).',
    ],
    note: 'Pas de match nul en pétanque : l\'application refuse un score invalide et vous l\'explique.',
  },
  {
    id: 'corriger-score',
    category: 'Scores',
    question: 'Comment corriger ou effacer un score ?',
    keywords: ['corriger', 'correction', 'effacer', 'erreur', 'score', 'tromper', 'modifier', 'annuler'],
    steps: [
      'Sur la partie concernée, cliquez sur ✎ (« Corriger le score »).',
      'Saisissez le bon score puis « OK » — ou cliquez sur 🗑 pour effacer complètement.',
      'Tout ce qui dépendait de cette partie (partie des gagnants, barrage, tour suivant du tableau…) est réinitialisé automatiquement et proprement.',
    ],
    note: 'Après génération du tableau, les scores de poules sont verrouillés : annulez d\'abord le tableau (onglet « Tableau ») pour les corriger.',
  },
  {
    id: 'forfait',
    category: 'Scores',
    question: 'Comment gérer un forfait ?',
    keywords: ['forfait', 'absent', 'abandonne', 'pas la', 'retard', 'ff'],
    steps: [
      'Avant le tirage : onglet « Équipes », bouton « FF » sur la ligne de l\'équipe — elle sera exclue du tirage.',
      'Pendant le concours : marquez aussi « FF » pour l\'indiquer visuellement, puis saisissez 13 à 0 en faveur de l\'équipe présente sur la partie concernée.',
    ],
  },
  {
    id: 'terrains',
    category: 'Poules',
    question: 'Comment affecter les terrains ?',
    keywords: ['terrain', 'affecter', 'attribuer', 'numero', 'jeu'],
    steps: [
      'Au tirage, les premières parties de chaque poule reçoivent un terrain automatiquement.',
      'Chaque partie possède une petite case « T » : saisissez-y le numéro de terrain.',
      'Le terrain de référence d\'une poule se règle dans l\'en-tête de sa carte.',
    ],
  },

  /* ------------------------------ Tableau ------------------------------- */
  {
    id: 'generer-tableau',
    category: 'Tableau',
    question: 'Comment générer le tableau final ?',
    keywords: ['generer', 'tableau', 'final', 'phase', 'finale', 'qualifies'],
    steps: [
      'Terminez toutes les poules (le compteur « Poules terminées » doit être complet).',
      'Cliquez sur « Générer le tableau → » (onglet « Poules » ou « Tableau »).',
      'Le tableau applique les règles d\'usage : exempts en priorité aux 1ers de poule, 1er contre 2e d\'une autre poule, 1er et 2e d\'une même poule dans des moitiés opposées.',
      'Si l\'effectif n\'est pas une puissance de 2, un tour de cadrage est créé automatiquement.',
    ],
    action: { label: 'Ouvrir l\'onglet Tableau', path: '/concours/:id/tableau', needsConcours: true },
  },
  {
    id: 'cadrage-exempt',
    category: 'Tableau',
    question: 'C\'est quoi le cadrage et les exempts ?',
    keywords: ['cadrage', 'exempt', 'bye', 'puissance', 'pourquoi', 'joue pas'],
    intro:
      'Quand le nombre de qualifiés n\'est pas une puissance de 2 (8, 16, 32…), on joue un tour de cadrage : juste assez de parties pour retomber sur un tableau complet.',
    steps: [
      'Les équipes « exemptes » passent directement au tour suivant sans jouer.',
      'Les exempts sont attribués en priorité aux premiers de poule.',
      'Exemple : 10 qualifiés → 2 parties de cadrage, 6 exempts, puis quarts de finale à 8.',
    ],
  },
  {
    id: 'consolante',
    category: 'Tableau',
    question: 'Comment fonctionne la consolante ?',
    keywords: ['consolante', 'repechage', 'elimines', 'perdants', 'deuxieme', 'tableau b'],
    intro: 'La consolante offre un second tableau aux éliminés :',
    steps: [
      'Activez « Consolante » à la création du concours (ou dans ⚙ Paramètres avant le tableau).',
      'Formule poules : les éliminés des poules entrent en consolante, générée en même temps que le tableau principal.',
      'Élimination directe : les perdants du 1er tour y entrent au fil des résultats (places « Perdant P1, P2… »).',
      'Dans l\'onglet « Tableau », basculez entre « Concours principal » et « Consolante ».',
    ],
  },
  {
    id: 'elimination-directe',
    category: 'Tableau',
    question: 'Comment faire un concours en élimination directe ?',
    keywords: ['elimination', 'directe', 'sans poule', 'coupe', 'knockout'],
    steps: [
      'À la création du concours, choisissez la formule « Élimination directe ».',
      'Inscrivez les équipes (2 minimum), puis onglet « Tableau » → « 🎲 Tirer le tableau ».',
      'L\'option « éviter deux équipes du même club au premier tour » est disponible au tirage.',
    ],
  },
  {
    id: 'cloturer',
    category: 'Tableau',
    question: 'Comment clôturer ou rouvrir un concours ?',
    keywords: ['cloturer', 'terminer', 'finir', 'rouvrir', 'fin', 'palmares'],
    steps: [
      'Quand la finale est jouée, un bandeau « 🏆 Vainqueur » apparaît dans l\'onglet « Tableau ».',
      'Cliquez sur « Clôturer le concours » : les saisies sont verrouillées et le concours passe en « Terminé ».',
      'Besoin d\'une correction ? « Rouvrir le concours » au même endroit.',
    ],
  },

  /* ------------------------- Affichage & partage ------------------------ */
  {
    id: 'affichage-tv',
    category: 'Affichage',
    question: 'Comment afficher les résultats sur une TV ?',
    keywords: ['affichage', 'tv', 'ecran', 'videoprojecteur', 'public', 'projeter', 'television'],
    steps: [
      'Dans le concours, cliquez sur « 📺 Affichage » (ouvre un nouvel onglet).',
      'Mettez cet onglet en plein écran (bouton « ⛶ Plein écran ») sur la TV ou le vidéoprojecteur.',
      'La page se met à jour toute seule à chaque saisie : poules, tableaux, vainqueur.',
    ],
    action: { label: 'Ouvrir l\'affichage', path: '/concours/:id/affichage', needsConcours: true },
  },
  {
    id: 'imprimer',
    category: 'Affichage',
    question: 'Comment imprimer les feuilles et les tableaux ?',
    keywords: ['imprimer', 'impression', 'papier', 'feuille', 'pdf'],
    steps: [
      'Affichez l\'onglet à imprimer (Équipes, Poules, Tableau ou Résultats).',
      'Cliquez sur « 🖨 Imprimer » : la mise en page d\'impression retire boutons et menus.',
      'Astuce : choisissez « Enregistrer en PDF » dans la boîte d\'impression pour un fichier.',
    ],
  },

  /* --------------------------- Hors ligne & SaaS ------------------------ */
  {
    id: 'hors-ligne',
    category: 'Hors ligne',
    question: 'Comment ça marche sans connexion ?',
    keywords: ['hors ligne', 'offline', 'connexion', 'internet', 'reseau', 'coupure', '4g', 'wifi'],
    intro:
      'L\'application est « local-first » : elle lit et écrit d\'abord sur votre appareil. Le réseau ne sert qu\'à synchroniser.',
    steps: [
      'Connectez-vous une première fois avec du réseau (au club, à la maison).',
      'Au boulodrome, même sans réseau : tirages, scores, tableaux, affichage TV — tout fonctionne.',
      'Le badge en haut passe en « Hors ligne » et compte les modifications en attente.',
      'Au retour du réseau, tout s\'envoie automatiquement (ou cliquez sur le badge pour forcer).',
    ],
    note: 'Installez l\'application (menu du navigateur → « Installer ») pour la retrouver même après un redémarrage de la tablette.',
  },
  {
    id: 'multi-appareils',
    category: 'Hors ligne',
    question: 'Peut-on utiliser plusieurs appareils en même temps ?',
    keywords: ['plusieurs', 'appareils', 'tablette', 'telephone', 'ordinateur', 'equipe', 'table de marque', 'simultane'],
    steps: [
      'Connectez chaque appareil avec le même compte club.',
      'Chaque appareil garde une copie locale complète et pousse ses saisies.',
      'En cas de double saisie sur la même partie, la plus récente l\'emporte (résolution automatique).',
    ],
    note: 'Astuce : un appareil à la table de marque pour les scores, un autre branché à la TV en mode Affichage.',
  },
  {
    id: 'badge-sync',
    category: 'Hors ligne',
    question: 'Que signifie le badge de synchronisation ?',
    keywords: ['badge', 'synchronisation', 'synchronise', 'attente', 'erreur', 'reseau', 'orange', 'vert'],
    steps: [
      '« Synchronisé » : tout est sauvegardé sur le serveur.',
      '« Hors ligne » : pas de réseau — vos saisies restent sur l\'appareil, le chiffre indique les modifications en attente.',
      '« Session expirée » : cliquez pour vous reconnecter (vos données locales sont conservées).',
      'Un clic sur le badge force une synchronisation immédiate.',
    ],
  },
  {
    id: 'parametres',
    category: 'Démarrer',
    question: 'Comment changer les points (13), terrains ou la consolante ?',
    keywords: ['parametres', 'points', '13', '11', 'terrains', 'reglages', 'changer', 'configuration'],
    steps: [
      'Dans le concours, cliquez sur « ⚙ Paramètres ».',
      'Modifiez nom, date, lieu, nombre de terrains, « Parties en » (13, 11…).',
      'La formation, la formule et la consolante ne se changent plus après le tirage.',
    ],
  },
  {
    id: 'supprimer-concours',
    category: 'Démarrer',
    question: 'Comment supprimer un concours ?',
    keywords: ['supprimer', 'effacer', 'concours', 'poubelle', 'retirer'],
    steps: [
      'Sur le tableau de bord, cliquez sur 🗑 en haut de la carte du concours.',
      'Confirmez : le concours et toutes ses données sont supprimés (partout, après synchronisation).',
    ],
  },
  {
    id: 'tutoriel',
    category: 'Démarrer',
    question: 'Revoir le tutoriel (visite guidée)',
    keywords: ['tutoriel', 'visite', 'guide', 'apprendre', 'decouvrir', 'demonstration', 'demo', 'aide'],
    intro: 'Deux façons de (re)découvrir l\'application :',
    steps: [
      'Cliquez sur « 🎓 Relancer la visite guidée » ci-dessous.',
      'Ou créez un « concours d\'exemple » pré-rempli depuis l\'écran de bienvenue pour vous entraîner sans risque.',
    ],
  },
];

/** Suggestions mises en avant à l'ouverture de l'assistant. */
export const FEATURED_IDS = [
  'creer-concours',
  'tirer-poules',
  'saisir-score',
  'corriger-score',
  'consolante',
  'hors-ligne',
];
