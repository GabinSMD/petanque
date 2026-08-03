/**
 * Bilan de validité des inscriptions avant le tirage (manuel §3.B.6).
 *
 * « Le contrôle de validité des inscriptions est effectué systématiquement lors
 * du tirage. […] Un rapport de validité des inscriptions s'affiche. Cliquer sur
 * "Imprimer Bilan" pour rectifier les anomalies »
 *
 * Le contrôle par équipe existait déjà (`controlerEquipe`, §3.C), mais il vivait
 * dans son écran : on pouvait tirer les poules d'un concours officiel sans
 * l'avoir jamais ouvert. Le manuel en fait une étape du tirage — le moment où
 * les équipes sont encore là et où une licence se corrige.
 *
 * Ce module ne juge rien de nouveau : il rassemble. Ce qu'il rassemble est fait
 * pour être parcouru à la table de marque, dossard par dossard, en cherchant un
 * nom à appeler — donc les équipes en règle n'y figurent pas, et une équipe
 * fautive ne liste que ses joueurs fautifs.
 *
 * Il n'interdit pas de tirer : le manuel non plus. L'organisateur reste maître,
 * mais il a vu.
 */
import type { BesoinTerrains } from './besoinTerrains';
import type { AnomalieEquipe, ChampLicence, ControleEquipe } from './licences';

export interface JoueurEnAnomalie {
  name: string;
  licence?: string;
  anomalies: ChampLicence[];
  /** Licence saisie mais absente du fichier des licenciés. */
  inconnu: boolean;
}

export interface LigneBilanTirage {
  /** Dossard : l'ordre des étiquettes et des appels. */
  number: number;
  /** Uniquement les joueurs en faute. */
  joueurs: JoueurEnAnomalie[];
  /** Fautes de composition : mixité, homogénéité, mutés, hors UE. */
  anomaliesEquipe: AnomalieEquipe[];
}

export interface BilanAvantTirage {
  /** Équipes contrôlées. */
  total: number;
  conformes: number;
  /**
   * Joueurs dont la licence est saisie mais introuvable dans le fichier. Compté
   * à part : un fichier daté n'est pas une licence périmée, et ce n'est pas la
   * même conversation avec le joueur.
   */
  inconnues: number;
  /** Équipes en anomalie, par dossard croissant. */
  lignes: LigneBilanTirage[];
  /**
   * Besoin en terrains, comme le « Rapport avant tirage » du manuel l'annonce
   * (« Vous aurez Besoin de 16 Terrains au maximum »). Absent quand la question
   * n'a pas de sens — tir de précision, effectif que les poules refusent.
   */
  terrains?: BesoinTerrains;
}

export function bilanAvantTirage(
  equipes: { number: number; controle: ControleEquipe }[],
  terrains?: BesoinTerrains,
): BilanAvantTirage {
  const lignes: LigneBilanTirage[] = [];
  let conformes = 0;
  let inconnues = 0;

  for (const { number, controle } of equipes) {
    if (controle.conforme) {
      conformes += 1;
      continue;
    }
    const joueurs = controle.joueurs
      .filter((j) => j.anomalies.length > 0 || j.inconnu)
      .map((j) => ({
        name: j.name,
        licence: j.licence,
        anomalies: j.anomalies,
        inconnu: j.inconnu,
      }));
    inconnues += joueurs.filter((j) => j.inconnu).length;
    lignes.push({ number, joueurs, anomaliesEquipe: controle.anomaliesEquipe });
  }

  return {
    total: equipes.length,
    conformes,
    inconnues,
    lignes: lignes.sort((a, b) => a.number - b.number),
    terrains,
  };
}
