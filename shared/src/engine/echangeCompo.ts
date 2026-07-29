/**
 * Échange de composition entre deux clubs, par QR code ou code recopié.
 *
 * Sur une feuille de match, chaque club déclare sa composition — huit joueurs
 * avec leurs numéros de licence. Le club qui reçoit doit aujourd'hui recopier à
 * la main celle de l'adversaire, alors que l'adversaire l'a déjà saisie chez lui
 * et contrôlée sur son propre fichier des licenciés.
 *
 * Le visiteur produit donc un code, l'hôte le scanne, et les huit lignes se
 * remplissent. Le format est du texte ligne par ligne, pour trois raisons :
 * il tient dans un QR, il se lit à l'œil quand quelque chose ne va pas, et il
 * se recopie à la main si la caméra fait défaut.
 *
 * Rien ne passe par le réseau : les deux clubs sont au boulodrome, où il n'y a
 * souvent pas de réseau, et ils n'ont pas de compte commun.
 */
import type { CompetitionClubId } from './championnat';

/** Marque du format, pour ne pas confondre ce code avec un autre QR. */
export const ENTETE_COMPOSITION = 'PETANQUE-COMPO';

/** Version du format écrite par cette application. */
export const VERSION_COMPOSITION = 1;

export interface JoueurEchange {
  nom: string;
  licence: string;
}

export interface CompositionEchangee {
  club: string;
  numeroClub: string;
  competition: CompetitionClubId;
  date: string;
  /** Capitaine ou coach qui ne joue pas, quand il y en a un. */
  capitaine?: JoueurEchange;
  joueurs: JoueurEchange[];
}

export type LectureComposition =
  | { ok: true; composition: CompositionEchangee }
  | { ok: false; raison: string };

const SEP = '|';

const joueurEnTexte = (j: JoueurEchange): string => `${j.nom}${SEP}${j.licence}`;

/**
 * Découpe `nom|licence` sur le **dernier** séparateur : un nom peut en contenir
 * un, un numéro de licence non.
 */
function joueurDepuisTexte(valeur: string): JoueurEchange | null {
  const coupe = valeur.lastIndexOf(SEP);
  if (coupe < 0) return null;
  const nom = valeur.slice(0, coupe).trim();
  const licence = valeur.slice(coupe + 1).trim();
  if (!nom) return null;
  return { nom, licence };
}

/** Code à mettre dans un QR ou à recopier. */
export function encoderComposition(c: CompositionEchangee): string {
  const lignes = [
    `${ENTETE_COMPOSITION}/${VERSION_COMPOSITION}`,
    `club=${c.club.trim()}`,
    `numero=${c.numeroClub.trim()}`,
    `competition=${c.competition}`,
    `date=${c.date}`,
  ];
  if (c.capitaine) lignes.push(`capitaine=${joueurEnTexte(c.capitaine)}`);
  for (const j of c.joueurs) lignes.push(`j=${joueurEnTexte(j)}`);
  return lignes.join('\n');
}

/**
 * Relit un code reçu. Refuse franchement plutôt que de rendre une composition
 * vide : un QR de licence scanné par erreur, ou un code d'une version plus
 * récente, doivent produire un message et non huit lignes blanches.
 */
export function decoderComposition(texte: string): LectureComposition {
  const lignes = (texte ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const entete = lignes[0] ?? '';
  if (!entete.startsWith(`${ENTETE_COMPOSITION}/`)) {
    return {
      ok: false,
      raison: "Ce code n'est pas une composition d'équipe.",
    };
  }
  const version = Number(entete.slice(ENTETE_COMPOSITION.length + 1));
  if (!Number.isFinite(version) || version > VERSION_COMPOSITION) {
    return {
      ok: false,
      raison:
        'Ce code vient d\'une version plus récente de l\'application : mettez la vôtre à jour pour le lire.',
    };
  }

  const composition: CompositionEchangee = {
    club: '',
    numeroClub: '',
    competition: 'cnc_open',
    date: '',
    joueurs: [],
  };
  for (const ligne of lignes.slice(1)) {
    const coupe = ligne.indexOf('=');
    if (coupe < 0) continue;
    const cle = ligne.slice(0, coupe).trim();
    const valeur = ligne.slice(coupe + 1).trim();
    switch (cle) {
      case 'club':
        composition.club = valeur;
        break;
      case 'numero':
        composition.numeroClub = valeur;
        break;
      case 'competition':
        composition.competition = valeur as CompetitionClubId;
        break;
      case 'date':
        composition.date = valeur;
        break;
      case 'capitaine': {
        const j = joueurDepuisTexte(valeur);
        if (j) composition.capitaine = j;
        break;
      }
      case 'j': {
        const j = joueurDepuisTexte(valeur);
        if (j) composition.joueurs.push(j);
        break;
      }
      default:
        // Ligne inconnue : une version future peut en ajouter, on l'ignore.
        break;
    }
  }

  if (composition.joueurs.length === 0) {
    return { ok: false, raison: 'Ce code ne contient aucun joueur à recopier.' };
  }
  return { ok: true, composition };
}
