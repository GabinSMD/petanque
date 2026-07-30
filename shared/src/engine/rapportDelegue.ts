/**
 * Rapport du délégué (manuel « Gestion Concours » §3.D.15, document p.112).
 *
 * Le classeur fédéral des phases finales SWISS produit un
 * « RESULTAT DU CONCOURS (à remplir par le délégué) ». La copie d'écran du
 * manuel, extraite en pleine résolution, le donne en entier : colonnes
 * **N° Licence / Nom, Prénom (en lettre majuscule) / Association ou Club /
 * N° Dép. / N° d'équipe**, et des sections dans l'ordre
 * « Perdants 1/8 finale », « Perdants ¼ finale », « Perdants ½ finale »,
 * « Finaliste », « Champion ».
 *
 * C'est donc notre rapport d'arbitrage (§3.D.1.B.4.5) à trois différences près,
 * et rien de plus :
 *
 *  - l'ordre est **inversé** : du perdant le plus précoce au champion, là où
 *    l'arbitrage part du vainqueur ;
 *  - le vainqueur s'appelle « Champion » ;
 *  - une colonne **département**, absente chez nous.
 *
 * Le département n'a pas besoin d'être saisi : les six numéros lisibles sur le
 * document le confirment, les trois premiers chiffres d'une licence fédérale
 * sont le code du comité — 07411559 → 074, 02604451 → 026, 00101957 → 001. Sur
 * un numéro d'une autre forme, la colonne reste vide : le délégué la remplira
 * à la main plutôt que de lire un département inventé.
 */
import type { Match, Team } from '../types';
import { arbitrageReport } from './arbitrage';

export interface DelegueJoueurRow {
  licence?: string;
  name: string;
  club?: string;
  /** Code du comité départemental, déduit de la licence. */
  departement?: string;
}

export interface DelegueTeamRow {
  number: number;
  club?: string;
  players: DelegueJoueurRow[];
}

export interface DelegueSection {
  label: string;
  teams: DelegueTeamRow[];
}

export interface RapportDelegue {
  titre: string;
  sections: DelegueSection[];
}

/** Les trois premiers chiffres d'une licence fédérale à huit chiffres. */
export function departementDeLicence(licence: string | undefined): string | undefined {
  if (!licence || !/^\d{8}$/.test(licence)) return undefined;
  return licence.slice(0, 3);
}

/** Libellés du document fédéral, à partir de ceux du rapport d'arbitrage. */
const LABELS: Record<string, string> = {
  Vainqueur: 'Champion',
  Finaliste: 'Finaliste',
  'Perdants 1/2 finale': 'Perdants ½ finale',
  'Perdants 1/4 de finale': 'Perdants ¼ finale',
  'Perdants 8ème de finale': 'Perdants 1/8 finale',
};

export function rapportDelegue(teams: Team[], matches: Match[]): RapportDelegue {
  const arbitrage = arbitrageReport(teams, matches);
  const sections: DelegueSection[] = arbitrage.sections.map((s) => ({
    label: LABELS[s.label] ?? s.label,
    teams: s.teams.map((t) => ({
      number: t.number,
      club: t.club,
      players: t.players.map((p) => ({
        licence: p.licence,
        name: p.name,
        club: p.club,
        departement: departementDeLicence(p.licence),
      })),
    })),
  }));

  return {
    titre: 'Résultat du concours (à remplir par le délégué)',
    // L'ordre du document : le champion en dernier, comme sur la feuille que le
    // délégué signe.
    sections: sections.reverse(),
  };
}
