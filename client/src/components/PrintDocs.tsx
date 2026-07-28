/**
 * Documents imprimables du manuel « Gestion Concours » : listes d'inscrits et
 * de capitaines (§3.B.9.A et B), bilan des paiements (§3.B.9.D), résultats
 * pour la presse (§3.D.1.B.4.6), impression des absents (§3.D.1.B.4.7) et
 * graphique du tableau (§3.D.1.B.4.4).
 *
 * `PrintPage` porte l'enveloppe (en-tête, barre d'outils, lancement de
 * l'impression) ; ici on ne fait que la mise en page de chaque document.
 */
import type { Concours, Match, Poule, Team } from '@shared';
import {
  dureeMinutes,
  libelleClubs,
  partiesLancees,
  presseSections,
  trierEquipes,
  type PresseSection,
  type TriEquipes,
} from '@shared';
import { matchLabel, sideName } from '../lib/matchLabel';

const maj = (s: string): string => s.toLocaleUpperCase('fr-FR');

/** Une ligne joueur à la manière fédérale : licence, NOM, (club). */
function LigneJoueur({ team, index }: { team: Team; index: number }) {
  const p = team.players[index];
  if (!p) return null;
  return (
    <div className="presse-joueur">
      {p.licence && <span className="presse-licence">{p.licence}</span>}{' '}
      <span className="presse-nom">{maj(p.name)}</span>
      {(p.club ?? team.club) && <span className="presse-club"> ({p.club ?? team.club})</span>}
    </div>
  );
}

