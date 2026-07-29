/**
 * Décisions de la réplication : ce qui remplace quoi, ce qui est exploitable, et
 * ce qui est acquitté.
 *
 * Ces règles vivaient dans le moteur de synchronisation du client, mêlées aux
 * accès à la base et au réseau, donc invérifiables. Elles sont ici pour pouvoir
 * être éprouvées : ce sont elles qui décident si une donnée du club survit ou
 * disparaît.
 *
 * La règle générale reste le dernier écrivain qui gagne, l'horodatage local
 * étant strictement croissant. Le serveur départage les horodatages identiques
 * par identifiant d'appareil ; **il est donc l'arbitre**, et c'est ce qui dicte
 * les décisions ci-dessous.
 */
import { validerEquipe } from './validationEquipe';

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

/**
 * Un changement reçu du serveur est-il exploitable ?
 *
 * Le dernier écrivain gagne, mais gagner avec une donnée cassée ne sert
 * personne : une équipe malformée poussée par un appareil d'une autre version
 * blanchirait l'écran des inscriptions, ici comme là-bas, et le rechargement
 * n'y changerait rien puisque la donnée serait en base. On ne l'applique pas.
 *
 * Refuser localement ne perd rien : la ligne reste sur le serveur, et une
 * équipe malformée ne porte de toute façon aucune information exploitable.
 *
 * Les suppressions passent toujours — une pierre tombale ne porte pas de
 * données, et la refuser ferait réapparaître une équipe supprimée ailleurs. Les
 * autres types ne sont pas jugés ici : leurs invariants ne sont pas ceux de la
 * réplication.
 */
export function changementApplicable(changement: {
  type: string;
  data: unknown;
  deleted?: boolean | 0 | 1;
}): boolean {
  if (changement.deleted) return true;
  if (changement.type !== 'team') return true;
  return validerEquipe(changement.data).ok;
}
