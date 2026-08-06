/**
 * Feuille de match d'une rencontre de championnat des clubs.
 *
 * Ce document est aujourd'hui rempli à la main : composition des deux équipes
 * au recto, ordre des rencontres et résultats au verso, puis retour au comité.
 * Ce qu'on lui apporte ici, ce n'est pas la mise en page — c'est l'arithmétique,
 * qui est la source des erreurs : chaque partie vaut un nombre de points selon
 * son type, et la somme des deux totaux est connue d'avance.
 *
 * Sur la feuille du CD26 : tête-à-tête 2 points, doublette 4, triplette 6, soit
 * 6 × 2 + 3 × 4 + 2 × 6 = **36 points en jeu**. La feuille le rappelle en
 * en-tête, et ce total est ce qui permet de dire qu'une feuille est fausse avant
 * de la signer.
 *
 * Le barème est une **donnée**, pas du code : il varie d'un comité et d'un
 * championnat à l'autre, et celui du CD26 n'est qu'un cas.
 */

import type { CompetitionClubId, ContingentHorsUE } from './championnat';
import { TAILLE_FORMATION } from './formations';

/** Les trois positions admises, pour ne rien reprendre d'autre d'une feuille lue. */
const CONTINGENTS: ContingentHorsUE[] = ['tous', 'un_externe', 'aucun'];

/** Formation d'une partie de la rencontre. */
export type TypePartie = 'tete_a_tete' | 'doublette' | 'triplette';

/**
 * Lettre d'une équipe de club (manuel §3.E, planche p.114). Un club peut engager
 * plusieurs équipes dans la même compétition, chacune avec sa fiche.
 *
 * **Huit, pas plus.** Le panneau « Choix Equipe » porte exactement huit boutons
 * — `Equipe A` à `Equipe H` — sans ascenseur, et aucune capture n'en montre un
 * neuvième. Huit est donc le maximum *attesté* ; je n'affirme pas que ce soit
 * une limite du règlement, et inventer un `I` serait exactement l'extrapolation
 * que la lecture du manuel interdit.
 */
export type LettreEquipe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export const LETTRES_EQUIPE: readonly LettreEquipe[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
];

/**
 * Désignation d'une équipe de club, comme sur la feuille imprimée :
 * `Equipe A:PET CLUB DU VERCORS` contre `Equipe B:PETANQUE ILE VERTE`.
 *
 * Sans lettre, le seul nom du club — un club qui n'engage qu'une équipe n'a pas
 * à porter une lettre qu'il n'a pas choisie. Sans nom, la seule lettre.
 */
export function libelleEquipeClub(lettre: LettreEquipe | undefined, club: string): string {
  const nom = club.trim();
  if (!lettre) return nom;
  return nom ? `Equipe ${lettre}:${nom}` : `Equipe ${lettre}`;
}

/** Un bloc de la feuille : tant de parties de ce type, valant tant de points. */
export interface BlocBareme {
  type: TypePartie;
  nb: number;
  /** Points attribués au vainqueur de chacune de ces parties. */
  points: number;
}

export interface BaremeRencontre {
  id: string;
  label: string;
  blocs: BlocBareme[];
}

/** Barème de la feuille de match du championnat des clubs (exemple : CD26). */
export const BAREME_CDC: BaremeRencontre = {
  id: 'cdc',
  label: 'Championnat des clubs — 6 têtes-à-têtes, 3 doublettes, 2 triplettes',
  blocs: [
    { type: 'tete_a_tete', nb: 6, points: 2 },
    { type: 'doublette', nb: 3, points: 4 },
    { type: 'triplette', nb: 2, points: 6 },
  ],
};

/** Une partie de la rencontre : son type, son score, et le jeu où elle se joue. */
export interface PartieRencontre {
  type: TypePartie;
  /** Points marqués par le camp A, ou `null` tant que la partie n'est pas saisie. */
  scoreA: number | null;
  scoreB: number | null;
  /**
   * Jeu attribué à la partie — la colonne centrale de la feuille. Purement
   * descriptif : le décompte des points l'ignore.
   */
  jeu?: string;
}

