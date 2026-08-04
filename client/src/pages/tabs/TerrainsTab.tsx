import { useEffect, useMemo, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import {
  classerTerrainsLibres,
  dureeMinutes,
  partiesEnRetard,
  terrainBoard,
  waitingMatches,
} from '@shared';
import {
  autoAssignTerrainsAction,
  setMatchRetard,
  setMatchTerrain,
  setNbTerrains,
  setTerrainBloque,
} from '../../db/actions';
import { Link } from 'react-router-dom';
import { matchLabel, sideName } from '../../lib/matchLabel';

interface Props {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

/**
 * Plan des terrains : plateau visuel (libre / occupé), file des parties en
 * attente, et affectation automatique aux terrains libres. Les terrains se
 * libèrent tout seuls dès qu'un score est saisi (la partie n'est plus live).
 */
/** Horloge rafraîchie : les durées affichées doivent vieillir toutes seules. */
function useMaintenant(intervalleMs = 30000): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), intervalleMs);
    return () => clearInterval(t);
  }, [intervalleMs]);
  return now;
}

/** « 14:32 · 12 min » — heure d'annonce et durée écoulée. */
function HeureAnnonce({ match, maintenant }: { match: Match; maintenant: string }) {
  if (!match.lanceeA) return null;
  const heure = new Date(match.lanceeA).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const minutes = dureeMinutes(match.lanceeA, maintenant);
  return (
    <span className="terrain-heure" title="Heure d'annonce de la partie">
      ⏱ {heure}
      {minutes > 0 && <em> · {minutes} min</em>}
    </span>
  );
}

/**
 * Terrains proposés pour lancer une partie, en deux groupes comme l'écran
 * fédéral « Match à lancer » (manuel §3.D, copie d'écran p.45) : ceux
 * qu'aucune des deux équipes n'a joués, puis — à part, et dit tel quel — les
 * « libres mais utilisés par l'un des 2 ».
 *
 * Les seconds restent cliquables : l'organisateur qui n'a plus le choix doit
 * pouvoir lancer, il doit seulement savoir ce qu'il fait.
 */
function BoutonsTerrain({
  match,
  libres,
  matches,
}: {
  match: Match;
  libres: number[];
  matches: Match[];
}) {
  const { neufs, dejaJoues } = classerTerrainsLibres(
    libres,
    matches,
    match.teamAId,
    match.teamBId,
  );
  const bouton = (n: number, deja: boolean) => (
    <button
      key={n}
      className={`btn btn-sm${deja ? ' btn-terrain-deja' : ''}`}
      onClick={() => void setMatchTerrain(match, n)}
      title={deja ? 'Libre, mais une des deux équipes y a déjà joué' : undefined}
    >
      T{n}
    </button>
  );
  return (
    <span className="waiting-assign no-print">
      {neufs.slice(0, 6).map((n) => bouton(n, false))}
      {dejaJoues.length > 0 && (
        <span className="waiting-deja" title="Libres mais utilisés par l'un des 2">
          {neufs.length > 0 && <em>déjà joués :</em>}
          {dejaJoues.slice(0, 6).map((n) => bouton(n, true))}
        </span>
      )}
    </span>
  );
}

