import { useState } from 'react';
import {
  EMPLACEMENTS_PHOTO,
  MAX_OCTETS_PHOTO,
  photoAcceptable,
  type Concours,
  type EmplacementPhoto,
  type PhotoConcours,
} from '@shared';
import { usePhotos } from '../db/hooks';
import { enregistrerPhoto, supprimerPhoto } from '../db/actions';

/**
 * Photos du podium diffusées sur la page publique (manuel §3.D.1.B.5.5).
 *
 * Une photo d'équipe est une donnée personnelle et le lien de partage est
 * public : l'accord des personnes est demandé **avant** l'ajout, une seule fois
 * mais explicitement, et chaque photo se retire d'un clic. Sans accord coché,
 * l'image n'est pas enregistrée du tout — pas « enregistrée mais masquée ».
 *
 * L'image est réduite avant d'être stockée : une photo de téléphone brute pèse
 * plusieurs mégaoctets, qui passeraient dans chaque échange de synchronisation
 * et sur chaque chargement de la page publique.
 */

/** Réduit une image à `maxLargeur` px de large, en JPEG. */
async function reduire(fichier: File, maxLargeur = 900): Promise<string> {
  const bitmap = await createImageBitmap(fichier);
  const echelle = Math.min(1, maxLargeur / bitmap.width);
  const largeur = Math.round(bitmap.width * echelle);
  const hauteur = Math.round(bitmap.height * echelle);
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de préparer l\'image.');
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  bitmap.close();
  // Qualité descendante jusqu'à tenir dans le plafond : mieux vaut une image un
  // peu moins fine qu'un refus au moment de l'envoi.
  for (const qualite of [0.75, 0.6, 0.45, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', qualite);
    if (url.length <= MAX_OCTETS_PHOTO) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.3);
}

export function PhotosPodium({ concours }: { concours: Concours }) {
  const photos = usePhotos(concours.id) ?? [];
  const [accord, setAccord] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<EmplacementPhoto | null>(null);

  const parEmplacement = new Map<EmplacementPhoto, PhotoConcours>();
  for (const p of photos) {
    const actuelle = parEmplacement.get(p.emplacement);
    if (!actuelle || actuelle.updatedAt < p.updatedAt) parEmplacement.set(p.emplacement, p);
  }

  const ajouter = async (emplacement: EmplacementPhoto, fichier: File): Promise<void> => {
    setErreur(null);
    setEnCours(emplacement);
    try {
      const image = await reduire(fichier);
      const verdict = photoAcceptable(image);
      if (!verdict.ok) {
        setErreur(verdict.raison);
        return;
      }
      await enregistrerPhoto(concours.id, emplacement, image);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Image illisible.');
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="photos-podium no-print">
      <h3>📷 Photos du podium</h3>
      <p className="hint">
        Ces photos apparaissent sur le lien de partage public, visible par toute personne qui
        l'a. Chacune se retire d'un clic, mais une page déjà consultée peut avoir été enregistrée
        ailleurs — c'est le propre d'une publication.
      </p>
      <label className="checkbox-label">
        <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} />
        Les personnes photographiées m'ont donné leur accord pour cette diffusion
      </label>
      {erreur && <p className="form-error">{erreur}</p>}
      <ul className="liste-photos">
        {EMPLACEMENTS_PHOTO.map(({ id, label }) => {
          const photo = parEmplacement.get(id);
          return (
            <li key={id}>
              <span className="photo-label">{label}</span>
              {photo ? (
                <>
                  <img src={photo.image} alt={label} />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void supprimerPhoto(photo.id)}
                  >
                    🗑 Retirer
                  </button>
                </>
              ) : (
                <label className={accord ? 'btn btn-ghost btn-sm' : 'btn btn-ghost btn-sm disabled'}>
                  {enCours === id ? 'Ajout…' : '📷 Ajouter'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={!accord || enCours !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void ajouter(id, f);
                    }}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {!accord && (
        <p className="hint">
          Cochez l'accord ci-dessus pour pouvoir ajouter une photo. Sans lui, rien n'est
          enregistré — ni publié, ni gardé sur l'appareil.
        </p>
      )}
    </div>
  );
}