/** Total des points que la rencontre met en jeu — 36 sur la feuille du CD26. */
export function pointsEnJeu(bareme: BaremeRencontre): number {
  return bareme.blocs.reduce((total, b) => total + b.nb * b.points, 0);
}

/** Les parties de la feuille, dans l'ordre du barème, vierges. */
export function partiesVides(bareme: BaremeRencontre): PartieRencontre[] {
  return bareme.blocs.flatMap((b) =>
    Array.from({ length: b.nb }, () => ({ type: b.type, scoreA: null, scoreB: null })),
  );
}

/**
 * Ce qui peut clocher sur une feuille :
 *  - `nulle` : deux scores égaux — le manuel ne l'accepte pas, une partie a un
 *    vainqueur ;
 *  - `incomplete` : un seul des deux scores saisi, donc rien à attribuer.
 */
export type AnomalieRencontre = 'nulle' | 'incomplete';

export interface SousTotal {
  type: TypePartie;
  a: number;
  b: number;
}

export interface BilanRencontre {
  sousTotaux: SousTotal[];
  totalA: number;
  totalB: number;
  /** Parties dont le résultat est exploitable. */
  jouees: number;
  /** Nombre total de parties de la feuille. */
  parties: number;
  complete: boolean;
  anomalies: AnomalieRencontre[];
}

/**
 * Compte les points d'une feuille de match. Les points ne se saisissent pas :
 * ils découlent du vainqueur de chaque partie et de son type. C'est tout
 * l'intérêt de le faire ici plutôt qu'à la main en bas de la feuille.
 *
 * Une feuille complète et sans anomalie vérifie toujours
 * `totalA + totalB === pointsEnJeu(bareme)`.
 */
export function bilanRencontre(
  bareme: BaremeRencontre,
  parties: PartieRencontre[],
): BilanRencontre {
  const pointsDuType = new Map(bareme.blocs.map((b) => [b.type, b.points]));
  const sousTotaux: SousTotal[] = bareme.blocs.map((b) => ({ type: b.type, a: 0, b: 0 }));
  const anomalies = new Set<AnomalieRencontre>();
  let jouees = 0;

  for (const partie of parties) {
    const { scoreA, scoreB } = partie;
    if (scoreA === null && scoreB === null) continue;
    if (scoreA === null || scoreB === null) {
      anomalies.add('incomplete');
      continue;
    }
    if (scoreA === scoreB) {
      anomalies.add('nulle');
      continue;
    }
    const points = pointsDuType.get(partie.type) ?? 0;
    const sousTotal = sousTotaux.find((s) => s.type === partie.type);
    if (sousTotal) {
      if (scoreA > scoreB) sousTotal.a += points;
      else sousTotal.b += points;
    }
    jouees += 1;
  }

  return {
    sousTotaux,
    totalA: sousTotaux.reduce((t, s) => t + s.a, 0),
    totalB: sousTotaux.reduce((t, s) => t + s.b, 0),
    jouees,
    parties: parties.length,
    complete: jouees === parties.length && parties.length > 0,
    anomalies: [...anomalies],
  };
}

/** Libellé court d'un type de partie, pour les en-têtes de la feuille. */
export const LIBELLE_TYPE_PARTIE: Record<TypePartie, string> = {
  tete_a_tete: 'Tête-à-tête',
  doublette: 'Doublettes',
  triplette: 'Triplettes',
};

/* ------------------------------------------------------------------ */
/* Empreinte du contenu signé                                          */
/* ------------------------------------------------------------------ */

/**
 * Ce que la signature atteste : tout ce qui est écrit sur la feuille. Les
 * signatures elles-mêmes n'en font pas partie — on ne signe pas sa signature.
 */
export interface ContenuFeuille {
  entete: Record<string, string>;
  compositionA: string[];
  compositionB: string[];
  parties: {
    type: TypePartie;
    scoreA: number | null;
    scoreB: number | null;
    jeu?: string;
    placesA: string[];
    placesB: string[];
  }[];
  remplacements: { bloc: string; cote: string; remplace: string; remplacant: string }[];
  remarques: string;
  totalA: number;
  totalB: number;
}

