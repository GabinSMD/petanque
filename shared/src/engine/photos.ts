/**
 * Photos du podium sur la page publique (manuel §3.D.1.B.5.5).
 *
 * La diffusion des résultats du logiciel fédéral « permet de mettre également
 * les photos des quatre équipes demi-finalistes et du vainqueur en ligne ».
 *
 * Une photo d'équipe est une donnée personnelle, et la page de partage est
 * publique : n'importe qui ayant le lien la voit, et un moteur d'indexation
 * peut la garder après sa suppression. Les garde-fous ne sont donc pas des
 * options mais la structure même :
 *
 * - **rien n'est publié sans accord constaté.** Une photo sans horodatage de
 *   consentement reste sur l'appareil. La règle est ici, pas seulement dans une
 *   case à cocher : un écran se contourne, une règle non ;
 * - **une taille plafonnée.** Une photo de téléphone brute pèse plusieurs
 *   mégaoctets ; elle passerait dans chaque échange de synchronisation et sur
 *   chaque chargement de la page publique, au boulodrome, en 3G ;
 * - **des images seulement.** Le champ ne sert pas de véhicule à autre chose ;
 * - **un emplacement connu.** Une donnée venue d'une autre version n'apparaît
 *   pas à une place qu'on ne sait pas nommer.
 *
 * L'organisateur reste responsable de l'accord qu'il déclare : nous ne pouvons
 * pas le vérifier, seulement refuser de publier sans lui.
 */

export type EmplacementPhoto = 'vainqueur' | 'demi1' | 'demi2' | 'demi3' | 'demi4';

export interface PhotoConcours {
  id: string;
  concoursId: string;
  emplacement: EmplacementPhoto;
  /** Image en `data:` URL, déjà réduite par l'écran qui l'a prise. */
  image: string;
  /**
   * Horodatage de l'accord des personnes photographiées, déclaré par
   * l'organisateur. Absent = pas publiable.
   */
  consentement?: string;
  updatedAt: string;
}

/** Les cinq emplacements du manuel, dans l'ordre du podium. */
export const EMPLACEMENTS_PHOTO: { id: EmplacementPhoto; label: string }[] = [
  { id: 'vainqueur', label: 'Vainqueur' },
  { id: 'demi1', label: '1re demi-finaliste' },
  { id: 'demi2', label: '2e demi-finaliste' },
  { id: 'demi3', label: '3e demi-finaliste' },
  { id: 'demi4', label: '4e demi-finaliste' },
];

/**
 * Poids maximal d'une photo, en octets de `data:` URL. Environ 250 Ko : de quoi
 * une image nette en 900 px de large, et cinq photos qui ne font pas plus d'un
 * mégaoctet sur la page publique.
 */
export const MAX_OCTETS_PHOTO = 250_000;

export type PhotoRefusee = { ok: true } | { ok: false; raison: string };

export function photoAcceptable(image: string): PhotoRefusee {
  if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(image)) {
    return {
      ok: false,
      raison: 'Ce fichier n\'est pas une image (JPEG, PNG ou WebP attendus).',
    };
  }
  if (image.length > MAX_OCTETS_PHOTO) {
    const ko = Math.round(image.length / 1024);
    const maxKo = Math.round(MAX_OCTETS_PHOTO / 1024);
    return {
      ok: false,
      raison: `Image trop lourde (${ko} Ko pour ${maxKo} Ko au plus) : réduisez-la avant de l'ajouter.`,
    };
  }
  return { ok: true };
}

const ORDRE = new Map(EMPLACEMENTS_PHOTO.map((e, i) => [e.id, i]));

/**
 * Les photos réellement publiables, une par emplacement, dans l'ordre du
 * podium. La plus récente gagne : reprendre une photo remplace la précédente
 * sans qu'il faille supprimer d'abord.
 */
export function photosPubliables(photos: PhotoConcours[]): PhotoConcours[] {
  const parEmplacement = new Map<EmplacementPhoto, PhotoConcours>();
  for (const p of photos) {
    if (!ORDRE.has(p.emplacement)) continue;
    if (!p.consentement || !p.image) continue;
    if (photoAcceptable(p.image).ok === false) continue;
    const actuelle = parEmplacement.get(p.emplacement);
    if (!actuelle || actuelle.updatedAt < p.updatedAt) parEmplacement.set(p.emplacement, p);
  }
  return [...parEmplacement.values()].sort(
    (a, b) => (ORDRE.get(a.emplacement) ?? 0) - (ORDRE.get(b.emplacement) ?? 0),
  );
}
