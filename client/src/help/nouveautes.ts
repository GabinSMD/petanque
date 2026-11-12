import {
  CaseUpper,
  CircleCheck,
  ClipboardList,
  Compass,
  Copy,
  FileStack,
  Scale,
  Search,
  Trophy,
  GraduationCap,
  IdCard,
  Moon,
  Printer,
  Sparkles,
  Tag,
  Timer,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { Nouveaute } from '@shared';

/**
 * Journal des nouveautés, du plus récent au plus ancien.
 *
 * **Convention** : livrer une nouveauté visible par l'utilisateur, c'est ajouter
 * un point ici *et* monter la version du `package.json` racine. La détection
 * s'appuie sur ce journal (voir `recapNouveautes`), pas sur le `package.json` :
 * un oubli de bump ne rend pas la pop-up muette, il fait seulement mentir
 * l'étiquette du pied de page.
 *
 * Les `path` visent des écrans de premier niveau : le journal parle de
 * l'application, pas d'un concours en particulier.
 */
export const JOURNAL: Nouveaute<LucideIcon>[] = [
  {
    version: '0.6.0',
    date: '2026-11-12',
    items: [
      {
        icone: Scale,
        titre: 'Les règles fédérales, au plus près du logiciel officiel',
        texte:
          'Mutations internes et externes distinguées, licenciés suspendus refusés, ' +
          'case « Critères France » sur les championnats (un joueur hors UE et un muté ' +
          'externe au plus), et un rapport d\'arbitrage qui donne aussi les places des ' +
          'concours B et C.',
      },
      {
        icone: Trophy,
        titre: 'Nouvelle formule A-B avec récupération',
        texte:
          'Les perdants du 2e tour du A entrent au 2e tour du B. Et pour un concours en ' +
          'poules, on choisit désormais au tirage le tour où se fait le cadrage du tableau.',
      },
      {
        icone: Printer,
        titre: 'Des fiches de jeu à imprimer',
        texte:
          'Une fiche par équipe — poule, adversaires, terrains, cases de score — pour ' +
          'continuer le concours à la main si l\'informatique lâche. Bouton « Fiches de ' +
          'jeu » à côté des tickets de parties.',
      },
      {
        icone: Search,
        titre: 'La fiche d\'une équipe en un clic, les résultats d\'un club',
        texte:
          'Cliquez sur un dossard dans les poules ou le tableau pour ouvrir la fiche de ' +
          'l\'équipe. Dans Résultats, tapez le nom d\'un club pour voir où en sont toutes ' +
          'ses équipes.',
      },
      {
        icone: Copy,
        titre: 'Fusionner les scores de deux appareils sans réseau',
        texte:
          'Importez la sauvegarde d\'un autre poste dans le même concours : ses scores sont ' +
          'repris et font avancer le tableau, et les désaccords vous sont montrés.',
      },
      {
        icone: FileStack,
        titre: 'Plus vite à la création et au dépôt',
        texte:
          'Un nouveau concours repart des réglages du précédent (terrains, points, mise, ' +
          'lieu). La caméra lit les licences au dépôt et sur la feuille de match, et un ' +
          '« autre championnat de clubs » se règle à la main.',
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-11',
    items: [
      {
        icone: Sparkles,
        titre: 'Pétanque Concours devient Treizéro',
        texte:
          'Nouveau nom, nouveau logo : treize à zéro, la fanny. Rien d\'autre ne change — ' +
          'vos concours, votre compte et vos sauvegardes sont exactement là où vous les ' +
          'avez laissés. Si l\'application est installée sur votre appareil, son nom et ' +
          'son icône se mettent à jour d\'eux-mêmes.',
      },
      {
        icone: Moon,
        titre: 'Un thème sombre',
        texte:
          'Pour le soir ou le club-house : ouvrez les réglages (la roue dentée de « Mes ' +
          'concours »), rubrique Apparence, et choisissez Clair, Sombre ou Comme ' +
          'l\'appareil. Le choix vaut pour cet appareil ; les documents imprimés et ' +
          'l\'écran d\'affichage ne changent pas.',
      },
      {
        icone: UserPlus,
        titre: 'Inscrire une équipe : les noms, et c\'est tout',
        texte:
          'Pour un concours de club, le formulaire ne montre plus que les noms et le ' +
          'club de l\'équipe. Licences et clubs par joueur restent à un clic, et ' +
          's\'affichent d\'office sur un concours officiel. Les actions rares — lecteur de ' +
          'licences, plusieurs sites, annuler un tirage — sont rangées dans le menu « Plus ».',
      },
      {
        icone: CircleCheck,
        titre: 'La saisie rapide confirme chaque score',
        texte:
          'Après validation, un bandeau rappelle le score enregistré et l\'équipe ' +
          'gagnante, avec « corriger » juste à côté. Au doigt, le bouton « Valider » est ' +
          'plus grand.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-07-29',
    items: [
      {
        icone: Compass,
        titre: 'L\'assistant sait où vous en êtes',
        texte:
          'Il ne renvoie plus vers une liste de sujets après avoir répondu : il propose la ' +
          'suite de votre concours — « les poules sont finies, place au tableau ». Et ' +
          'quand il ne comprend pas la question, il demande une précision au lieu de ' +
          'dérouler le sommaire. Le sommaire reste là, sous le champ de saisie.',
        action: { label: 'Ouvrir l\'assistant', parcours: 'decouverte' },
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-07-29',
    items: [
      {
        icone: GraduationCap,
        titre: 'L\'assistant vous fait faire, il ne raconte plus',
        texte:
          'Chaque geste courant a son guide pas à pas : l\'assistant surligne où cliquer, ' +
          'puis attend que vous l\'ayez fait avant de proposer la suite. Tirer les poules, ' +
          'saisir un score, lancer le tableau, remplir une feuille de match… Il reprend ' +
          'là où vous en êtes, et ne vous répète pas ce qui est déjà fait.',
        action: { label: 'Me guider', parcours: 'decouverte' },
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-29',
    items: [
      {
        icone: ClipboardList,
        titre: 'Feuille de match du championnat des clubs',
        texte:
          'Remplissez la feuille dans l\'application au lieu du papier : compositions, ' +
          'résultats des rencontres, signature des deux capitaines, puis impression ou ' +
          'export en fichier. Les deux clubs peuvent échanger leurs compositions par QR code.',
        action: { label: 'Ouvrir les rencontres', path: '/championnat-clubs' },
      },
      {
        icone: IdCard,
        titre: 'Licences contrôlées avant le concours',
        texte:
          'Importez le fichier des licenciés, faites le dépôt des licences équipe par ' +
          'équipe, et scannez le QR code d\'une licence pour inscrire un joueur à la volée.',
        action: { label: 'Voir les licenciés', path: '/licencies' },
      },
      {
        icone: CaseUpper,
        titre: 'Formules A-B-C et récupérations',
        texte:
          'Les formules du manuel fédéral où personne ne rentre chez lui après une ' +
          'défaite : deux victoires en A, une en B, zéro en C, avec les récupérations.',
      },
      {
        icone: Printer,
        titre: 'Impressions officielles',
        texte:
          'Feuille d\'arbitrage, liste des inscrits, résultats pour la presse, absents, ' +
          'graphique du tableau : les documents que la fédération attend, prêts à sortir.',
      },
      {
        icone: Timer,
        titre: 'Trouver la poule qui retarde tout le monde',
        texte:
          'Les statistiques des poules classent les retardataires par temps d\'attente, ' +
          'et signalent les barrages qui n\'attendent plus que d\'être joués.',
      },
      {
        icone: Tag,
        titre: 'La version est affichée en pied de page',
        texte:
          'Version, commit et date de compilation, en bas de chaque écran : de quoi ' +
          'savoir ce que la tablette exécute vraiment quand quelque chose cloche. ' +
          'C\'est aussi de là qu\'on rouvre cette fenêtre.',
      },
    ],
  },
];