const propre = (v: string | undefined): string => (v ?? '').trim();

/**
 * Représentation canonique de la feuille : le texte exact sur lequel porte
 * l'empreinte. Les espaces superflus sont retirés — sinon une frappe invisible
 * ferait croire à une feuille modifiée.
 *
 * L'ordre est fixé ici une fois pour toutes : deux feuilles identiques donnent
 * le même texte, quel que soit l'ordre dans lequel elles ont été remplies.
 */
export function contenuSigne(c: ContenuFeuille): string {
  const lignes: string[] = [];
  for (const cle of Object.keys(c.entete).sort()) {
    lignes.push(`${cle}=${propre(c.entete[cle])}`);
  }
  lignes.push(`A:${c.compositionA.map(propre).join('|')}`);
  lignes.push(`B:${c.compositionB.map(propre).join('|')}`);
  for (const [i, p] of c.parties.entries()) {
    const score = p.scoreA === null || p.scoreB === null ? '-' : `${p.scoreA}-${p.scoreB}`;
    lignes.push(
      [
        `p${i}`,
        p.type,
        score,
        `jeu=${propre(p.jeu)}`,
        p.placesA.map(propre).join('+'),
        p.placesB.map(propre).join('+'),
      ].join(';'),
    );
  }
  for (const r of c.remplacements) {
    lignes.push(`r;${r.bloc};${r.cote};${propre(r.remplace)};${propre(r.remplacant)}`);
  }
  lignes.push(`remarques=${propre(c.remarques)}`);
  lignes.push(`total=${c.totalA}-${c.totalB}`);
  return lignes.join('\n');
}

/**
 * Empreinte de contrôle de la feuille : huit caractères hexadécimaux, à imprimer
 * à côté des signatures.
 *
 * Ce n'est pas un sceau cryptographique et ça ne prétend pas l'être : c'est un
 * témoin. Si la feuille est modifiée après signature, l'empreinte réimprimée ne
 * correspond plus à celle qui figure sur l'exemplaire signé, et cela se voit à
 * l'œil nu. Hachage FNV-1a 32 bits : déterministe, sans dépendance, calculable
 * hors connexion.
 */
export function empreinteFeuille(c: ContenuFeuille): string {
  const texte = contenuSigne(c);
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    // Multiplication par le nombre premier FNV, en restant sur 32 bits.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, '0');
}

/* ------------------------------------------------------------------ */
/* La feuille comme entité : elle se synchronise et se conserve         */
/* ------------------------------------------------------------------ */

/** Un joueur de la composition adverse, recopié de sa feuille. */
export interface JoueurAdverse {
  nom: string;
  licence: string;
}

export interface RemplacementFeuille {
  remplace: string;
  remplacant: string;
}

/** Signature recueillie : le tracé, l'heure, et ce qui a été signé. */
export interface SignatureFeuille {
  image: string;
  quand: string;
  empreinte: string;
}

/**
 * Feuille de match d'une rencontre.
 *
 * C'est une entité à part entière, et non un brouillon d'appareil : elle se
 * synchronise entre les tablettes du club, survit à la perte de l'une d'elles,
 * et un club en garde autant que de rencontres jouées dans la saison.
 *
 * Elle ne dépend d'aucun concours — une rencontre de championnat des clubs n'en
 * est pas un — d'où un `concoursId` vide, comme pour les licenciés.
 */
