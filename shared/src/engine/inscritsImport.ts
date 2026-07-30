/**
 * Import d'une liste d'inscrits (manuel « Gestion Concours » §3.B.10.B).
 *
 * « Permet de rajouter un fichier […] issu du module "Exporter Liste des
 * Inscrits" […]. Les équipes sont insérées dans le concours. » C'est le pendant
 * de l'export : un club qui enchaîne deux concours avec les mêmes équipes, ou
 * qui repart de la liste d'un qualificatif, ne ressaisit pas tout.
 *
 * Deux formes sont acceptées : celle de notre propre export — joueurs et
 * licences dans une colonne, séparés par « / » — et une colonne par joueur,
 * comme un tableur fait à la main. Les colonnes sont reconnues par mots-clés,
 * jamais par position.
 *
 * Le format du fichier Excel fédéral n'est pas décrit dans le manuel et je n'en
 * ai pas d'exemplaire : il n'est donc pas prétendu couvert.
 *
 * Comme pour les licenciés, on préfère ignorer une ligne illisible et le dire
 * plutôt que d'inventer une équipe.
 */

export interface JoueurInscrit {
  name: string;
  licence?: string;
  club?: string;
}

export interface EquipeImportee {
  /** Dossard lu dans le fichier, s'il y en a un. */
  number?: number;
  players: JoueurInscrit[];
  club?: string;
  forfait: boolean;
  paid: boolean;
}

export type LectureInscrits =
  | { ok: true; equipes: EquipeImportee[]; ignorees: number }
  | { ok: false; erreur: string };

const strip = (s: string): string => s.replace(/^"([\s\S]*)"$/, '$1').replace(/""/g, '"').trim();

/**
 * Découpe une ligne CSV en respectant les guillemets : un séparateur entre
 * guillemets fait partie de la valeur. Sans cela, un club nommé « Boule; et
 * Cie » — ou n'importe quel champ échappé par un tableur — crée une colonne
 * fantôme et décale tout le reste de la ligne.
 */
function decouper(ligne: string, delim: string): string[] {
  const cells: string[] = [];
  let courant = '';
  let dansGuillemets = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i]!;
    if (c === '"') {
      // Deux guillemets successifs à l'intérieur : un guillemet littéral.
      if (dansGuillemets && ligne[i + 1] === '"') {
        courant += '""';
        i += 1;
      } else {
        dansGuillemets = !dansGuillemets;
        courant += c;
      }
      continue;
    }
    if (c === delim && !dansGuillemets) {
      cells.push(courant);
      courant = '';
      continue;
    }
    courant += c;
  }
  cells.push(courant);
  return cells;
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const estVrai = (v: string | undefined): boolean => {
  const n = norm(v ?? '');
  return n === 'oui' || n === 'o' || n === 'x' || n === '1' || n === 'true';
};

/** Découpe une cellule « A / B / C » en ses éléments, vides compris. */
const parts = (v: string | undefined): string[] =>
  (v ?? '').split('/').map((x) => x.trim());

export function lireInscritsCsv(texte: string): LectureInscrits {
  const lignes = (texte ?? '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lignes.length === 0) {
    return { ok: false, erreur: 'Ce fichier est vide.' };
  }

  const premiere = lignes[0]!;
  const delim = [';', ',', '\t'].reduce((best, d) =>
    decouper(premiere, d).length > decouper(premiere, best).length ? d : best,
  );
  const entetes = decouper(premiere, delim).map((c) => norm(strip(c)));

  // Un fichier de licenciés a une ligne par personne, avec nom ET prénom
  // séparés : c'est la confusion qui arrivera vraiment.
  if (entetes.some((h) => h === 'prenom') && entetes.some((h) => h.startsWith('nom'))) {
    return {
      ok: false,
      erreur:
        'Ce fichier est une liste de licenciés, pas une liste d\'inscrits : importez-le depuis « 📇 Licenciés ».',
    };
  }

  const trouve = (predicat: (h: string) => boolean): number => entetes.findIndex(predicat);
  const iJoueurs = trouve((h) => h === 'joueurs' || h === 'equipe joueurs' || h === 'noms');
  const iClub = trouve((h) => h.includes('club'));
  const iLicences = trouve((h) => h === 'licences');
  const iNumero = trouve((h) => h === 'n°' || h === 'no' || h === 'numero' || h === 'equipe');
  const iForfait = trouve((h) => h.includes('forfait'));
  const iRegle = trouve((h) => h.includes('regle') || h.includes('paye'));

  // Colonnes « Joueur 1 » / « Licence 1 », dans l'ordre où elles apparaissent.
  const colonnesJoueur: { joueur: number; licence: number }[] = [];
  for (const [i, h] of entetes.entries()) {
    const m = /^joueur\s*(\d+)$/.exec(h);
    if (!m) continue;
    const rang = m[1];
    colonnesJoueur.push({
      joueur: i,
      licence: trouve((x) => x === `licence ${rang}` || x === `licence${rang}`),
    });
  }

  if (iJoueurs < 0 && colonnesJoueur.length === 0) {
    return {
      ok: false,
      erreur:
        'Aucune colonne de joueurs reconnue : il faut une colonne « Joueurs », ou « Joueur 1 », « Joueur 2 »…',
    };
  }

  const equipes: EquipeImportee[] = [];
  let ignorees = 0;

  for (const ligne of lignes.slice(1)) {
    const cells = decouper(ligne, delim).map(strip);
    const cell = (i: number): string | undefined => (i >= 0 ? cells[i] || undefined : undefined);

    let players: JoueurInscrit[] = [];
    if (iJoueurs >= 0) {
      const noms = parts(cell(iJoueurs));
      const licences = parts(cell(iLicences));
      players = noms
        .map((name, i) => ({ name, licence: licences[i] || undefined }))
        .filter((p) => p.name.length > 0);
    } else {
      players = colonnesJoueur
        .map(({ joueur, licence }) => ({
          name: cell(joueur) ?? '',
          licence: cell(licence) || undefined,
        }))
        .filter((p) => p.name.length > 0);
    }

    if (players.length === 0) {
      ignorees += 1;
      continue;
    }

    const numero = Number(cell(iNumero));
    equipes.push({
      number: Number.isFinite(numero) && numero > 0 ? numero : undefined,
      players,
      club: cell(iClub),
      forfait: estVrai(cell(iForfait)),
      paid: estVrai(cell(iRegle)),
    });
  }

  if (equipes.length === 0) {
    return {
      ok: false,
      erreur: 'Aucune équipe lisible dans ce fichier : vérifiez qu\'il contient bien des inscrits.',
    };
  }
  return { ok: true, equipes, ignorees };
}
