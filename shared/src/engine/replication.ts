/**
 * Décisions de la réplication : ce qui remplace quoi, et ce qui est acquitté.
 *
 * Ces deux règles vivaient dans le moteur de synchronisation du client, mêlées
 * aux accès à la base et au réseau, donc invérifiables. Elles sont ici pour
 * pouvoir être éprouvées : ce sont elles qui décident si une donnée du club
 * survit ou disparaît.
 *
 * La règle générale reste le dernier écrivain qui gagne, l'horodatage local
 * étant strictement croissant. Le serveur départage les horodatages identiques
 * par identifiant d'appareil ; **il est donc l'arbitre**, et c'est ce qui dicte
 * les deux décisions ci-dessous.
 */

/** Clé d'une entité dans les échanges : `type:id`. */
export function cleEntite(type: string, id: string): string {
  return `${type}:${id}`;
}

export interface EtatLocal {
  updatedAt: string;
  /** 1 = modification locale pas encore poussée. */
  dirty: 0 | 1;
}

/**
 * Un changement reçu du serveur doit-il remplacer l'état local ?
 *
 * Le cas qui compte est l'égalité d'horodatage avec une modification locale en
 * attente : le serveur a déjà arbitré, et s'il nous renvoie cette ligne, c'est
 * que la nôtre a perdu. La refuser laisserait une version locale divergente,
 * renvoyée à chaque échange sans jamais être acceptée.
 *
 * Une modification faite *pendant* l'échange porte, elle, un horodatage
 * strictement plus récent : elle survit.
 */
export function changementGagne(
  entrant: { updatedAt: string },
  local: EtatLocal | undefined,
): boolean {
  if (!local) return true;
  return entrant.updatedAt >= local.updatedAt;
}

/**
 * Parmi les entités envoyées, celles que le serveur a effectivement acceptées.
 *
 * Acquitter un envoi que le serveur n'a pas pris — parce qu'il l'a refusé, ou
 * parce qu'il ignore ce type d'entité — reviendrait à marquer « synchronisée »
 * une donnée qui n'est nulle part. Elle disparaîtrait au premier changement
 * d'appareil, sans que rien ne l'ait signalé.
 */
export function envoisAcquittes(
  envoyes: { type: string; id: string }[],
  accepted: readonly string[],
): Set<string> {
  const acceptes = new Set(accepted);
  const out = new Set<string>();
  for (const e of envoyes) {
    const cle = cleEntite(e.type, e.id);
    if (acceptes.has(cle)) out.add(cle);
  }
  return out;
}