export interface FeuilleMatch {
  id: string;
  /** Vide : une feuille n'appartient à aucun concours. */
  concoursId: string;
  competition: CompetitionClubId;
  /**
   * Lettre de **notre** équipe dans cette compétition (§3.E, « Choix Equipe »).
   * Absente quand le club n'engage qu'une équipe : la feuille porte alors le seul
   * nom du club, comme avant ce lot.
   */
  equipe?: LettreEquipe;
  /** Lettre de l'équipe adverse — la feuille imprimée porte les deux. */
  equipeAdverse?: LettreEquipe;
  maxMutes: number;
  /**
   * Contingent d'étrangers hors UE (§3.E). Porté par la feuille et non par le
   * code : les trois positions du panneau fédéral se choisissent rencontre par
   * rencontre, selon le règlement de la division.
   */
  horsUE: ContingentHorsUE;
  date: string;
  division: string;
  poule: string;
  club: string;
  numeroClub: string;
  adversaire: string;
  numeroClubAdverse: string;
  capitaineNom: string;
  capitaineLicence: string;
  /** Notre composition : numéros de licence, contrôlés depuis le fichier. */
  licences: string[];
  /** Composition adverse, recopiée : ses licences ne sont pas dans notre fichier. */
  adversaireJoueurs: JoueurAdverse[];
  heureDebut: string;
  heureFin: string;
  parties: PartieRencontre[];
  places: { a: string[]; b: string[] }[];
  remplacements: {
    a: Record<string, RemplacementFeuille[]>;
    b: Record<string, RemplacementFeuille[]>;
  };
  remarques: string;
  courrielComite: string;
  signatures: { a: SignatureFeuille | null; b: SignatureFeuille | null };
  updatedAt: string;
}

/** Places vides, une par partie, dimensionnées selon la formation. */
export function placesVides(bareme: BaremeRencontre = BAREME_CDC): { a: string[]; b: string[] }[] {
  return partiesVides(bareme).map((p) => ({
    a: Array<string>(TAILLE_FORMATION[p.type]).fill(''),
    b: Array<string>(TAILLE_FORMATION[p.type]).fill(''),
  }));
}

/**
 * « Réinitialiser Fiche A » (manuel §3.E, planche p.114) : remet la **fiche** à
 * zéro, pas la rencontre.
 *
 * Ce que la fiche contient, c'est une composition : le coach ou capitaine et les
 * huit joueurs. On l'efface, avec ce qui la nomme — les places du verso, qui
 * portent des noms de joueurs, et les remplacements. Les **signatures** partent
 * aussi : une signature atteste une composition, celle-ci effacée elle ne
 * certifie plus rien.
 *
 * Ce qui reste : l'identité de la feuille (sa lettre, son club, l'adversaire, la
 * compétition, la division, la poule, la date) et les **scores déjà
 * enregistrés**. Ces derniers appartiennent à la rencontre et non à la fiche :
 * une composition mal saisie se refait sans perdre les résultats du jour.
 *
 * Les autres fiches ne sont pas concernées : chacune est une entité distincte, et
 * cette fonction n'en voit qu'une.
 *
 * Les places se reconstruisent d'après les parties de **cette** feuille, jamais
 * d'après `BAREME_CDC` : le barème « varie d'un comité et d'un championnat à
 * l'autre », et le figer ici rendrait onze places à une feuille qui n'en a que
 * deux.
 */
export function reinitialiserFiche(feuille: FeuilleMatch): FeuilleMatch {
  return {
    ...feuille,
    capitaineNom: '',
    capitaineLicence: '',
    licences: [],
    places: feuille.parties.map((p) => ({
      a: Array<string>(TAILLE_FORMATION[p.type]).fill(''),
      b: Array<string>(TAILLE_FORMATION[p.type]).fill(''),
    })),
    remplacements: { a: {}, b: {} },
    signatures: { a: null, b: null },
  };
}

/** Feuille neuve, prête à remplir. */
export function feuilleVierge(
  id: string,
  date: string,
  competition: CompetitionClubId,
): FeuilleMatch {
  return {
    id,
    concoursId: '',
    competition,
    maxMutes: 1,
    horsUE: 'un_externe',
    date,
    division: '',
    poule: '',
    club: '',
    numeroClub: '',
    adversaire: '',
    numeroClubAdverse: '',
    capitaineNom: '',
    capitaineLicence: '',
    licences: [],
    adversaireJoueurs: Array.from({ length: 8 }, () => ({ nom: '', licence: '' })),
    heureDebut: '',
    heureFin: '',
    parties: partiesVides(BAREME_CDC),
    places: placesVides(),
    remplacements: { a: {}, b: {} },
    remarques: '',
    courrielComite: '',
    signatures: { a: null, b: null },
    updatedAt: '',
  };
}

