import { CircleCheck, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import {
  campNumeros,
  declarableMatches,
  matchLabel,
  pendingMatchesForTeam,
  playedMatchesForTeam,
  teamSideInMatch,
} from '../lib/matchLabel';
import { formateurTerrain } from '../lib/terrain';
import { ScoreForm } from './ScoreForm';
import { TeamLabel } from './TeamLabel';

/** Ce que l'on tape dans la saisie rapide : un dossard, ou un terrain. */
type ModeRecherche = 'equipe' | 'terrain';

/**
 * Le choix se mémorise **par appareil** : la tablette posée au bord des jeux
 * cherche par terrain, celle de la table de marque par dossard. Le stockage
 * peut manquer (navigation privée) : on retombe alors sur le dossard.
 */
const CLE_MODE = 'petanque.saisieRapide.mode';

function lireMode(): ModeRecherche {
  try {
    return localStorage.getItem(CLE_MODE) === 'terrain' ? 'terrain' : 'equipe';
  } catch {
    return 'equipe';
  }
}

function retenirMode(mode: ModeRecherche): void {
  try {
    localStorage.setItem(CLE_MODE, mode);
  } catch {
    // Sans stockage, le choix vaut pour la page ouverte : c'est suffisant.
  }
}

/**
 * Demande, venue d'un autre écran (une carte de l'onglet Terrains), d'ouvrir
 * la saisie de la partie d'un terrain. `detail.terrain` est le libellé du
 * terrain tel qu'il s'affiche (« 5 » ou « D »).
 */
export const EVENEMENT_SAISIE_TERRAIN = 'treizero:saisie-terrain';

export function demanderSaisieTerrain(terrain: string): void {
  window.dispatchEvent(new CustomEvent(EVENEMENT_SAISIE_TERRAIN, { detail: { terrain } }));
}

/**
 * Saisie rapide par numéro de dossard : indispensable dès qu'il y a
 * beaucoup d'équipes (64+). On tape un numéro, la partie en cours de
 * l'équipe s'affiche et on saisit le score sans chercher dans les poules.
 *
 * Au clavier seul, `9 ⏎ 7 ⏎` suffit quand l'équipe n'a qu'une partie à
 * saisir : la première Entrée la désigne gagnante à 13 (le geste du manuel,
 * p.46), la seconde enregistre le score du perdant.
 */
export function QuickScore({
  concours,
  teams,
  poules,
  matches,
}: {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}) {
  const [num, setNum] = useState('');
  const [mode, setMode] = useState<ModeRecherche>(lireMode);
  /** Dernière partie saisie ici : de quoi confirmer, et corriger sans chercher. */
  const [derniere, setDerniere] = useState<string | null>(null);
  /** Vainqueur désigné par Entrée, transmis à la ligne de la partie. */
  const [demande, setDemande] = useState<{
    matchId: string;
    camp: 'a' | 'b';
    jeton: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocRef = useRef<HTMLDivElement>(null);
  const byNumber = useMemo(() => new Map(teams.map((t) => [t.number, t])), [teams]);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const terrain = formateurTerrain(concours);

  // Une carte de l'onglet Terrains touchée : on passe en recherche par terrain
  // le temps de cette saisie, sans changer le choix retenu pour l'appareil.
  useEffect(() => {
    const ouvrir = (e: Event) => {
      const t = (e as CustomEvent<{ terrain: string }>).detail?.terrain;
      if (!t) return;
      setMode('terrain');
      setNum(t);
      setDemande(null);
      blocRef.current?.scrollIntoView({ block: 'nearest' });
      inputRef.current?.focus();
    };
    window.addEventListener(EVENEMENT_SAISIE_TERRAIN, ouvrir);
    return () => window.removeEventListener(EVENEMENT_SAISIE_TERRAIN, ouvrir);
  }, []);

  // N'apparaît que s'il y a des parties à saisir (poules / tableau / rondes).
  const declarables = declarableMatches(matches);
  if (declarables.length === 0) return null;

  const saisie = num.trim();
  const vide = saisie === '';

  // Recherche par dossard.
  const parsed = vide || mode !== 'equipe' ? null : Number(saisie);
  const team =
    parsed !== null && Number.isInteger(parsed) ? byNumber.get(parsed) : undefined;
  const pending = team ? pendingMatchesForTeam(team.id, matches) : [];
  const jouees = team ? playedMatchesForTeam(team.id, matches, 2) : [];

  // Recherche par terrain : seulement les parties en cours sur ce terrain.
  const surTerrain =
    mode === 'terrain' && !vide
      ? declarables.filter(
          (m) =>
            m.terrain != null &&
            m.terrain >= 1 &&
            terrain(m.terrain).toLowerCase() === saisie.toLowerCase(),
        )
      : [];
  const terrainEnLettres = concours.libelleTerrains === 'lettre';

  const changerMode = (m: ModeRecherche) => {
    setMode(m);
    retenirMode(m);
    setNum('');
    setDemande(null);
    inputRef.current?.focus();
  };

  const apresSaisie = (m: Match) => {
    setDerniere(m.id);
    setNum('');
    setDemande(null);
    inputRef.current?.focus();
  };

  const ligne = (m: Match, opts: { jouee?: boolean } = {}) => (
    <QuickScoreRow
      key={m.id}
      concours={concours}
      match={m}
      label={matchLabel(m, poules, matches)}
      teamsById={teamsById}
      cible={team?.id}
      afficherFace={mode === 'terrain'}
      demande={demande && demande.matchId === m.id ? demande : undefined}
      jouee={opts.jouee}
      onSaved={() => apresSaisie(m)}
    />
  );

  return (
    <div className="quick-score no-print" data-tour="quick-score" ref={blocRef}>
      <form
        className="quick-score-bar"
        onSubmit={(e) => {
          e.preventDefault();
          // Une seule partie à saisir : Entrée désigne l'équipe tapée gagnante.
          // Au vainqueur seul, il n'y a pas de score à préremplir ; on laisse
          // les deux boutons faire.
          const seule = pending.length === 1 ? pending[0] : undefined;
          if (team && seule && !concours.vainqueurSeul) {
            const m = seule;
            const cote = teamSideInMatch(m, team.id);
            if (cote) {
              setDemande({ matchId: m.id, camp: cote === 'A' ? 'a' : 'b', jeton: Date.now() });
              return;
            }
          }
          inputRef.current?.select();
        }}
      >
        <span className="quick-score-mode" role="group" aria-label="Chercher par">
          <button
            type="button"
            className={mode === 'equipe' ? 'btn btn-sm actif' : 'btn btn-sm btn-ghost'}
            aria-pressed={mode === 'equipe'}
            onClick={() => changerMode('equipe')}
          >
            Équipe
          </button>
          <button
            type="button"
            className={mode === 'terrain' ? 'btn btn-sm actif' : 'btn btn-sm btn-ghost'}
            aria-pressed={mode === 'terrain'}
            onClick={() => changerMode('terrain')}
          >
            Terrain
          </button>
        </span>
        <label>
          <Zap className="ic" aria-hidden />{' '}
          {mode === 'equipe' ? "Saisie rapide — n° d'équipe" : 'Saisie rapide — n° de terrain'}
          <input
            ref={inputRef}
            type={mode === 'terrain' && terrainEnLettres ? 'text' : 'number'}
            inputMode={mode === 'terrain' && terrainEnLettres ? 'text' : 'numeric'}
            min={1}
            value={num}
            onChange={(e) => {
              setNum(e.target.value);
              setDemande(null);
            }}
            placeholder={mode === 'equipe' ? 'ex. 47' : terrainEnLettres ? 'ex. D' : 'ex. 5'}
            autoComplete="off"
          />
        </label>
        {num && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setNum('');
              setDemande(null);
            }}
          >
            Effacer
          </button>
        )}
      </form>

      {/* Le champ se vide après validation et le score s'affiche ailleurs dans la
          page : sans ce retour, on ne sait pas si la saisie est partie. */}
      {vide && (
        <Confirmation
          concours={concours}
          match={matches.find((m) => m.id === derniere)}
          teamsById={teamsById}
        />
      )}

      {mode === 'equipe' && parsed !== null && !team && (
        <p className="hint quick-score-msg">Aucune équipe n°{saisie}.</p>
      )}
      {team && pending.length === 0 && (
        <p className="hint quick-score-msg">
          Équipe n°{team.number} : aucune partie à saisir (déjà jouée, ou en attente d'un
          adversaire).
        </p>
      )}
      {team && pending.length > 0 && (
        <section className="quick-score-bloc" aria-label="Partie à saisir">
          <h4 className="quick-score-titre">
            {pending.length > 1 ? 'Parties à saisir' : 'Partie à saisir'} — n°{team.number}
            {pending.length === 1 && !concours.vainqueurSeul && (
              <span className="quick-score-astuce"> · Entrée : n°{team.number} gagne</span>
            )}
          </h4>
          <div className="quick-score-matches">{pending.map((m) => ligne(m))}</div>
        </section>
      )}
      {team && jouees.length > 0 && (
        <section
          className="quick-score-bloc quick-score-bloc-jouees"
          aria-label="Déjà jouées, à corriger"
        >
          <h4 className="quick-score-titre">
            Déjà jouées par n°{team.number} — corriger un score
          </h4>
          <div className="quick-score-matches">
            {jouees.map((m) => ligne(m, { jouee: true }))}
          </div>
        </section>
      )}

      {mode === 'terrain' && !vide && surTerrain.length === 0 && (
        <p className="hint quick-score-msg">
          Aucune partie en cours sur le terrain {saisie.toUpperCase()}.
        </p>
      )}
      {surTerrain.length > 0 && (
        <section className="quick-score-bloc" aria-label="Partie du terrain">
          <h4 className="quick-score-titre">
            {surTerrain.length > 1 ? 'Parties en cours' : 'Partie en cours'} — terrain{' '}
            {saisie.toUpperCase()}
          </h4>
          <div className="quick-score-matches">{surTerrain.map((m) => ligne(m))}</div>
        </section>
      )}
    </div>
  );
}

