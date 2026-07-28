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
  club: 'CLUB',
  departemental: 'DEPARTEMENTAL',
  regional: 'REGIONAL',
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
  championnat: 'CHAMPIONNAT',
  coupe_de_france: 'COUPE-DE-FRANCE',
};

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
