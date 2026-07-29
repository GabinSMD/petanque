/**
 * Ce qu'on dit à l'organisateur quand un écran tombe.
 *
 * Un onglet qui plante laissait une page blanche : au boulodrome, avec trente
 * poules en cours, c'est indistinguable d'une application perdue. Deux choses
 * manquaient — un message qui dise quoi faire, et de quoi transmettre le défaut
 * à celui qui dépanne. Les deux sont décidées ici, hors de React, pour être
 * éprouvées.
 *
 * Deux genres seulement, parce qu'il n'y en a que deux qui changent la conduite
 * à tenir : l'application mise à jour sous les pieds — la tablette garde
 * l'ancien code et réclame un morceau que le déploiement a remplacé, seul un
 * rechargement répare — et tout le reste, où réessayer vaut d'être tenté. On
 * n'invente pas de diagnostic plus fin : annoncer « problème de données » sur
 * une erreur qu'on n'a pas comprise serait une supposition présentée comme un
 * fait.
 */

export type GenreIncident = 'miseAJour' | 'inconnu';

/**
 * Ce qui est tombé. Ça change ce qu'on peut honnêtement affirmer : dire « le
 * reste de l'application continue de fonctionner » quand c'est l'application
 * qui est tombée serait faux.
 */
export type PorteeIncident = 'onglet' | 'page' | 'application';

export interface Incident {
  genre: GenreIncident;
  titre: string;
  explication: string;
  /** Ce qu'on met en avant : réessayer le rendu, ou recharger l'application. */
  action: 'reessayer' | 'recharger';
}

/** Après deux échecs, un troisième essai donne le même écran. */
const ESSAIS_AVANT_RECHARGEMENT = 2;

/**
 * Messages des navigateurs quand un morceau de code manque à l'appel. Ils
 * varient d'un moteur à l'autre, d'où la liste ; elle est délibérément précise
 * pour ne pas confondre avec un message contenant « module » par hasard.
 */
const SIGNES_MISE_A_JOUR = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'loading chunk',
  'loading css chunk',
  'unable to preload css',
  'failed to load module script',
];

const MAX_MESSAGE = 300;
const MAX_COMPOSANTS = 6;

/**
 * Cadres présents dans toutes les piles : la frontière elle-même et la
 * plomberie du routeur. Les garder repousserait les vrais coupables hors du
 * rapport, qui est borné.
 */
const PLOMBERIE = new Set([
  'FrontiereErreur',
  'RenderedRoute',
  'Outlet',
  'Routes',
  'Router',
  'BrowserRouter',
  'RequireAuth',
  'StrictMode',
]);

/** Ce qui reste vrai, selon ce qui est tombé. */
const RASSURANCE: Record<PorteeIncident, string> = {
  onglet:
    'Le reste de l\'application continue de fonctionner : les autres onglets et vos autres concours restent accessibles. Vos données sont enregistrées sur cet appareil.',
  page: 'Le reste de l\'application continue de fonctionner : vos concours restent accessibles. Vos données sont enregistrées sur cet appareil.',
  application:
    'Vos données sont enregistrées sur cet appareil : rien n\'est perdu. Rechargez l\'application pour repartir.',
};

export function analyserIncident(
  erreur: { name?: string; message?: string } | null | undefined,
  essais: number,
  portee: PorteeIncident = 'onglet',
): Incident {
  const message = (erreur?.message ?? '').toLowerCase();
  if (SIGNES_MISE_A_JOUR.some((signe) => message.includes(signe))) {
    return {
      genre: 'miseAJour',
      titre: 'L\'application a été mise à jour',
      explication:
        'Cet appareil exécute encore la version précédente et il lui manque un morceau. Rechargez pour récupérer la nouvelle : rien n\'est perdu, vos concours sont enregistrés sur cet appareil.',
      action: 'recharger',
    };
  }
  return {
    genre: 'inconnu',
    titre:
      portee === 'application'
        ? 'L\'application n\'a pas pu démarrer'
        : 'Cet écran n\'a pas pu s\'afficher',
    explication: RASSURANCE[portee],
    // À la racine, réessayer remonte le même code sur la même donnée : c'est le
    // rechargement qui a une chance, et lui seul.
    action:
      portee === 'application' || essais >= ESSAIS_AVANT_RECHARGEMENT ? 'recharger' : 'reessayer',
  };
}

/** Coupe proprement, sans laisser croire que le texte est complet. */
function borne(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, max)}…`;
}

/**
 * Les noms de composants de la pile React, du plus proche de l'erreur au plus
 * lointain. Les balises HTML sont écartées — `div`, `main` et compagnie noient
 * la pile sans rien apprendre — et les URL avec, parce qu'un chemin de fichier
 * local n'aide personne dans un message recopié.
 */
function composants(pile: string | undefined): string[] {
  if (!pile) return [];
  const noms: string[] = [];
  for (const ligne of pile.split('\n')) {
    const m = /^\s*(?:at|in)\s+([A-Za-z0-9_$.]+)/.exec(ligne);
    if (!m) continue;
    const nom = m[1]!;
    // Un composant React porte une majuscule ; `div`, `main`, `svg` non.
    if (!/^[A-Z]/.test(nom)) continue;
    if (PLOMBERIE.has(nom)) continue;
    noms.push(nom);
    if (noms.length >= MAX_COMPOSANTS) break;
  }
  return noms;
}

/**
 * Le chemin, jeton de partage masqué : le rapport se recopie dans un mail, et
 * un lien public y fuirait.
 */
function cheminPublic(chemin: string): string {
  return chemin.replace(/^\/p\/[^/?#]+/, '/p/…');
}

export interface EntreeRapport {
  erreur: { name?: string; message?: string } | null | undefined;
  /** Pile de composants fournie par React. */
  pile?: string;
  version: string;
  /** Commit court, ou chaîne vide si le build n'avait pas accès à git. */
  commit: string;
  chemin: string;
  /** Horodatage ISO de l'incident. */
  quand: string;
}

/**
 * Un rapport court, en clair, que l'organisateur recopie dans un message. Il ne
 * porte que ce qui sert à dépanner : ni contenu de concours, ni jeton.
 */
export function rapportIncident(entree: EntreeRapport): string {
  const { erreur, pile, version, commit, chemin, quand } = entree;
  const nom = erreur?.name?.trim();
  const message = erreur?.message?.trim();
  const lignes = [
    'Pétanque Concours — incident',
    commit ? `Version ${version} (commit ${commit})` : `Version ${version}`,
    `Écran : ${cheminPublic(chemin)}`,
    `Quand : ${quand}`,
    `Erreur : ${borne([nom, message].filter(Boolean).join(': ') || 'sans message', MAX_MESSAGE)}`,
  ];
  const pileNoms = composants(pile);
  if (pileNoms.length > 0) lignes.push(`Composants : ${pileNoms.join(' ← ')}`);
  return lignes.join('\n');
}