function Confirmation({
  concours,
  match,
  teamsById,
}: {
  concours: Concours;
  match: Match | undefined;
  teamsById: Map<string, Team>;
}) {
  if (!match || !match.done) return null;
  const numero = (id: string | null | undefined) =>
    id ? `n°${teamsById.get(id)?.number ?? '?'}` : '—';
  const scores = match.scoreA !== null && match.scoreB !== null;
  const gagnant = !scores
    ? null
    : match.scoreA! > match.scoreB!
      ? match.teamAId
      : match.scoreB! > match.scoreA!
        ? match.teamBId
        : null;
  return (
    <div className="quick-score-ok" role="status">
      <CircleCheck className="ic" aria-hidden />
      <span>
        {scores ? (
          <>
            Score{' '}
            <strong>
              {match.scoreA}–{match.scoreB}
            </strong>{' '}
            enregistré, {numero(match.teamAId)} contre {numero(match.teamBId)}
            {gagnant ? ` : équipe ${numero(gagnant)} gagnante.` : '.'}
          </>
        ) : (
          <>
            Résultat enregistré, {numero(match.teamAId)} contre {numero(match.teamBId)}.
          </>
        )}
      </span>
      <ScoreForm
        concours={concours}
        match={match}
        labelA={campNumeros(match, 'A', teamsById)}
        labelB={campNumeros(match, 'B', teamsById)}
        editOnly
      />
    </div>
  );
}

