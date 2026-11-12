import type { Team } from '@shared';
import { libelleClubs } from '@shared';

interface Props {
  team: Team | undefined | null;
  bye?: boolean;
  /** Nom compact (sans club) pour les tableaux serrés. */
  compact?: boolean;
  /**
   * Écart de points de la partie, signé (manuel §3.D.14 : « Différence de points
   * de la partie indiquée à coté de l'équipe »). Affiché entre parenthèses après
   * le dossard, comme sur le graphique fédéral.
   */
  ecart?: number;
  /**
   * Ouvre la fiche de l'équipe (manuel §3.D.1.C, « clic droit sur le n°
   * d'équipe dans le graphique »). Fourni, le dossard devient un bouton : une
   * cible à part, atteignable au clavier, qui ne se confond pas avec la saisie
   * du score posée sur la partie.
   */
  onFiche?: (team: Team) => void;
}

export function teamDisplayName(team: Team): string {
  return team.players.map((p) => p.name).join(' / ');
}

export function TeamLabel({ team, bye, compact, ecart, onFiche }: Props) {
  if (bye) return <span className="team-label team-bye">Exempt</span>;
  if (!team) return <span className="team-label team-tbd">À déterminer</span>;
  return (
    <span className={`team-label${team.forfait ? ' team-forfait' : ''}`}>
      {onFiche ? (
        <button
          type="button"
          className="team-number team-number-fiche"
          title="Ouvrir la fiche de l'équipe"
          aria-label={`Fiche de l'équipe n°${team.number}`}
          onClick={(e) => {
            e.stopPropagation();
            onFiche(team);
          }}
          // Le geste du logiciel fédéral est le clic droit : on le garde pour
          // qui l'a dans les doigts.
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFiche(team);
          }}
        >
          {team.number}
        </button>
      ) : (
        <span className="team-number">{team.number}</span>
      )}
      {/* `15 (7)` / `16 (-7)` — **sans** plus devant les positifs : la planche
          écrit `(7)`, `(11)`, `(13)`, et ne signe que les négatifs. Un `(+7)`
          serait notre invention. Et `(0)` plutôt qu'un tiret sur les tours à
          venir, là encore comme le manuel. */}
      {ecart !== undefined && (
        <span className="team-ecart" title="Écart de points de cette partie">
          ({ecart})
        </span>
      )}
      <span className="team-names">
        {teamDisplayName(team)}
        {team.forfait && ' (FF)'}
      </span>
      {!compact && libelleClubs(team.players, team.club) && (
        <span className="team-club">{libelleClubs(team.players, team.club)}</span>
      )}
    </span>
  );
}