export function TerrainsTab({ concours, teams, poules, matches }: Props) {
  const [busy, setBusy] = useState(false);
  const maintenant = useMaintenant();
  const retards = partiesEnRetard(matches);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const bloques = concours.terrainsBloques ?? [];
  const board = terrainBoard(
    matches,
    concours.nbTerrains,
    concours.decalageTerrain,
    bloques,
  );
  const waiting = waitingMatches(matches);
  const occupied = board.filter((t) => t.match).length;
  const libres = board.filter((t) => !t.match && !t.bloque).map((t) => t.number);
  const free = libres.length;

  const label = (m: Match) => matchLabel(m, poules, matches);

  return (
    <div className="tab-content">
      <div className="toolbar no-print">
        <span className="toolbar-info">
          {occupied} / {concours.nbTerrains} terrain{concours.nbTerrains > 1 ? 's' : ''} occupé
          {occupied > 1 ? 's' : ''} · {waiting.length} partie{waiting.length > 1 ? 's' : ''} en
          attente
        </span>
        <span className="toolbar-actions">
          <button
            className="btn btn-primary"
            disabled={busy || free === 0 || waiting.length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await autoAssignTerrainsAction(concours);
              } finally {
                setBusy(false);
              }
            }}
          >
            🎯 Affecter automatiquement
          </button>
          <span className="terrain-nb no-print">
            <button
              className="btn btn-sm"
              title="Retirer un terrain"
              disabled={concours.nbTerrains <= 1}
              onClick={() => void setNbTerrains(concours, concours.nbTerrains - 1)}
            >
              −
            </button>
            <span>{concours.nbTerrains} terrains</span>
            <button
              className="btn btn-sm"
              title="Ajouter un terrain"
              onClick={() => void setNbTerrains(concours, concours.nbTerrains + 1)}
            >
              +
            </button>
          </span>
          <Link
            className="btn btn-ghost btn-sm"
            to={`/concours/${concours.id}/imprimer/parties-lancees`}
            title="Relevé des heures d'annonce, pour l'arbitre"
          >
            ⏱ Parties lancées
          </Link>
        </span>
      </div>

      {retards.length > 0 && (
        <section className="retards-panel no-print">
          <h3>⏰ Retards signalés ({retards.length})</h3>
          <ul>
            {retards.map((m) => (
              <li key={m.id}>
                <span className="waiting-label">{label(m)}</span>
                <span className="waiting-teams">
                  {sideName(m, 'A', teamsById)} <em>–</em> {sideName(m, 'B', teamsById)}
                </span>
                <HeureAnnonce match={m} maintenant={maintenant} />
                <button
                  className="btn btn-sm"
                  title="Le résultat a été annoncé : lever le retard"
                  onClick={() => void setMatchRetard(m, false)}
                >
                  ↩ lever
                </button>
              </li>
            ))}
          </ul>
          <p className="hint">
            L'heure d'annonce sert de justificatif à l'arbitre. Le retard se lève de lui-même dès
            que le score est saisi.
          </p>
        </section>
      )}

      <div className="terrain-board">
        {board.map((t) => (
          <div
            key={t.number}
            className={`terrain-cell${
              t.bloque ? ' terrain-bloque' : t.match ? ' terrain-busy' : ' terrain-free'
            }`}
          >
            <div className="terrain-num">
              Terrain {t.number}
              <button
                className="btn-icon no-print"
                title={t.bloque ? 'Remettre ce terrain en service' : 'Bloquer ce terrain'}
                onClick={() => void setTerrainBloque(concours, t.number, !t.bloque)}
              >
                {t.bloque ? '🔓' : '🔒'}
              </button>
            </div>
            {t.match ? (
              <div className="terrain-match">
                <span className="terrain-match-label">{label(t.match)}</span>
                <span className="terrain-vs">
                  {sideName(t.match, 'A', teamsById)}
                  <em> contre </em>
                  {sideName(t.match, 'B', teamsById)}
                </span>
                <HeureAnnonce match={t.match} maintenant={maintenant} />
                <span className="terrain-actions no-print">
                  <button
                    className={t.match.retard ? 'btn-icon btn-icon-danger' : 'btn-icon'}
                    title={
                      t.match.retard
                        ? 'Lever le retard'
                        : 'Signaler un retard : le résultat n\'a pas été annoncé'
                    }
                    onClick={() => void setMatchRetard(t.match!, !t.match!.retard)}
                  >
                    ⏰
                  </button>
                  <button
                    className="btn-icon"
                    title="Libérer ce terrain"
                    onClick={() => void setMatchTerrain(t.match!, null)}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ) : t.bloque ? (
              <div className="terrain-empty">Hors service</div>
            ) : (
              <div className="terrain-empty">Libre</div>
            )}
          </div>
        ))}
      </div>

      {waiting.length > 0 && (
        <section className="waiting-list">
          <h3>⏳ En attente d'un terrain ({waiting.length})</h3>
          <ul>
            {waiting.map((m) => (
              <li key={m.id}>
                <span className="waiting-label">{label(m)}</span>
                <span className="waiting-teams">
                  {sideName(m, 'A', teamsById)} <em>–</em> {sideName(m, 'B', teamsById)}
                </span>
                {free > 0 && <BoutonsTerrain match={m} libres={libres} matches={matches} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
