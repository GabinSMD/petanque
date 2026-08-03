/**
 * Paramètres fédéraux d'un concours (manuel « Gestion Concours » §3.A) :
 * numérotation décalée et nom construit automatiquement.
 */
import type {
  CategorieAge,
  CritereClassification,
  CritereSexe,
  Discipline,
  NiveauConcours,
  TeamFormat,
} from '../types';

/**
 * Numéro de la prochaine équipe. Le décalage sert quand un club enchaîne
 * plusieurs concours le même jour : équipes 1.., 101.., 201.., pour qu'il n'y
 * ait jamais deux « équipe 1 » à la table de marque (manuel §3.A zone 6).
 */
export function numeroPremiereEquipe(
  numerosExistants: number[],
  decalage: number | undefined,
): number {
  if (numerosExistants.length > 0) return Math.max(...numerosExistants) + 1;
  return (decalage ?? 0) + 1;
}

const NIVEAU_MOTS: Record<NiveauConcours, string> = {
  departemental: 'DEPARTEMENTAL',
  regional: 'REGIONAL',
  championnat_departemental_honorifique: 'CHAMPIONNAT-DEPARTEMENTAL-HONORIFIQUE',
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
  qualificatif_departemental: 'QUALIFICATIF-DEPARTEMENTAL',
  championnat_departemental: 'CHAMPIONNAT-DEPARTEMENTAL',
  championnat_regional: 'CHAMPIONNAT-REGIONAL',
  club: 'CLUB',
  coupe_de_france: 'COUPE-DE-FRANCE',
  championnat: 'CHAMPIONNAT',
};

/**
 * Les huit niveaux de la liste fédérale, dans l'ordre de la liste déroulante
 * (manuel §3.A, copie d'écran p.13) : « Concours Départemental », « Concours
 * Régional », « Championnat Départemental Honorifique », « National »,
 * « International », « Qualificatif Départemental », « Championnat
 * Départemental », « Championnat Régional ».
 *
 * `club` et `coupe_de_france` n'y sont pas : le premier est à nous — un concours
 * interne, hors fédération — et le second relève du menu « Championnat – Coupe »
 * (§3.E), pas de cette liste.
 */
export const NIVEAUX_FEDERAUX: NiveauConcours[] = [
  'departemental',
  'regional',
  'championnat_departemental_honorifique',
  'national',
  'international',
  'qualificatif_departemental',
  'championnat_departemental',
  'championnat_regional',
];

/**
 * Le niveau est-il un championnat ? Quatre le sont dans la liste fédérale, là où
 * nous n'en avions qu'un — d'où l'impossibilité de dire lequel, et donc de
 * composer un numéro de concours (#111).
 *
 * Sert aussi à décider si la liste « Choix CDF » s'affiche. Le manuel la montre
 * pour « Championnat Départemental » et « Qualificatif Départemental » ; je
 * l'étends aux deux autres championnats, ce qui est une inférence — mais
 * proposer une liste n'impose rien, et un championnat régional se choisit dans
 * la même liste de dix-sept.
 */
export function estNiveauChampionnat(niveau: NiveauConcours | undefined): boolean {
  if (!niveau) return false;
  return (
    niveau === 'championnat_departemental' ||
    niveau === 'championnat_regional' ||
    niveau === 'championnat_departemental_honorifique' ||
    niveau === 'qualificatif_departemental' ||
    // Ancienne valeur des concours déjà en base.
    niveau === 'championnat'
  );
}

const FORMATION_MOTS: Record<TeamFormat, string> = {
  tete_a_tete: 'TETE-A-TETE',
  doublette: 'DOUBLETTE',
  triplette: 'TRIPLETTE',
};

