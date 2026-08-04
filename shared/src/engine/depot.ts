/**
 * Dépôt des licences (manuel « Gestion Concours » §3.C).
 *
 * Avant un concours officiel, chaque capitaine remet les licences de son
 * équipe : la table de marque les contrôle, puis valide le dépôt. L'écran de
 * statistiques du logiciel fédéral sert à répondre à une seule question —
 * quelles équipes n'ont pas encore présenté leurs licences.
 */
import type { Licencie, Player, Remplacement, Team } from '../types';

export type { Remplacement };

/** Conformité d'une équipe, telle que la rend `controlerEquipe`. */
export interface EtatDepot {
  teamId: string;
  conforme: boolean;
}

export interface DepotStats {
  /** Équipes attendues (les forfaits ne déposent rien). */
  total: number;
  deposees: number;
  restantes: number;
  nonConformes: number;
  /** Déposées mais non conformes : les cas que l'arbitre doit trancher. */
  deposeesNonConformes: number;
  /** Avancement du dépôt, en pourcentage entier. */
  pourcentage: number;
}

export function depotStats(teams: Team[], etats: EtatDepot[]): DepotStats {
  const attendues = teams.filter((t) => !t.forfait);
  const conformeDe = new Map(etats.map((e) => [e.teamId, e.conforme]));

  const deposees = attendues.filter((t) => t.licencesDeposees).length;
  const nonConformes = attendues.filter((t) => conformeDe.get(t.id) === false).length;
  const deposeesNonConformes = attendues.filter(
    (t) => t.licencesDeposees && conformeDe.get(t.id) === false,
  ).length;

  return {
    total: attendues.length,
    deposees,
    restantes: attendues.length - deposees,
    nonConformes,
    deposeesNonConformes,
    pourcentage: attendues.length === 0 ? 0 : Math.round((deposees / attendues.length) * 100),
  };
}

/**
 * Équipe portant une licence donnée : c'est le geste du dépôt, on scanne une
 * licence et le logiciel ouvre l'équipe correspondante.
 */
export function chercherEquipeParLicence(teams: Team[], licence: string): Team | undefined {
  if (!licence.trim()) return undefined;
  return teams.find((t) => t.players.some((p) => p.licence === licence));
}

/**
 * Ce que dit une licence scannée, **relativement à l'équipe ouverte**.
 *
 * Le logiciel fédéral (copies d'écran p.38-39) ne se contente pas de chercher la
 * licence quelque part : chaque joueur de l'écran porte un bandeau
 * **« EQUIPE : 2 »**, et une licence qui n'appartient pas à l'équipe ouverte
 * fait passer ce bandeau au rouge — **« Pas inscrit ! »** — avec un bouton
 * **« Remplacer »**, tandis que le bouton du bas devient « Annuler ».
 *
 * Trois issues, et elles ne veulent pas dire la même chose :
 *
 *  - `equipe_ouverte` : rien à signaler, c'est bien son joueur ;
 *  - `autre_equipe` : la licence est inscrite **ailleurs**. On le dit, avec le
 *    dossard — mais on ne propose pas de la voler à cette équipe : un joueur
 *    inscrit deux fois est une erreur d'inscription, pas un remplacement ;
 *  - `pas_inscrit` : personne ne la porte. C'est le remplaçant qui se présente,
 *    et c'est le seul cas où le remplacement a un sens.
 *
 * Sans équipe ouverte, une licence connue rend `autre_equipe` : l'écran s'en
 * sert pour ouvrir l'équipe, ce qui reste le geste utile du scan à froid.
 */
export type LectureDepot =
  | { type: 'equipe_ouverte'; index: number }
  | { type: 'autre_equipe'; team: Team }
  | { type: 'pas_inscrit'; fiche?: Licencie };

/**
 * Installe un remplaçant à la place du joueur de rang `index`.
 *
 * Le joueur est **reconstruit depuis la fiche**, pas fusionné sur le précédent :
 * c'est une autre personne. Garder le club ou le rôle de celui qui part ferait
 * mentir la fiche, et la colonne CD (`engine/comites.ts`) avec elle — elle lit
 * `player.comite` avant tout le reste.
 *
 * Ce que la fiche ne dit pas reste vide plutôt que d'être inventé.
 *
 * Un rang hors de l'équipe ne change rien : mieux vaut ne rien faire que
 * déplacer un joueur au hasard.
 */
export function remplacerJoueur(
  team: Team,
  index: number,
  fiche: Licencie,
  at: string,
): Team {
  const sortant = team.players[index];
  if (!sortant) return team;
  const entrant: Player = {
    name: fiche.name,
    ...(fiche.licence ? { licence: fiche.licence } : {}),
    ...(fiche.club ? { club: fiche.club } : {}),
    ...(fiche.comite ? { comite: fiche.comite } : {}),
  };
  const trace: Remplacement = {
    index,
    avant: { name: sortant.name, licence: sortant.licence },
    apres: { name: entrant.name, licence: entrant.licence },
    at,
  };
  return {
    ...team,
    players: team.players.map((p, i) => (i === index ? entrant : p)),
    remplacements: [...(team.remplacements ?? []), trace],
  };
}

export function lireLicenceAuDepot(
  licence: string,
  teams: Team[],
  equipeOuverteId: string | null,
  fiches?: Map<string, Licencie>,
): LectureDepot {
  const num = licence.trim();
  const ouverte = teams.find((t) => t.id === equipeOuverteId);
  const index = ouverte?.players.findIndex((p) => p.licence === num) ?? -1;
  if (index >= 0) return { type: 'equipe_ouverte', index };
  const ailleurs = chercherEquipeParLicence(teams, num);
  if (ailleurs) return { type: 'autre_equipe', team: ailleurs };
  return { type: 'pas_inscrit', fiche: fiches?.get(num) };
}
