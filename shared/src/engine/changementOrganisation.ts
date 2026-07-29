/**
 * Changer de compte sur un appareil qui porte déjà des données.
 *
 * La base locale appartient à une organisation : y laisser les concours d'un
 * autre compte n'aurait pas de sens, et la purge au changement est la bonne
 * règle. Mais elle était **muette**, y compris pour ce qui n'avait pas encore
 * été envoyé. Un concours saisi au boulodrome sans réseau n'est nulle part
 * ailleurs : l'effacer sans le dire, c'est le perdre pour de bon.
 *
 * D'où la distinction faite ici. Quand tout est déjà sur le serveur de l'autre
 * compte, la purge ne coûte rien — s'y reconnecter suffit à retrouver les
 * données, et poser une question sans enjeu apprend à cliquer « oui » sans
 * lire. Quand il reste des modifications non envoyées, on n'efface pas : on le
 * dit, et on laisse le choix.
 *
 * Le mode invité tombe naturellement du bon côté : ses données n'ont jamais été
 * poussées, donc elles comptent toutes comme en attente.
 */

export type DecisionChangementOrg =
  | { action: 'rien' }
  | { action: 'purger' }
  | { action: 'proteger' };

export function decisionChangementOrg(entree: {
  /** Organisation à laquelle appartient la base locale, si connue. */
  orgLocale?: string;
  orgSession: string;
  /** Nombre de modifications locales pas encore acquittées par le serveur. */
  enAttente: number;
}): DecisionChangementOrg {
  const { orgLocale, orgSession, enAttente } = entree;
  if (!orgLocale || orgLocale === orgSession) return { action: 'rien' };
  return enAttente > 0 ? { action: 'proteger' } : { action: 'purger' };
}

export interface LigneEnAttente {
  type: string;
  id: string;
  /** Concours de rattachement ; absent pour ce qui appartient à l'organisation. */
  concoursId?: string;
}

export interface BilanEnAttente {
  total: number;
  /** Modifications par concours, le plus gros d'abord. */
  parConcours: { concoursId: string; nb: number }[];
  /**
   * Modifications qu'une sauvegarde de concours ne couvre pas — licenciés,
   * feuilles de match d'un championnat des clubs. Le dire évite de promettre
   * une sauvegarde complète qui n'en est pas une.
   */
  horsConcours: number;
}

export function bilanEnAttente(lignes: LigneEnAttente[]): BilanEnAttente {
  const parConcours = new Map<string, number>();
  let horsConcours = 0;

  for (const ligne of lignes) {
    // L'entité `concours` porte son identifiant dans `id` : elle est le cœur de
    // sa propre sauvegarde, pas une donnée qui y échappe.
    const cle = ligne.type === 'concours' ? ligne.id : ligne.concoursId;
    if (cle) parConcours.set(cle, (parConcours.get(cle) ?? 0) + 1);
    else horsConcours += 1;
  }

  return {
    total: lignes.length,
    parConcours: [...parConcours]
      .map(([concoursId, nb]) => ({ concoursId, nb }))
      .sort((a, b) => (b.nb !== a.nb ? b.nb - a.nb : a.concoursId < b.concoursId ? -1 : 1)),
    horsConcours,
  };
}

/** La phrase affichée avant d'effacer quoi que ce soit. */
export function messageProtection(bilan: BilanEnAttente): string {
  const n = bilan.total;
  const s = n > 1 ? 's' : '';
  const phrases = [
    `${n} modification${s} de l'autre compte n'${n > 1 ? 'ont' : 'a'} pas encore été envoyée${s} au serveur : elle${s} n'existe${n > 1 ? 'nt' : ''} que sur cet appareil.`,
    'Rien n\'a été effacé. Enregistrez une sauvegarde de ce qui compte avant de continuer.',
  ];
  if (bilan.horsConcours > 0) {
    phrases.push(
      `Attention : ${bilan.horsConcours} modification${bilan.horsConcours > 1 ? 's' : ''} ne ${bilan.horsConcours > 1 ? 'sont' : 'se'} rattachée${bilan.horsConcours > 1 ? 's' : ''} à aucun concours (licenciés, feuilles de match) — une sauvegarde de concours ne les couvre pas.`,
    );
  }
  return phrases.join(' ');
}
