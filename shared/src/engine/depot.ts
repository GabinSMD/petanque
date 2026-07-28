/**
 * Dépôt des licences (manuel « Gestion Concours » §3.C).
 *
 * Avant un concours officiel, chaque capitaine remet les licences de son
 * équipe : la table de marque les contrôle, puis valide le dépôt. L'écran de
 * statistiques du logiciel fédéral sert à répondre à une seule question —
 * quelles équipes n'ont pas encore présenté leurs licences.
 */
import type { Team } from '../types';

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