/**
 * Reprend la feuille que l'ancienne version laissait dans le navigateur, pour
 * qu'un club en cours de saison ne perde pas la rencontre du jour.
 *
 * Tout ce qui est illisible est remplacé par du vierge plutôt que de faire
 * échouer la reprise : mieux vaut une feuille à recommencer qu'un écran mort.
 * Des parties qui ne correspondent plus au barème sont refaites — les afficher
 * telles quelles donnerait des totaux faux.
 */
export function feuilleDepuisMemoire(id: string, brut: unknown): FeuilleMatch {
  const vierge = feuilleVierge(id, new Date().toISOString().slice(0, 10), 'cnc_open');
  if (!brut || typeof brut !== 'object') return vierge;
  const m = brut as Record<string, unknown>;

  const texte = (cle: string, defaut = ''): string =>
    typeof m[cle] === 'string' ? (m[cle] as string) : defaut;
  const attendues = partiesVides(BAREME_CDC);
  const parties = Array.isArray(m.parties) && m.parties.length === attendues.length
    ? attendues.map((attendue, i) => {
        const lue = (m.parties as unknown[])[i] as Partial<PartieRencontre> | undefined;
        if (!lue || lue.type !== attendue.type) return attendue;
        return {
          type: attendue.type,
          scoreA: typeof lue.scoreA === 'number' ? lue.scoreA : null,
          scoreB: typeof lue.scoreB === 'number' ? lue.scoreB : null,
          jeu: typeof lue.jeu === 'string' ? lue.jeu : undefined,
        };
      })
    : attendues;

  const modele = placesVides();
  const places = Array.isArray(m.places) && m.places.length === modele.length
    ? modele.map((attendue, i) => {
        const lue = (m.places as unknown[])[i] as { a?: unknown; b?: unknown } | undefined;
        const cote = (v: unknown, taille: number): string[] =>
          Array.isArray(v) && v.length === taille ? v.map((x) => (typeof x === 'string' ? x : '')) : Array<string>(taille).fill('');
        return { a: cote(lue?.a, attendue.a.length), b: cote(lue?.b, attendue.b.length) };
      })
    : modele;

  return {
    ...vierge,
    competition: (typeof m.competition === 'string'
      ? (m.competition as CompetitionClubId)
      : vierge.competition),
    maxMutes: typeof m.maxMutes === 'number' ? m.maxMutes : vierge.maxMutes,
    // Une position inconnue — feuille d'avant ce champ, ou valeur abîmée — ramène
    // à la limite d'un seul : le contrôle reste celui d'avant, il ne s'ouvre pas
    // dans le dos du club.
    horsUE: CONTINGENTS.includes(m.horsUE as ContingentHorsUE)
      ? (m.horsUE as ContingentHorsUE)
      : vierge.horsUE,
    date: texte('date', vierge.date),
    division: texte('division'),
    poule: texte('poule'),
    club: texte('club'),
    numeroClub: texte('numeroClub'),
    adversaire: texte('adversaire'),
    numeroClubAdverse: texte('numeroClubAdverse'),
    capitaineNom: texte('capitaineNom'),
    capitaineLicence: texte('capitaineLicence'),
    licences: Array.isArray(m.licences)
      ? (m.licences as unknown[]).filter((l): l is string => typeof l === 'string')
      : [],
    adversaireJoueurs: Array.isArray(m.adversaireJoueurs)
      ? vierge.adversaireJoueurs.map((defaut, i) => {
          const lu = (m.adversaireJoueurs as unknown[])[i] as Partial<JoueurAdverse> | undefined;
          return {
            nom: typeof lu?.nom === 'string' ? lu.nom : defaut.nom,
            licence: typeof lu?.licence === 'string' ? lu.licence : defaut.licence,
          };
        })
      : vierge.adversaireJoueurs,
    heureDebut: texte('heureDebut'),
    heureFin: texte('heureFin'),
    parties,
    places,
    remplacements:
      m.remplacements && typeof m.remplacements === 'object'
        ? {
            a: ((m.remplacements as Record<string, unknown>).a ?? {}) as FeuilleMatch['remplacements']['a'],
            b: ((m.remplacements as Record<string, unknown>).b ?? {}) as FeuilleMatch['remplacements']['b'],
          }
        : { a: {}, b: {} },
    remarques: texte('remarques'),
    courrielComite: texte('courrielComite'),
    signatures:
      m.signatures && typeof m.signatures === 'object'
        ? {
            a: ((m.signatures as Record<string, unknown>).a ?? null) as SignatureFeuille | null,
            b: ((m.signatures as Record<string, unknown>).b ?? null) as SignatureFeuille | null,
          }
        : { a: null, b: null },
  };
}