function BlocEquipe({ team, perdant }: { team: Team | null; perdant: boolean }) {
  if (!team) return <div className="presse-equipe">—</div>;
  return (
    <div className={perdant ? 'presse-equipe presse-elimine' : 'presse-equipe'}>
      <span className="presse-dossard">n°{team.number}</span>
      {team.players.map((_, i) => (
        <LigneJoueur key={i} team={team} index={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Listes d'engagés                                                    */
/* ------------------------------------------------------------------ */

export function ListeEngages({
  teams,
  tri,
  capitainesSeulement,
}: {
  teams: Team[];
  tri: TriEquipes;
  /** Liste des capitaines : une ligne par équipe, le premier joueur. */
  capitainesSeulement: boolean;
}) {
  const ordonnees = trierEquipes(teams, tri);
  return (
    <div className="print-liste">
      <h2>{capitainesSeulement ? 'Liste des capitaines' : 'Liste des équipes engagées'}</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>{capitainesSeulement ? 'Capitaine' : 'Joueurs'}</th>
            <th>Licence{capitainesSeulement ? '' : 's'}</th>
            <th>Club</th>
            <th>Forfait</th>
          </tr>
        </thead>
        <tbody>
          {ordonnees.map((t) => {
            const joueurs = capitainesSeulement ? t.players.slice(0, 1) : t.players;
            return (
              <tr key={t.id}>
                <td className="cell-number">{t.number}</td>
                <td>{joueurs.map((p) => maj(p.name)).join(' / ')}</td>
                <td>{joueurs.map((p) => p.licence ?? '—').join(' / ')}</td>
                <td>{libelleClubs(t.players, t.club)}</td>
                <td>{t.forfait ? 'oui' : ''}</td>
              </tr>
            );
          })}
          {ordonnees.length === 0 && (
            <tr>
              <td colSpan={5}>Aucune équipe inscrite.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="print-total">
        {ordonnees.length} équipe{ordonnees.length > 1 ? 's' : ''} ·{' '}
        {ordonnees.reduce((n, t) => n + t.players.length, 0)} joueurs
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bilan des paiements                                                 */
/* ------------------------------------------------------------------ */

export function BilanPaiements({
  concours,
  teams,
  tri,
}: {
  concours: Concours;
  teams: Team[];
  tri: TriEquipes;
}) {
  const mise = concours.miseParEquipe ?? 0;
  const ordonnees = trierEquipes(teams, tri);
  const regles = ordonnees.filter((t) => t.paid);
  const euros = (n: number) => `${n.toLocaleString('fr-FR')} €`;

  return (
    <div className="print-liste">
      <h2>Bilan des paiements</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Équipe</th>
            <th>Club</th>
            <th>Réglé</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          {ordonnees.map((t) => (
            <tr key={t.id}>
              <td className="cell-number">{t.number}</td>
              <td>{t.players.map((p) => maj(p.name)).join(' / ')}</td>
              <td>{libelleClubs(t.players, t.club)}</td>
              <td>{t.paid ? 'oui' : 'non'}</td>
              <td>{t.paid && mise > 0 ? euros(mise) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="print-bilan">
        <li>
          Équipes réglées : {regles.length} / {ordonnees.length}
        </li>
        {mise > 0 && (
          <>
            <li>Mise par équipe : {euros(mise)}</li>
            <li>
              <strong>Total encaissé : {euros(regles.length * mise)}</strong>
            </li>
            <li>Reste à encaisser : {euros((ordonnees.length - regles.length) * mise)}</li>
          </>
        )}
      </ul>
      {mise === 0 && (
        <p className="hint">
          Aucune mise renseignée sur ce concours : seuls les règlements sont listés.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Absents                                                             */
/* ------------------------------------------------------------------ */

export function ListeAbsents({ teams }: { teams: Team[] }) {
  const absents = trierEquipes(
    teams.filter((t) => t.forfait),
    'numero',
  );
  return (
    <div className="print-liste">
      <h2>Équipes absentes</h2>
      {absents.length === 0 ? (
        <p>Aucune équipe absente : toutes les équipes inscrites sont présentes.</p>
      ) : (
        <>
          <table className="print-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Joueurs</th>
                <th>Licences</th>
                <th>Club</th>
              </tr>
            </thead>
            <tbody>
              {absents.map((t) => (
                <tr key={t.id}>
                  <td className="cell-number">{t.number}</td>
                  <td>{t.players.map((p) => maj(p.name)).join(' / ')}</td>
                  <td>{t.players.map((p) => p.licence ?? '—').join(' / ')}</td>
                  <td>{libelleClubs(t.players, t.club)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="print-total">
            {absents.length} équipe{absents.length > 1 ? 's' : ''} absente
            {absents.length > 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Résultats pour la presse                                            */
/* ------------------------------------------------------------------ */

export function ResultatsPresse({
  sections,
  toursMasques,
}: {
  sections: PresseSection[];
  toursMasques: Set<number>;
}) {
  const visibles = sections.filter((s) => !toursMasques.has(s.round));
  return (
    <div className="print-presse">
      <h2>Résultats pour la presse</h2>
      {visibles.length === 0 && <p>Aucun tour sélectionné, ou aucune partie jouée.</p>}
      {visibles.map((section) => (
        <section key={section.round} className="presse-section">
          <h3>{section.label}</h3>
          {section.matches.map((m) => (
            <div key={m.id} className="presse-partie">
              <BlocEquipe team={m.teamA} perdant={m.gagnant === 'B'} />
              <div className="presse-score">
                {m.scoreA} – {m.scoreB}
              </div>
              <BlocEquipe team={m.teamB} perdant={m.gagnant === 'A'} />
            </div>
          ))}
        </section>
      ))}
      <p className="hint print-presse-legende">
        Les équipes éliminées sont en grisé barré.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Graphique du tableau                                               */
/* ------------------------------------------------------------------ */

export function GraphiqueTableau({
  teams,
  matches,
  titre,
  stage,
}: {
  teams: Team[];
  matches: Match[];
  titre: string;
  stage: 'principal' | 'consolante' | 'complementaire';
}) {
  const sections = presseSections(teams, matches, stage);
  const parTour = new Map(sections.map((s) => [s.round, s]));
  const tours = [...new Set(matches.filter((m) => m.stage === stage).map((m) => m.round))].sort(
    (a, b) => a - b,
  );
  if (tours.length === 0) return null;

  const nom = (t: Team | null) => (t ? `n°${t.number} ${maj(t.players[0]?.name ?? '')}` : '…');

  return (
    <div className="print-graphique">
      <h2>{titre}</h2>
      {tours.map((round) => {
        const section = parTour.get(round);
        return (
          <section key={round} className="print-graphique-tour">
            <h3>{section?.label ?? `Tour ${round + 1}`}</h3>
            <table className="print-table">
              <tbody>
                {(section?.matches ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className={m.gagnant === 'A' ? 'presse-gagnant' : ''}>{nom(m.teamA)}</td>
                    <td className="print-score-cell">
                      {m.scoreA} – {m.scoreB}
                    </td>
                    <td className={m.gagnant === 'B' ? 'presse-gagnant' : ''}>{nom(m.teamB)}</td>
                    <td>{m.terrain ? `Terrain ${m.terrain}` : ''}</td>
                  </tr>
                ))}
                {(section?.matches ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4}>Tour non joué.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parties lancées et retards                                          */
/* ------------------------------------------------------------------ */

/**
 * Relevé des heures d'annonce (manuel §3.D.1.B.3) : l'arbitre s'en sert pour
 * les pénalités de retard. Les parties signalées en retard sont mises en
 * évidence, et la durée est comptée jusqu'à maintenant pour celles qui
 * tournent encore.
 */
export function PartiesLancees({
  teams,
  poules,
  matches,
  maintenant,
}: {
  teams: Team[];
  poules: Poule[];
  matches: Match[];
  maintenant: string;
}) {
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const lancees = partiesLancees(matches);
  const heure = (iso: string) =>
    new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="print-liste">
      <h2>Parties lancées</h2>
      <p className="hint">
        Heure d'annonce de chaque partie, justificatif des pénalités de retard.
      </p>
      {lancees.length === 0 ? (
        <p>Aucune partie annoncée pour le moment.</p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th>Heure</th>
              <th>Partie</th>
              <th>Équipes</th>
              <th>Terrain</th>
              <th>Durée</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {lancees.map((m) => (
              <tr key={m.id} className={m.retard && !m.done ? 'print-retard' : ''}>
                <td>{heure(m.lanceeA!)}</td>
                <td>{matchLabel(m, poules, matches)}</td>
                <td>
                  {sideName(m, 'A', teamsById)} – {sideName(m, 'B', teamsById)}
                </td>
                <td>{m.terrain ?? ''}</td>
                <td>{dureeMinutes(m.lanceeA!, maintenant)} min</td>
                <td>
                  {m.done
                    ? `terminée ${m.scoreA}-${m.scoreB}`
                    : m.retard
                      ? 'RETARD SIGNALÉ'
                      : 'en cours'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="print-total">
        {lancees.length} partie{lancees.length > 1 ? 's' : ''} annoncée
        {lancees.length > 1 ? 's' : ''} ·{' '}
        {lancees.filter((m) => m.retard && !m.done).length} en retard
      </p>
    </div>
  );
}
