/**
 * Base personnelle de licenciés étrangers (manuel « Gestion Concours » §3.B.1,
 * zone 21).
 *
 * En livrant le lot #97 j'avais écrit que le manuel ne documentait pas de base
 * personnelle. Il la documente deux fois, et j'avais lu les deux sans les voir :
 *
 *  - le texte de la zone 21 : « permet d'inscrire un joueur étranger affilié à
 *    la fédération de son pays et permet également **d'enrichir une base
 *    personnelle de joueurs licenciés à l'étranger et non en France et Monaco**
 *    (ce module peut être utilisé pour les concours internationaux ou les
 *    concours organisés dans les clubs frontaliers) » ;
 *  - la copie d'écran de la p.20, une fois extraite en pleine résolution : la
 *    fenêtre orange **« Création Licence Etrangère : Base Personnelle »**, avec
 *    ses champs *Num Licence*, *Nom*, *Prénom*, *Date Naissance (JJ/MM/AAAA)*,
 *    *Sexe*, *Pays*, et son bouton **« Enregistrer dans la base perso »**.
 *
 * Nous savions déjà inscrire un joueur étranger — un code pays sur le joueur,
 * qui suffit au contingent hors UE. Ce qui manquait, c'est la persistance : le
 * club frontalier qui reçoit les mêmes Suisses chaque année les ressaisissait
 * intégralement à chaque concours.
 *
 * **Pourquoi une base à part et non le fichier des licenciés**, qui porte
 * pourtant les mêmes champs : le fichier fédéral est un import, qu'on purge et
 * remplace. Y ranger des fiches saisies à la main les ferait disparaître au
 * premier « vider et réimporter ». Le manuel dit « base personnelle » — c'est
 * une base personnelle.
 */
import type { LicencieEtranger, Player, Sexe } from '../types';
import { parseDateFr } from './licencesImport';

export interface PaysLicence {
  /** Code pays à deux lettres, tel que le contingent hors UE le lit. */
  code: string;
  nom: string;
}

/**
 * Les pays de la liste, dans l'ordre de la copie d'écran. La liste a une barre
 * de défilement : elle peut être plus longue que ces sept entrées, et je ne
 * complète pas à l'aveugle. Les codes sont ceux que `estHorsUE` sait lire —
 * sans quoi une fiche enregistrée ne compterait dans aucun contingent.
 */
export const PAYS_LICENCE_ETRANGERE: PaysLicence[] = [
  { code: 'DE', nom: 'Allemagne' },
  { code: 'BE', nom: 'Belgique' },
  { code: 'ES', nom: 'Espagne' },
  { code: 'IT', nom: 'Italie' },
  { code: 'LU', nom: 'Luxembourg' },
  { code: 'NL', nom: 'Pays-Bas' },
  { code: 'CH', nom: 'Suisse' },
];

/** Nom du pays, pour l'afficher plutôt que son code. */
export function nomDuPays(code: string | undefined): string | undefined {
  return PAYS_LICENCE_ETRANGERE.find((p) => p.code === code?.trim().toUpperCase())?.nom;
}

/** Champs saisis dans la fenêtre, avant contrôle. */
export interface SaisieFicheEtrangere {
  licence?: string;
  nom: string;
  prenom: string;
  /** Date au format de la fiche : JJ/MM/AAAA. */
  dateNaissance?: string;
  sexe?: Sexe;
  pays: string;
}

export type ResultatFiche =
  | { ok: true; fiche: Omit<LicencieEtranger, 'id' | 'updatedAt'> }
  | { ok: false; raison: string };

const rempli = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
};

/**
 * Contrôle une saisie et rend la fiche à enregistrer.
 *
 * Exigé : nom, prénom, et un pays **de la liste** — le code pays est ce que
 * relit le contingent hors UE des compétitions de clubs, et un pays inconnu
 * rendrait ce contrôle muet sans le dire.
 *
 * Facultatif : le numéro de licence et la date de naissance. Refuser une
 * inscription parce que le joueur n'a pas son numéro sur lui serait pire que de
 * l'inscrire sans — mais une date saisie doit être lisible, sinon la catégorie
 * d'âge qu'on en déduirait serait fausse.
 */
export function normaliserFicheEtrangere(saisie: SaisieFicheEtrangere): ResultatFiche {
  const nom = rempli(saisie.nom);
  const prenom = rempli(saisie.prenom);
  if (!nom) return { ok: false, raison: 'Le nom est obligatoire.' };
  if (!prenom) return { ok: false, raison: 'Le prénom est obligatoire.' };

  const pays = rempli(saisie.pays)?.toUpperCase();
  if (!pays) return { ok: false, raison: 'Le pays de la fédération est obligatoire.' };
  if (!PAYS_LICENCE_ETRANGERE.some((p) => p.code === pays)) {
    return { ok: false, raison: `Le pays « ${pays} » n'est pas dans la liste des fédérations.` };
  }

  const dateSaisie = rempli(saisie.dateNaissance);
  const dateNaissance = dateSaisie ? parseDateFr(dateSaisie) : undefined;
  if (dateSaisie && !dateNaissance) {
    return { ok: false, raison: 'Date de naissance illisible : attendu JJ/MM/AAAA.' };
  }

  return {
    ok: true,
    fiche: {
      licence: rempli(saisie.licence),
      // Tout en capitales : c'est ce qu'écrivent les fiches licence et les
      // feuilles de match du manuel, et ce que le document du délégué demande
      // — « Nom, Prénom (en lettre majuscule) ».
      nom: nom.toUpperCase(),
      prenom: prenom.toUpperCase(),
      dateNaissance,
      sexe: saisie.sexe,
      pays,
    },
  };
}

/** Nom affiché : « MÜLLER Hans », l'ordre des documents fédéraux. */
export function nomCompletEtranger(fiche: Pick<LicencieEtranger, 'nom' | 'prenom'>): string {
  return `${fiche.nom} ${fiche.prenom}`.trim();
}

/**
 * Le joueur à inscrire. Pas de `licence` : le numéro de sa fédération n'est pas
 * un numéro fédéral français, et le mettre là ferait chercher une fiche
 * inexistante dans le fichier des licenciés. C'est `licenceEtrangere` qui porte
 * le pays, comme depuis le lot #97.
 */
export function joueurDepuisFicheEtrangere(fiche: LicencieEtranger, club?: string): Player {
  return {
    name: nomCompletEtranger(fiche),
    licenceEtrangere: fiche.pays,
    club,
  };
}

/**
 * Recherche dans la base personnelle, sur le modèle décrit au §3.B.1 : « Tapez
 * juste DUP et <<ENTRER>> vous obtiendrez la liste des licenciés de votre base
 * de données qui commence par DUP ».
 *
 * Une recherche vide ne rend rien : déverser la base entière n'aiderait
 * personne, et la liste des étrangers d'un club frontalier n'est pas courte.
 */
export function chercherEtrangers(
  base: LicencieEtranger[],
  requete: string,
): LicencieEtranger[] {
  const q = requete.trim().toUpperCase();
  if (!q) return [];
  return base.filter(
    (f) =>
      f.nom.toUpperCase().startsWith(q) ||
      f.prenom.toUpperCase().startsWith(q) ||
      (f.licence ?? '').toUpperCase().startsWith(q),
  );
}