function QuickScoreRow({
  concours,
  match,
  label,
  teamsById,
  cible,
  afficherFace,
  demande,
  jouee,
  onSaved,
}: {
  concours: Concours;
  match: Match;
  label: string;
  teamsById: Map<string, Team>;
  /** Équipe dont on a tapé le numéro : mise en tête et en évidence. */
  cible?: string;
  /** Écrire « n°9 contre n°3 » en clair (recherche par terrain). */
  afficherFace?: boolean;
  demande?: { camp: 'a' | 'b'; jeton: number };
  jouee?: boolean;
  onSaved: () => void;
}) {
  const terrain = formateurTerrain(concours);
  const coteCible = cible ? teamSideInMatch(match, cible) : null;
  const ordre = coteCible === 'B' ? 'BA' : 'AB';
  const camp = (cote: 'A' | 'B') => {
    const id = cote === 'A' ? match.teamAId : match.teamBId;
    return (
      <span key={cote} className={coteCible === cote ? 'quick-score-cible' : undefined}>
        <TeamLabel team={id ? teamsById.get(id) : null} compact />
      </span>
    );
  };
  const [premier, second] = ordre === 'BA' ? (['B', 'A'] as const) : (['A', 'B'] as const);
  return (
    <div className={`quick-score-row${jouee ? ' quick-score-row-jouee' : ''}`}>
      <span className="quick-score-label">
        {label}
        {match.terrain ? ` · Terrain ${terrain(match.terrain)}` : ''}
      </span>
      {afficherFace && (
        <span className="quick-score-face">
          {campNumeros(match, 'A', teamsById)} <em>contre</em> {campNumeros(match, 'B', teamsById)}
        </span>
      )}
      <span className="quick-score-teams">
        {camp(premier)}
        <ScoreForm
          concours={concours}
          match={match}
          labelA={campNumeros(match, 'A', teamsById)}
          labelB={campNumeros(match, 'B', teamsById)}
          ordre={ordre}
          annonce
          demande={demande}
          motCorriger
          onSaved={onSaved}
        />
        {camp(second)}
      </span>
    </div>
  );
}
