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
export const JOURNAL: Nouveaute[] = [
  {
    version: '0.2.0',
    date: '2026-07-29',
    items: [
      {
        icone: '📋',
        titre: 'Feuille de match du championnat des clubs',
        texte:
          'Remplissez la feuille dans l\'application au lieu du papier : compositions, ' +
          'résultats des rencontres, signature des deux capitaines, puis impression ou ' +
          'export en fichier. Les deux clubs peuvent échanger leurs compositions par QR code.',
        action: { label: 'Ouvrir les rencontres', path: '/championnat-clubs' },
      },
      {
        icone: '🪪',
        titre: 'Licences contrôlées avant le concours',
        texte:
          'Importez le fichier des licenciés, faites le dépôt des licences équipe par ' +
          'équipe, et scannez le QR code d\'une licence pour inscrire un joueur à la volée.',
        action: { label: 'Voir les licenciés', path: '/licencies' },
      },
      {
        icone: '🅰️',
        titre: 'Formules A-B-C et récupérations',
        texte:
          'Les formules du manuel fédéral où personne ne rentre chez lui après une ' +
          'défaite : deux victoires en A, une en B, zéro en C, avec les récupérations.',
      },
      {
        icone: '🖨️',
        titre: 'Impressions officielles',
        texte:
          'Feuille d\'arbitrage, liste des inscrits, résultats pour la presse, absents, ' +
          'graphique du tableau : les documents que la fédération attend, prêts à sortir.',
      },
      {
        icone: '⏱️',
        titre: 'Trouver la poule qui retarde tout le monde',
        texte:
          'Les statistiques des poules classent les retardataires par temps d\'attente, ' +
          'et signalent les barrages qui n\'attendent plus que d\'être joués.',
      },
      {
        icone: '🏷️',
        titre: 'La version est affichée en pied de page',
        texte:
          'Version, commit et date de compilation, en bas de chaque écran : de quoi ' +
          'savoir ce que la tablette exécute vraiment quand quelque chose cloche. ' +
          'C\'est aussi de là qu\'on rouvre cette fenêtre.',
      },
    ],
  },
];
