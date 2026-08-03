import type { BesoinTerrains as Besoin } from '@shared';

/**
 * Besoin en terrains avant le tirage (manuel §3.B.6, « Rapport avant tirage » :
 * « Vous avez 16 terrains Disponibles / Vous aurez Besoin de 16 Terrains au
 * maximum »).
 *
 * Affiché à côté du bouton de tirage, et non seulement dans le rapport de
 * contrôle des licences : ce rapport ne s'ouvre que pour un concours **fédéral**,
 * alors qu'un concours amical à huit jeux et trente-deux équipes a exactement le
 * même problème de terrains.
 */
export function BesoinTerrainsHint({ besoin }: { besoin: Besoin | undefined }) {
  if (!besoin) return null;
  const { necessaires, disponibles, suffisants, manquants } = besoin;

  // Aucun terrain déclaré : on annonce le besoin sans juger d'un manque qu'on ne
  // peut pas constater. La fenêtre fédérale accepte aussi 0 comme « non
  // renseigné ».
  if (disponibles <= 0) {
    return (
      <p className="hint">
        🟦 Ce tirage occupera jusqu'à <strong>{necessaires}</strong> terrain
        {necessaires > 1 ? 's' : ''} en même temps. Renseignez le nombre de terrains disponibles
        pour être prévenu s'ils manquent.
      </p>
    );
  }

  if (suffisants) {
    return (
      <p className="hint">
        🟦 {necessaires} terrain{necessaires > 1 ? 's' : ''} nécessaire
        {necessaires > 1 ? 's' : ''} au maximum, {disponibles} disponible
        {disponibles > 1 ? 's' : ''}.
      </p>
    );
  }

  return (
    <p className="hint hint-attention">
      ⚠ Ce tirage occupera jusqu'à <strong>{necessaires}</strong> terrains en même temps et vous
      en déclarez <strong>{disponibles}</strong> : il en manque {manquants}. Les parties
      attendront un jeu libre — rien ne bloque le tirage, mais autant le savoir maintenant.
    </p>
  );
}