/** De quoi reconnaître une feuille dans une liste. */
export function resumeFeuille(f: Pick<FeuilleMatch, 'club' | 'adversaire'>): string {
  const nous = f.club.trim();
  const eux = f.adversaire.trim();
  if (nous && eux) return `${nous} contre ${eux}`;
  return nous || eux || 'Rencontre sans équipes';
}

/* ------------------------------------------------------------------ */
/* La feuille en fichier : archiver, transmettre, reprendre            */
/* ------------------------------------------------------------------ */

/** Version du format écrite par l'export ; on relit celle-ci et les précédentes. */
export const VERSION_FEUILLE_FICHIER = 1;

/** Marque de type dans l'enveloppe, pour distinguer des sauvegardes de concours. */
export const TYPE_FEUILLE_FICHIER = 'feuilleMatch';

export type LectureFeuilleFichier =
  | { ok: true; feuille: FeuilleMatch }
  | { ok: false; erreur: string };

/**
 * Écrit une feuille dans un fichier autonome. Un concours sait se sauver depuis
 * le §3.F.1 ; une feuille signée doit pouvoir en faire autant — pour l'archiver,
 * la transmettre, ou la reprendre sur un appareil qui n'a pas le compte du club.
 */
export function ecrireFeuilleFichier(feuille: FeuilleMatch): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'petanque-concours',
      type: TYPE_FEUILLE_FICHIER,
      version: VERSION_FEUILLE_FICHIER,
      feuille,
    },
    null,
    2,
  );
}

/**
 * Relit un fichier de feuille. Comme pour les sauvegardes de concours, on ne
 * fait confiance à rien : le fichier vient du disque et peut avoir été bricolé.
 * Le contenu passe donc par la même remise en état que la reprise d'une ancienne
 * mémoire — des parties qui ne correspondent plus au barème sont refaites plutôt
 * qu'affichées avec des totaux faux.
 *
 * L'identifiant est réattribué : la feuille s'importe **à côté** de l'originale,
 * jamais par-dessus. L'empreinte du contenu signé n'en dépend pas, donc une
 * feuille signée reste comparable à son exemplaire papier.
 */
export function lireFeuilleFichier(
  texte: string,
  nouvelId: () => string = () => `feuille-${Date.now().toString(36)}`,
): LectureFeuilleFichier {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: "Ce fichier n'est pas un JSON lisible." };
  }
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    return { ok: false, erreur: 'Ce fichier ne contient pas de feuille de match.' };
  }
  const enveloppe = brut as Record<string, unknown>;
  if (enveloppe.app !== 'petanque-concours') {
    return { ok: false, erreur: "Ce fichier n'a pas été écrit par Pétanque Concours." };
  }
  // L'erreur qui arrivera vraiment : on mélange les deux sortes de fichiers.
  if (enveloppe.concours !== undefined && enveloppe.feuille === undefined) {
    return {
      ok: false,
      erreur:
        "Ce fichier est une sauvegarde de concours, pas une feuille de match : importez-le depuis « Mes concours ».",
    };
  }
  const version = typeof enveloppe.version === 'number' ? enveloppe.version : 0;
  if (version > VERSION_FEUILLE_FICHIER) {
    return {
      ok: false,
      erreur: `Feuille en version ${version}, plus récente que cette application (${VERSION_FEUILLE_FICHIER}). Mettez l'application à jour.`,
    };
  }
  if (!enveloppe.feuille || typeof enveloppe.feuille !== 'object') {
    return { ok: false, erreur: 'Ce fichier ne contient pas de feuille de match.' };
  }
  return { ok: true, feuille: feuilleDepuisMemoire(nouvelId(), enveloppe.feuille) };
}
