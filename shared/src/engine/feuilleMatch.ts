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

/** Formation d'une partie de la rencontre. */
export type TypePartie = 'tete_a_tete' | 'doublette' | 'triplette';

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
