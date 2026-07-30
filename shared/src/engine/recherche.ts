/**
 * Retrouver une équipe pendant le concours (manuel §3.D.1.D, « la loupe »).
 *
 * « en mettant le nom du joueur, cette fonction vous permet de connaître son
 * numéro d'équipe pour la rechercher dans le graphique » — et zone 36 de l'écran
 * de préparation, « La loupe recherche : permet de rechercher le n° d'équipe
 * avec le nom du joueur ».
 *
 * C'est la question la plus posée à la table de marque : « je suis dans quelle
 * poule ? ». Sur cent-vingt équipes, la seule réponse était de faire défiler la
 * liste. On cherche donc comme on entend : sans accents, sans casse, sur un
 * début de nom — mais le **dossard** se cherche exactement, parce qu'au micro on
 * appelle un numéro précis et que « 1 » ne doit pas rendre l'équipe 12.
 */
import type { Team } from '../types';

/** Ce qui a fait mouche. Sert à afficher pourquoi une équipe ressort. */
export type MotifRecherche = 'dossard' | 'joueur' | 'licence' | 'club';

export interface Trouvaille {
  team: Team;
  motif: MotifRecherche;
  /** Joueur concerné, quand c'est son nom ou sa licence qui a répondu. */
  joueur?: string;
}

/** Sans accents ni casse : on tape ce qu'on entend. */
const sansAccents = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('fr-FR');

export function chercherEquipes(teams: Team[], requete: string): Trouvaille[] {
  const brut = requete.trim();
  if (brut.length === 0) return [];
  const q = sansAccents(brut);
  const dossardCherche = /^\d+$/.test(brut) ? Number(brut) : null;

  const trouvailles: Trouvaille[] = [];
  for (const team of teams) {
    // Le dossard d'abord : c'est la recherche la plus fréquente et la plus
    // précise. Une requête numérique ne cherche que ça — chercher aussi dans
    // les licences ferait ressortir des équipes sans rapport.
    if (dossardCherche !== null) {
      if (team.number === dossardCherche) {
        trouvailles.push({ team, motif: 'dossard' });
        continue;
      }
      // Une licence ne se cherche pas par un chiffre isolé : « 1 » ferait
      // ressortir toutes les licences qui en contiennent un. On exige un début
      // de licence, et assez de chiffres pour que ce soit une intention.
      const parLicence =
        brut.length >= 4
          ? team.players.find((p) => p.licence && p.licence.startsWith(brut))
          : undefined;
      if (parLicence) trouvailles.push({ team, motif: 'licence', joueur: parLicence.name });
      continue;
    }

    const parNom = team.players.find((p) => sansAccents(p.name).includes(q));
    if (parNom) {
      trouvailles.push({ team, motif: 'joueur', joueur: parNom.name });
      continue;
    }
    const clubs = [team.club, ...team.players.map((p) => p.club)].filter(
      (c): c is string => Boolean(c),
    );
    if (clubs.some((c) => sansAccents(c).includes(q))) {
      trouvailles.push({ team, motif: 'club' });
    }
  }

  return trouvailles.sort((a, b) => a.team.number - b.team.number);
}