/** Majuscules sans accent, espaces et ponctuation ramenés à des tirets. */
function motFederal(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ParamsNomFederal {
  /** Date au format YYYY-MM-DD. */
  date: string;
  niveau?: NiveauConcours;
  discipline?: Discipline;
  /** Comité départemental organisateur. */
  comite?: string;
  format: TeamFormat;
  /** Club organisateur. */
  club?: string;
}

/**
 * Nom du concours tel que le construit le logiciel fédéral :
 * date_niveau_jeu_comité_formation_club. Ce qui n'est pas renseigné est
 * simplement omis.
 */
export function nomConcoursFederal(p: ParamsNomFederal): string {
  const parties = [
    p.date,
    p.niveau ? NIVEAU_MOTS[p.niveau] : '',
    p.discipline === 'jeu_provencal' ? 'JEU-PROVENCAL' : p.discipline ? 'PETANQUE' : '',
    p.comite ? motFederal(p.comite) : '',
    FORMATION_MOTS[p.format],
    p.club ? motFederal(p.club) : '',
  ];
  return parties.filter(Boolean).join('_');
}

/** Libellés courts de la catégorie d'âge, pour composer la désignation d'un concours. */
const AGE_COURT: Record<CategorieAge, string> = {
  veterans: 'Vétérans',
  seniors: 'Séniors',
  juniors: 'Juniors',
  cadets: 'Cadets',
  minimes: 'Minimes',
  benjamins: 'Benjamins',
};

const SEXE_COURT: Record<Exclude<CritereSexe, 'tous'>, string> = {
  masculin: 'Masculin',
  feminin: 'Féminin',
  mixte: 'Mixte',
};

const CLASSIFICATION_COURT: Record<Exclude<CritereClassification, 'tous'>, string> = {
  elite: 'Élite',
  honneur: 'Honneur',
  promotion: 'Promotion',
};

export interface ParamsCategorie {
  categorieAge?: CategorieAge;
  critereSexe?: CritereSexe;
  critereClassification?: CritereClassification;
  /** Catégorie en texte libre (non fédéral, hors nomenclature : Open, Mixte…). */
  category?: string;
}

/**
 * Désignation de la catégorie d'un concours — source unique du libellé affiché,
 * du regroupement et du palmarès (issue #33).
 *
 * Sur un concours fédéral, elle est composée des critères normalisés dans
 * l'ordre [Sexe] [Âge] [Classification] (ex. « Féminin Vétérans Promotion ») —
 * jamais du texte libre, qui ne peut donc plus les contredire. Sur un concours
 * non fédéral, le texte libre est renvoyé tel quel. `undefined` si rien n'est
 * renseigné.
 */
export function designationCategorie(c: ParamsCategorie): string | undefined {
  const parties = [
    c.critereSexe && c.critereSexe !== 'tous' ? SEXE_COURT[c.critereSexe] : '',
    c.categorieAge ? AGE_COURT[c.categorieAge] : '',
    c.critereClassification && c.critereClassification !== 'tous'
      ? CLASSIFICATION_COURT[c.critereClassification]
      : '',
  ].filter(Boolean);
  if (parties.length > 0) return parties.join(' ');
  return c.category?.trim() || undefined;
}

/* ------------------------------------------------------------------ */
/* Reconnaître un concours fédéral                                     */
/* ------------------------------------------------------------------ */

/** Critères de contrôle des licences (manuel §3.A zones 2 à 5 et 9). */
export interface CriteresLicenceConcours {
  categorieAge?: CategorieAge;
  critereSexe?: CritereSexe;
  critereClassification?: CritereClassification;
  homogene?: boolean;
}

/**
 * Le concours pose-t-il des critères de licence ? C'est ce qui déclenche le
 * contrôle et l'écran « Dépôt des licences » : sans critère, il n'y a rien à
 * vérifier.
 */
export function aDesCriteresLicence(c: CriteresLicenceConcours): boolean {
  return Boolean(
    c.categorieAge ||
      c.homogene ||
      (c.critereSexe && c.critereSexe !== 'tous') ||
      (c.critereClassification && c.critereClassification !== 'tous'),
  );
}

/** Ce qui n'est saisi que sous la case « concours officiel ». */
export interface ParamsOfficiel extends CriteresLicenceConcours {
  niveau?: NiveauConcours;
  comiteOrganisateur?: string;
  clubOrganisateur?: string;
}

/**
 * Le concours a-t-il été déclaré officiel ? Plus large que les critères de
 * licence : un concours peut porter un niveau, un comité ou un club
 * organisateur sans imposer de critère aux licences.
 */
export function estConcoursOfficiel(c: ParamsOfficiel): boolean {
  return (
    aDesCriteresLicence(c) ||
    Boolean(c.niveau || c.comiteOrganisateur?.trim() || c.clubOrganisateur?.trim())
  );
}

/**
 * Ce club a-t-il besoin du mode fédéral ? Sert à le proposer de lui-même
 * plutôt qu'à laisser un organisateur chercher où sont passées ses fonctions :
 * un concours officiel déjà créé, ou un fichier de licenciés importé — on ne
 * l'importe pas pour rien — et le mode a sa raison d'être.
 *
 * Ce n'est qu'un défaut : un choix explicite de l'utilisateur le remplace.
 */
export function besoinModeFederal(p: {
  concours: ParamsOfficiel[];
  licencies: number;
}): boolean {
  return p.licencies > 0 || p.concours.some(estConcoursOfficiel);
}
