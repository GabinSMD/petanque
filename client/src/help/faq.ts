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
  /**
   * Parcours guidé qui fait *faire* ce que les `steps` décrivent (identifiant du
   * catalogue partagé). L'assistant propose alors « Me guider pas à pas ».
   */
  parcours?: string;
}

export const FAQ: FaqEntry[] = [
  /* ------------------------------ Démarrer ------------------------------ */
  {
    id: 'creer-concours',
    parcours: 'creer-concours',
    category: 'Démarrer',
    question: 'Comment créer un concours ?',
    keywords: ['creer', 'nouveau', 'concours', 'organiser', 'commencer', 'demarrer'],
    intro: 'La création se fait en 3 étapes guidées :',
    steps: [
      'Sur le tableau de bord, cliquez sur « + Nouveau concours ».',
      'Étape 1 — choisissez la formule : chaque carte explique en une phrase à qui elle s\'adresse (poules, élimination directe, mêlée, suisse, championnat).',
      'Étape 2 — choisissez la formation : tête-à-tête, doublette ou triplette.',
      'Étape 3 — le nom est proposé automatiquement ; ajustez date, lieu, terrains, points, rondes ou consolante selon la formule.',
      'Validez avec « Créer le concours 🎉 ».',
    ],
    action: { label: 'Aller au tableau de bord', path: '/' },
  },
  {
    id: 'choisir-formule',
    category: 'Formules',
    question: 'Quelle formule choisir ?',
    keywords: ['formule', 'choisir', 'quelle', 'mode', 'type', 'difference', 'conseil', 'laquelle'],
    intro: 'Un repère rapide :',
    steps: [
      '🎯 Poules puis élimination : le classique des concours officiels — équitable, 2 à 5 parties par équipe.',
      '⚡ Élimination directe : le plus rapide — qui perd sort (ajoutez la consolante pour faire rejouer les perdants du 1er tour).',
      '🎲 Mêlée tournante : convivial en club — chacun s\'inscrit seul, les équipes changent à chaque ronde, classement individuel.',
      '⚖️ Système suisse : personne n\'est éliminé, tout le monde joue le même nombre de parties (souvent 4 ou 5).',
      '🏅 Championnat : chacun rencontre chacun — parfait jusqu\'à 8 équipes environ.',
    ],
  },
  {
    id: 'melee',
    category: 'Formules',
    question: 'Comment organiser une mêlée ?',
    keywords: ['melee', 'tournante', 'individuel', 'tire au sort', 'panachee', 'amis'],
    intro:
      'En mêlée, on s\'inscrit seul : les équipes sont tirées au sort à chaque ronde et le classement est individuel (victoires puis goal-average).',
    steps: [
      'Créez un concours en choisissant « Mêlée tournante », puis la taille des équipes tirées (doublettes en général).',
      'Onglet « Participants » : inscrivez chaque joueur individuellement.',
      'Onglet « Rondes » : « 🎲 Tirer la ronde 1 » — les équipes s\'affichent, saisissez les scores.',
      'Quand la ronde est complète, tirez la suivante : nouvelles équipes tirées au sort.',
      'Le classement individuel se met à jour en direct ; clôturez après la dernière ronde.',
    ],
    note:
      'Si l\'effectif ne tombe pas juste, l\'application forme des équipes inégales comme à la vraie mêlée (une triplette peut rencontrer une doublette) : personne n\'est exempt.',
  },
  {
    id: 'suisse',
    category: 'Formules',
    question: 'Comment fonctionne le système suisse ?',
    keywords: ['suisse', 'systeme', 'rondes', 'appariement', 'classement', 'buchholz'],
    steps: [
      'Créez un concours « Système suisse » et choisissez le nombre de rondes (4 ou 5 en général).',
      'Ronde 1 : tirage aléatoire. Ensuite, les équipes de même niveau se rencontrent (1er contre 2e, etc.), sans revanche.',
      'Effectif impair : l\'équipe la moins bien classée n\'ayant pas encore été exempte gagne d\'office 13 à 7.',
      'Le classement se met à jour à chaque saisie : victoires, puis goal-average, puis confrontation directe entre équipes à égalité.',
    ],
  },
  {
    id: 'championnat',
    category: 'Formules',
    question: 'Comment faire un championnat (toutes rondes) ?',
    keywords: ['championnat', 'toutes rondes', 'round robin', 'chacun', 'calendrier'],
    steps: [
      'Créez un concours « Championnat » : le calendrier complet est généré d\'un coup (chacun rencontre chacun).',
      'Effectif impair : chaque équipe se repose une ronde, tout le monde joue autant de parties.',
      'Saisissez les scores ronde par ronde ; le classement finalise aux victoires, au goal-average, puis à la confrontation directe.',
    ],
    note: 'Au-delà de 8 équipes le nombre de parties devient vite important — préférez alors le système suisse.',
  },
  {
    id: 'pre-inscriptions',
    category: 'Démarrer',
    question: 'Comment ouvrir les pré-inscriptions en ligne ?',
    keywords: ['preinscription', 'pre inscription', 'inscription en ligne', 'formulaire', 'engagement', 'avant', 'valider'],
    intro: 'Les équipes peuvent s\'inscrire elles-mêmes avant le jour J :',
    steps: [
      'Tant que le concours est en « Inscriptions », partagez le lien public (🔗 Partager) — QR code / lien.',
      'Sur ce lien, les équipes remplissent « ✍️ Je m\'inscris » (noms, licences, club).',
      'À la table de marque, onglet « Équipes » : le panneau « Pré-inscriptions en ligne » liste les demandes — « ✓ Valider » crée l\'équipe, « Refuser » l\'écarte.',
    ],
    note: 'Gain de temps à l\'accueil : les équipes arrivent déjà saisies, vous n\'avez qu\'à valider.',
  },
  {
    id: 'journee-categories',
    category: 'Démarrer',
    question: 'Plusieurs concours le même jour / catégories',
    keywords: ['journee', 'categorie', 'seniors', 'veterans', 'feminines', 'jeunes', 'plusieurs concours', 'meme jour', 'groupe'],
    steps: [
      'À la création (ou dans ⚙ Paramètres), renseignez la catégorie (Seniors, Vétérans, Féminines, Jeunes…).',
      'Le tableau de bord regroupe automatiquement les concours par journée (date).',
      'Les puces en haut filtrent par catégorie.',
    ],
  },
  {
    id: 'terrains',
    category: 'Poules',
    question: 'Comment gérer le plan des terrains ?',
    keywords: ['terrain', 'plan', 'plateau', 'libre', 'occupe', 'affecter', 'affectation', 'auto', 'jeu'],
    intro: 'L\'onglet « 🟦 Terrains » montre le plateau en direct :',
    steps: [
      'Chaque terrain apparaît libre ou occupé (avec la partie en cours).',
      '« 🎯 Affecter automatiquement » place les parties en attente sur les terrains libres ; vous pouvez aussi cliquer « T3 » sur une partie pour l\'affecter à la main.',
      'Un terrain se libère tout seul dès que le score de sa partie est saisi.',
    ],
  },
  {
    id: 'tetes-de-serie',
    category: 'Poules',
    question: 'Comment mettre des têtes de série ?',
    keywords: ['tete de serie', 'seed', 'seeding', 'classement', 'meilleures equipes', 'separer', 'tirage'],
    steps: [
      'Au moment du tirage (poules ou tableau), cochez « Têtes de série ».',
      'Désignez les meilleures équipes dans l\'ordre (1 = la meilleure), par n° ou nom.',
      'Elles seront réparties dans des poules différentes (ou des moitiés opposées du tableau) pour se rencontrer le plus tard possible.',
    ],
  },
  {
    id: 'inscrire-equipes',
    parcours: 'inscrire-equipes',
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
    parcours: 'tirer-poules',
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
    parcours: 'barrage',
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
    parcours: 'saisir-score',
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
    id: 'saisie-rapide',
    category: 'Scores',
    question: 'Saisir un score vite quand il y a beaucoup d\'équipes',
    keywords: ['rapide', 'vite', 'nombreux', 'beaucoup', 'numero', 'dossard', 'chercher', 'trouver', '64'],
    intro:
      'La barre « ⚡ Saisie rapide » en haut du concours évite de chercher dans les poules :',
    steps: [
      'Tapez le numéro de dossard de l\'équipe qui vient de finir (ex. 47).',
      'Sa partie en cours s\'affiche aussitôt, avec les deux équipes : saisissez le score et « OK ».',
      'Le champ se vide et reprend le focus — enchaînez le numéro suivant.',
    ],
    note: 'Astuce complémentaire : dans l\'onglet Poules, « Replier les terminées » masque les poules finies pour ne garder à l\'écran que celles en cours.',
  },
  {
    id: 'replier-poules',
    category: 'Poules',
    question: 'Comment masquer/replier les poules terminées ?',
    keywords: ['replier', 'masquer', 'collapse', 'reduire', 'terminees', 'cacher', 'poules'],
    steps: [
      'Onglet « Poules » : les poules terminées se replient automatiquement (résumé des qualifiés).',
      'Cliquez sur l\'en-tête d\'une poule (ou le chevron ▸) pour la déplier/replier.',
      'Boutons « Tout déplier » / « Replier les terminées » pour agir en masse.',
    ],
  },
  {
    id: 'corriger-score',
    parcours: 'corriger-score',
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
    parcours: 'lancer-tableau',
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
    parcours: 'consolante',
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
    parcours: 'affichage-public',
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
    parcours: 'impressions',
    category: 'Affichage',
    question: 'Comment imprimer les feuilles et les tableaux ?',
    keywords: ['imprimer', 'impression', 'papier', 'feuille', 'pdf'],
    steps: [
      'Affichez l\'onglet à imprimer (Équipes, Poules, Tableau ou Résultats).',
      'Cliquez sur « 🖨 Imprimer » : la mise en page d\'impression retire boutons et menus.',
      'Astuce : choisissez « Enregistrer en PDF » dans la boîte d\'impression pour un fichier.',
    ],
  },

  /* ------------------------------- Partage ------------------------------ */
  {
    id: 'partager-resultats',
    parcours: 'affichage-public',
    category: 'Partage',
    question: 'Comment partager les résultats avec les joueurs ?',
    keywords: ['partager', 'lien', 'public', 'qr', 'telephone', 'spectateur', 'suivre'],
    steps: [
      'Dans le concours, cliquez sur « 🔗 Partager » puis « Créer le lien public ».',
      'Copiez le lien (ou affichez/imprimez le QR code au boulodrome).',
      'Les joueurs l\'ouvrent sur leur téléphone : poules, tableaux et classements se mettent à jour en direct, sans compte.',
      'Le lien est révocable à tout moment depuis la même fenêtre.',
    ],
    note: 'Le lien nécessite du réseau côté spectateurs — la gestion à la table de marque reste, elle, 100 % hors-ligne.',
  },
  {
    id: 'parcours-public',
    category: 'Partage',
    question: 'Le QR code : « Je joue » ou « Je consulte » ?',
    keywords: ['je joue', 'je consulte', 'parcours', 'qr', 'public', 'mode', 'joueur', 'spectateur'],
    intro: 'À l\'ouverture du lien public, deux choix :',
    steps: [
      '🎯 « Je joue » : saisissez votre numéro d\'équipe — vous ne voyez que ce qui vous concerne (votre partie, la déclaration de votre score, vos notifications).',
      '📺 « Je consulte » : l\'affichage complet (poules, tableaux, classements) en direct.',
      'On bascule d\'un mode à l\'autre à tout moment via les onglets en haut ; le choix est mémorisé sur le téléphone.',
    ],
  },
  {
    id: 'notifications',
    category: 'Partage',
    question: 'Être prévenu sur son téléphone quand on est appelé',
    keywords: ['notification', 'prevenu', 'push', 'appele', 'convocation', 'telephone', 'alerte', 'barrage', 'sonner'],
    intro:
      'Les équipes peuvent être notifiées sur leur téléphone (barrage, tour suivant…) sans surveiller l\'écran ni venir à la table.',
    steps: [
      'Partagez le lien public (🔗 Partager) — QR code au boulodrome.',
      'Le joueur ouvre le lien, choisit « 🎯 Je joue », saisit son n° d\'équipe puis « 🔔 Être prévenu·e ».',
      'À chaque convocation (partie des gagnants/perdants, barrage, nouveau tour, nouvelle ronde), son téléphone reçoit une notification — même application fermée.',
    ],
    note: 'Nécessite un navigateur compatible (Chrome/Edge/Firefox, ou l\'application installée) et l\'autorisation des notifications. La table de marque n\'a rien à faire : les convocations partent automatiquement.',
  },
  {
    id: 'declarer-score',
    category: 'Partage',
    question: 'Les équipes peuvent-elles déclarer leurs scores elles-mêmes ?',
    keywords: ['declarer', 'declaration', 'auto', 'arbitrage', 'equipes', 'valider', 'confirmation'],
    intro:
      'Oui — idéal pour les concours sans arbitre à chaque terrain (auto-arbitrage) :',
    steps: [
      'Partagez le lien public du concours (🔗 Partager).',
      'Sur la page publique, une équipe utilise « 📣 Déclarer un score » : partie, son camp, score.',
      'L\'équipe adverse déclare à son tour depuis son téléphone : si les scores concordent, la déclaration passe « ✓ concordante ».',
      'À la table de marque, un bandeau « scores déclarés à valider » apparaît : appliquez le score concordant en un clic (ou tranchez un divergent).',
    ],
    note: 'La table de marque reste seule décisionnaire : rien ne s\'applique sans votre validation.',
  },
  {
    id: 'importer-licencies',
    category: 'Démarrer',
    question: 'Comment importer les licenciés (CSV) ?',
    keywords: ['import', 'licencies', 'csv', 'fichier', 'autocompletion', 'gagner du temps'],
    steps: [
      'Tableau de bord → « 📇 Licenciés » → choisissez votre fichier CSV (colonnes Nom, Prénom, Licence, Club — un modèle est téléchargeable).',
      'À l\'inscription des équipes, tapez les premières lettres d\'un nom : licence et club se remplissent automatiquement.',
      'Réimportez le fichier à jour quand vous voulez : les fiches existantes sont mises à jour, pas dupliquées.',
    ],
  },
  {
    id: 'inviter-club',
    category: 'Démarrer',
    question: 'Comment ajouter un co-organisateur (compte club) ?',
    keywords: ['inviter', 'invitation', 'code', 'co organisateur', 'membre', 'rejoindre', 'equipe du club'],
    steps: [
      'Tableau de bord → « 👥 Mon club » → « Générer un code d\'invitation » (valable 7 jours).',
      'Transmettez le code : sur « Créer un compte club », votre collègue le saisit dans « Code d\'invitation ».',
      'Son compte rejoint votre club : mêmes concours, synchronisés entre tous les appareils.',
    ],
  },
  {
    id: 'indemnites',
    category: 'Tableau',
    question: 'Comment calculer les indemnités (prix) ?',
    keywords: ['indemnites', 'prix', 'mise', 'argent', 'repartition', 'recompense', 'euros'],
    steps: [
      'Onglet « Résultats » → section « 💶 Indemnités » → « Calculer ».',
      'Saisissez la mise par équipe et les frais d\'organisation (%).',
      'La répartition est suggérée par groupe de classement (le vainqueur touche le double du finaliste, etc.), arrondie à 0,10 €, et s\'imprime avec les résultats.',
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
    note:
      'Installez l\'application (menu du navigateur → « Installer ») pour la retrouver même après un redémarrage de la tablette. Au premier lancement, l\'application demande aussi le « stockage persistant » : le navigateur s\'interdit alors de purger vos données locales.',
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
    id: 'mode-invite',
    category: 'Hors ligne',
    question: 'Peut-on essayer sans créer de compte ?',
    keywords: ['invite', 'essai', 'essayer', 'sans compte', 'tester', 'gratuit', 'inscription'],
    intro: 'Oui : le mode invité donne accès à tout, sans compte.',
    steps: [
      'Sur l\'écran de connexion, choisissez « 🚀 Essayer sans compte ».',
      'Tout fonctionne (formules, tirages, scores, affichage TV…) mais uniquement sur cet appareil : rien n\'est envoyé en ligne.',
      'Pour sauvegarder et synchroniser : cliquez sur « Créer un compte » (badge du haut) — l\'application propose alors de rattacher vos concours invité au compte.',
    ],
    note:
      'Attention : en mode invité, « Quitter » efface définitivement les données de l\'appareil.',
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
    id: 'palmares',
    category: 'Résultats',
    question: 'Où voir le palmarès du club ?',
    keywords: ['palmares', 'vainqueurs', 'honneur', 'historique', 'gagnants', 'clubs', 'classement'],
    intro: 'Le palmarès rassemble tous les concours clôturés :',
    steps: [
      'Depuis le tableau de bord, cliquez sur « 🏆 Palmarès ».',
      'Le tableau d\'honneur liste chaque concours terminé avec son vainqueur et son finaliste.',
      'Le classement des clubs cumule les victoires et les finales.',
      'Un concours apparaît dès qu\'il est clôturé (bouton « Clôturer le concours » sur le tableau).',
    ],
    action: { label: '🏆 Ouvrir le palmarès', path: '/palmares' },
  },
  {
    id: 'exporter',
    parcours: 'exporter-resultats',
    category: 'Résultats',
    question: 'Comment exporter les résultats (CSV, sauvegarde) ?',
    keywords: ['exporter', 'export', 'csv', 'json', 'sauvegarde', 'excel', 'tableur', 'classement', 'telecharger'],
    intro: 'Depuis l\'onglet « Résultats » d\'un concours, la barre « Exporter » propose :',
    steps: [
      '« 📊 Classement (CSV) » : le classement final, ouvrable dans Excel / LibreOffice.',
      '« 📋 Engagés (CSV) » : la liste des équipes (dossard, joueurs, licences, club, réglé).',
      '« 💾 Sauvegarde (JSON) » : une copie complète et relisible du concours.',
    ],
    note: 'Les fichiers CSV utilisent le point-virgule et l\'UTF-8 : ils s\'ouvrent directement dans les tableurs français.',
  },
  {
    id: 'chrono',
    category: 'Déroulement',
    question: 'Comment utiliser le chrono des parties au temps ?',
    keywords: ['chrono', 'temps', 'minuteur', 'partie au temps', 'duree', 'limite', 'derniere mene'],
    intro: 'Quand un « temps limité » est défini à la création, un chrono s\'affiche en tête du concours :',
    steps: [
      'Cliquez sur « ▶ Démarrer » pour lancer le décompte de la ronde.',
      'À 5 minutes de la fin, le chrono passe en orange (« Dernière mène »).',
      'À zéro, il devient rouge, clignote et émet un bip (« Temps écoulé »).',
      'Le chrono peut être mis en pause puis repris ; il survit au changement d\'onglet.',
    ],
    note: 'Le temps limité se règle dans « ⚙ Paramètres » du concours.',
  },
  {
    id: 'discipline-paiements',
    category: 'Démarrer',
    question: 'Jeu provençal, mises et qualifiés : où les régler ?',
    keywords: ['jeu provencal', 'discipline', 'mise', 'paiement', 'caisse', 'regle', 'qualifies', 'qualificatif'],
    intro: 'Ces options se choisissent à la création ou dans les paramètres :',
    steps: [
      'Discipline « Pétanque » ou « Jeu provençal » (la gestion est identique).',
      'Une « mise par équipe » active le suivi de caisse : cochez « réglé » pour chaque équipe dans l\'onglet Inscriptions, le total encaissé s\'affiche.',
      'Un nombre de « qualifiés » met en évidence les mieux classés (bandeau et badges dans les résultats) pour une phase suivante.',
    ],
  },
  {
    id: 'tutoriel',
    parcours: 'decouverte',
    category: 'Démarrer',
    question: 'Revoir le tutoriel (visite guidée)',
    keywords: ['tutoriel', 'visite', 'guide', 'apprendre', 'decouvrir', 'demonstration', 'demo', 'aide'],
    intro: 'Deux façons de (re)découvrir l\'application :',
    steps: [
      'Cliquez sur « 🎓 Relancer la visite guidée » ci-dessous.',
      'Ou créez un « concours d\'exemple » pré-rempli depuis l\'écran de bienvenue pour vous entraîner sans risque.',
    ],
  },
  {
    id: 'feuille-match',
    parcours: 'feuille-match',
    category: 'Championnat des clubs',
    question: 'Comment remplir une feuille de match ?',
    keywords: ['feuille', 'match', 'rencontre', 'championnat', 'clubs', 'coupe', 'capitaine', 'signature', 'composition'],
    intro:
      'Pour le championnat des clubs et la Coupe de France, la feuille se remplit dans l\'application :',
    steps: [
      'Depuis le tableau de bord, ouvrez « 🏅 Feuilles de match ».',
      '« + Nouvelle feuille » : renseignez les deux clubs et la date.',
      'Composez les équipes, puis saisissez les résultats des rencontres.',
      'Les deux clubs peuvent échanger leurs compositions par QR code, sans réseau.',
      'Faites signer les deux capitaines, puis imprimez ou exportez la feuille en fichier.',
    ],
    note: 'La feuille se synchronise entre les appareils du club, comme un concours.',
    action: { label: 'Ouvrir les feuilles de match', path: '/championnat-clubs' },
  },
  {
    id: 'nouveautes',
    category: 'Démarrer',
    question: 'Quoi de neuf dans cette version ?',
    keywords: ['nouveau', 'nouveaute', 'neuf', 'quoi', 'change', 'changement', 'version', 'mise', 'jour', 'ajoute'],
    intro:
      'L\'application se met à jour toute seule ; le tour d\'horizon de ce qu\'elle a gagné se rouvre à volonté :',
    steps: [
      'Cliquez sur « ✨ Voir les nouveautés » ci-dessous.',
      'Ou, depuis n\'importe quel écran, sur le numéro de version en bas de page.',
    ],
    note: 'La version exacte que vous utilisez y est affichée : c\'est elle qu\'on vous demandera en cas de souci.',
  },
];

/** Suggestions mises en avant à l'ouverture de l'assistant. */
export const FEATURED_IDS = [
  'creer-concours',
  'choisir-formule',
  'tirer-poules',
  'saisir-score',
  'corriger-score',
  'hors-ligne',
];
