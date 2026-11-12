import { ChartColumn, ClipboardList, Euro, FolderOpen, Medal, Newspaper, Receipt, Save, Search, Ticket, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Concours, Match, MatchStage, Poule, Team } from '@shared';
import {
  MAX_MISE,
  TAILLE_FORMATION,
  bracketRanking,
  estConcoursOfficiel,
  nomDuBloc,
  estQualificatif,
  pouleOutcome,
  qualifiesTableau,
  miseEquipe,
  repartitionIndemnites,
  classementRondes,
  permutationsActives,
  raisonRefusMise,
  resultatsClub,
  type EtatParcoursEquipe,
  type RankGroup,
} from '@shared';
import { updateConcours } from '../../db/actions';
import { useModeFederalActif } from '../../db/hooks';
import { PermutationsClassement } from '../../components/PermutationsClassement';
import { StandingsTable } from '../../components/StandingsTable';
import { PhotosPodium } from '../../components/PhotosPodium';
import { TeamLabel } from '../../components/TeamLabel';
import { TirRanking } from '../../components/TirRanking';
import { isIndividualMode, isRondesMode, isTirMode } from '../../lib/labels';
import {
  exportArbitrageCSV,
  exportQualifiesCSV,
  exportBackupJSON,
  exportClassementCSV,
  exportEngagesCSV,
} from '../../lib/export';

interface Props {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}

export function ResultsTab({ concours, teams, poules, matches }: Props) {
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (isTirMode(concours.mode)) {
    const played = matches.some((m) => m.stage === 'ronde' && m.done);
    if (!played) {
      return (
        <div className="tab-content">
          <p className="empty-state">Le classement apparaîtra dès les premières séries saisies.</p>
        </div>
      );
    }
    return (
      <div className="tab-content results">
        <ExportBar concours={concours} teams={teams} poules={poules} matches={matches} />
        <PhotosPodium concours={concours} />
        <section className="result-section">
          <h2>Classement du tir de précision</h2>
          <TirRanking teams={teams} matches={matches} teamsById={teamsById} />
        </section>
      </div>
    );
  }

  if (isRondesMode(concours.mode)) {
    const played = matches.some((m) => m.stage === 'ronde' && m.done);
    if (!played) {
      return (
        <div className="tab-content">
          <p className="empty-state">Le classement apparaîtra dès les premières parties saisies.</p>
        </div>
      );
    }
    // Phases finales jouées (manuel §3.D.15) : ce sont elles qui désignent le
    // vainqueur. Le classement des rondes reste affiché en dessous — c'est lui
    // qui a distribué les équipes entre les concours A, B et C.
    const finales: { stage: MatchStage; titre: string }[] = (
      ['principal', 'consolante', 'complementaire'] as const
    ).map((stage, i) => ({ stage, titre: nomDuBloc(i) }));

    return (
      <div className="tab-content results">
        <ExportBar concours={concours} teams={teams} poules={poules} matches={matches} />
        <PhotosPodium concours={concours} />
        <ResultatsClubSection teams={teams} poules={poules} matches={matches} />
        {finales.map(({ stage, titre }) => {
          const groups = bracketRanking(matches, stage);
          if (groups.length === 0) return null;
          return (
            <section className="result-section" key={stage}>
              <h2>{titre}</h2>
              <RankTable groups={groups} teamsById={teamsById} />
            </section>
          );
        })}
        <section className="result-section">
          <h2>
            Classement {matches.some((m) => m.stage !== 'ronde') ? 'des rondes' : 'général'}
            {isIndividualMode(concours.mode) ? ' (individuel)' : ''}
          </h2>
          <StandingsTable
            standings={classementRondes(concours, teams, matches)}
            teamsById={teamsById}
            permutations={permutationsActives(
              classementRondes(concours, teams, matches),
              concours.permutationsClassement,
            )}
          />
          <PermutationsClassement
            concours={concours}
            classement={classementRondes(concours, teams, matches)}
            teamsById={teamsById}
          />
        </section>
      </div>
    );
  }

  const principalGroups = bracketRanking(matches, 'principal');
  const consolanteGroups = bracketRanking(matches, 'consolante');
  const complementaireGroups = bracketRanking(matches, 'complementaire');
  const outcomes = poules.map((p) =>
    pouleOutcome(p, matches.filter((m) => m.pouleId === p.id)),
  );

  /**
   * Concours qualificatif : les qualifiés sont les vainqueurs du dernier tour
   * du tableau, qui s'arrête là (manuel §3.D.2 et §3.D.7). Sinon on retombe
   * sur les mieux classés, pour un concours joué jusqu'au bout où l'on veut
   * quand même désigner N équipes.
   */
  const qualificatif = estQualificatif(matches, 'principal');
  const qualifiesDuTableau = useMemo(
    () => (qualificatif ? qualifiesTableau(matches, 'principal') : []),
    [qualificatif, matches],
  );
  const qualifiedIds = useMemo(() => {
    if (qualificatif) return new Set(qualifiesDuTableau);
    const n = concours.nbQualifies ?? 0;
    const ids = new Set<string>();
    if (n <= 0) return ids;
    for (const g of principalGroups) {
      if (ids.size >= n) break;
      g.teamIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [qualificatif, qualifiesDuTableau, principalGroups, concours.nbQualifies]);

  const hasAnything =
    principalGroups.length > 0 || consolanteGroups.length > 0 || outcomes.length > 0;

  if (!hasAnything) {
    return (
      <div className="tab-content">
        <p className="empty-state">Les résultats apparaîtront au fil du concours.</p>
      </div>
    );
  }

  return (
    <div className="tab-content results">
      <ExportBar concours={concours} teams={teams} poules={poules} matches={matches} />
        <PhotosPodium concours={concours} />
      <ResultatsClubSection teams={teams} poules={poules} matches={matches} />
      {principalGroups.length > 0 && (
        <section className="result-section">
          <h2>Concours principal</h2>
          {qualifiedIds.size > 0 && (
            <p className="qualifies-banner">
              <Ticket className="ic" aria-hidden /> {qualifiedIds.size} qualifié{qualifiedIds.size > 1 ? 's' : ''} pour la phase
              suivante{' '}
              {qualificatif
                ? '(vainqueurs du dernier tour — le tableau s\'arrête là).'
                : '(les mieux classés).'}
            </p>
          )}
          <RankTable
            groups={principalGroups}
            teamsById={teamsById}
            qualifiedIds={qualifiedIds}
          />
        </section>
      )}

      {principalGroups.length > 0 && (
        <IndemnitesSection concours={concours} teams={teams} groups={principalGroups} />
      )}

      {consolanteGroups.length > 0 && (
        <section className="result-section">
          <h2>Consolante</h2>
          <RankTable groups={consolanteGroups} teamsById={teamsById} />
        </section>
      )}

      {complementaireGroups.length > 0 && (
        <section className="result-section">
          <h2>Complémentaire</h2>
          <RankTable groups={complementaireGroups} teamsById={teamsById} />
        </section>
      )}

      {concours.mode === 'poules' && outcomes.length > 0 && (
        <section className="result-section">
          <h2>Issue des poules</h2>
          <table className="rank-table">
            <thead>
              <tr>
                <th>Poule</th>
                <th>1er (2 victoires)</th>
                <th>2e (barrage)</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.poule.id}>
                  <td>Poule {o.poule.index}</td>
                  <td>{o.q1 ? <TeamLabel team={teamsById.get(o.q1)} /> : '—'}</td>
                  <td>{o.q2 ? <TeamLabel team={teamsById.get(o.q2)} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/**
 * Répartition des indemnités : pot = mises × équipes − frais, partagé
 * entre les groupes du classement avec des poids géométriques
 * (vainqueur 2× le finaliste, etc.). Suggestion arrondie à 0,10 €.
 */
function IndemnitesSection({
  concours,
  teams,
  groups,
}: {
  concours: Concours;
  teams: Team[];
  groups: RankGroup[];
}) {
  const [open, setOpen] = useState(false);
  /** Ce qui ne va pas dans la mise saisie — remis à zéro à chaque frappe. */
  const [raisonMise, setRaisonMise] = useState<string | undefined>(undefined);
  /**
   * Ce qui est tapé dans le champ, tant que l'organisateur y est.
   *
   * `null` veut dire « personne n'a encore touché au champ » : la valeur
   * affichée vient alors de la base. Sans cet état, le champ afficherait
   * toujours la mise **enregistrée** — donc, dès qu'une saisie est refusée, il
   * reviendrait à l'ancienne valeur tout en montrant une erreur qui parle d'un
   * nombre disparu de l'écran. Le défaut s'est vu à la capture, pas au test.
   */
  const [saisieMise, setSaisieMise] = useState<string | null>(null);
  const nb = teams.filter((t) => !t.forfait).length;
  const taille = TAILLE_FORMATION[concours.format];
  /**
   * Ancienne mise par équipe, quand ce concours n'a pas encore de mise par
   * joueur. On ne la divise pas pour remplir le champ : 10 € / 3 donnerait
   * 3,33 €, et on ne sait pas ce que l'organisateur avait voulu dire.
   */
  const miseHeritee = concours.miseParJoueur === undefined ? concours.miseParEquipe : undefined;
  // Faute de toute mise, on part du barème donné en exemple par le manuel
  // (4 €/joueur) plutôt que de l'ancien forfait de 10 € par équipe : le champ
  // est éditable et sous les yeux de l'organisateur avant tout calcul.
  const parJoueur = concours.miseParJoueur ?? (miseHeritee === undefined ? 4 : undefined);
  const mise = miseEquipe(concours) ?? parJoueur! * taille;
  const frais = concours.fraisPct ?? 0;
  const pot = Math.max(0, mise * nb * (1 - frais / 100));
  const dernierRang = groups.length > 0 ? Math.max(...groups.map((g) => g.rank)) : 0;
  const seuil = concours.indemnitesJusquAuRang;
  const repartition = repartitionIndemnites(groups, pot, seuil, nb);

  return (
    <section className="result-section indemnites">
      <h2>
        <Euro className="ic" aria-hidden /> Indemnités{' '}
        <button className="btn btn-ghost btn-sm no-print" onClick={() => setOpen(!open)}>
          {open ? 'Masquer' : 'Calculer'}
        </button>
      </h2>
      {open && (
        <>
          <div className="indemnites-params no-print">
            <label>
              Mise par joueur (€)
              {/* Au centime, comme ailleurs : le pas de 0,5 refusait 3,20 €. */}
              <input
                type="number"
                min={0}
                max={MAX_MISE}
                step={0.01}
                value={saisieMise ?? parJoueur ?? ''}
                placeholder="—"
                onChange={(e) => {
                  setSaisieMise(e.target.value);
                  setRaisonMise(undefined);
                  if (e.target.value === '') {
                    void updateConcours({
                      ...concours,
                      miseParJoueur: undefined,
                      miseParEquipe: undefined,
                    });
                    return;
                  }
                  // Ce champ écrit en base à chaque frappe : la vérification est
                  // donc ici, et non à l'envoi d'un formulaire qu'il n'y a pas.
                  // Sans elle, une saisie illisible écrirait `NaN` dans la mise
                  // et tout le bilan des indemnités deviendrait `NaN` — un
                  // refus muet dans l'autre sens.
                  const valeur = Number(e.target.value);
                  const raison = raisonRefusMise(valeur);
                  if (raison) {
                    setRaisonMise(raison);
                    return;
                  }
                  // On écrit la mise par joueur et on retire l'ancien champ :
                  // le laisser en place ferait cohabiter deux vérités, et
                  // `miseEquipe` l'occulterait — la saisie semblerait sans effet.
                  void updateConcours({
                    ...concours,
                    miseParJoueur: valeur,
                    miseParEquipe: undefined,
                  });
                }}
              />
              {raisonMise && <small className="form-error">{raisonMise}</small>}
              <small className="form-hint">
                {miseHeritee !== undefined
                  ? `Ancienne mise : ${miseHeritee.toLocaleString('fr-FR')} € par équipe, appliquée tant que ce champ est vide.`
                  : `soit ${mise.toLocaleString('fr-FR')} € par équipe`}
              </small>
            </label>
            <label>
              Frais d'organisation (%)
              <input
                type="number"
                min={0}
                max={100}
                value={frais}
                onChange={(e) =>
                  void updateConcours({ ...concours, fraisPct: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Payer jusqu'au rang
              <select
                value={seuil ?? ''}
                onChange={(e) =>
                  void updateConcours({
                    ...concours,
                    indemnitesJusquAuRang: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              >
                <option value="">Tous les rangs classés</option>
                {groups.map((g) => (
                  <option key={g.rank} value={g.rank + g.teamIds.length - 1}>
                    Jusqu'au rang {g.rank + g.teamIds.length - 1} — {g.label.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              {nb} équipes × {mise.toFixed(2)} € − {frais}% ={' '}
              <strong>{pot.toFixed(2)} € à répartir</strong>
              {seuil !== undefined && seuil < dernierRang && (
                <>
                  {' '}
                  · au-delà du rang {seuil}, les équipes repartent avec des lots ou des tickets,
                  et tout le pot va aux rangs payés.
                </>
              )}
            </p>
          </div>
          <table className="rank-table">
            <thead>
              <tr>
                <th>Classement</th>
                <th>Équipes</th>
                <th>Par équipe</th>
                <th>Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {repartition.lignes.map((l) => (
                <tr key={l.rank} className={l.paye ? undefined : 'indemnite-non-payee'}>
                  <td>{l.label}</td>
                  <td>{l.nbEquipes}</td>
                  <td>{l.paye ? `${l.parEquipe.toFixed(2)} €` : '— lots / tickets'}</td>
                  <td>{l.paye ? `${l.sousTotal.toFixed(2)} €` : ''}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>
                  <strong>Total distribué</strong>{' '}
                  <span className="hint">(arrondi à 0,10 €)</span>
                </td>
                <td>
                  <strong>{repartition.totalDistribue.toFixed(2)} €</strong>
                </td>
              </tr>
              <tr>
                <td colSpan={3}>
                  Total par équipe engagée <span className="hint">({nb} équipes)</span>
                </td>
                <td>{repartition.parEquipeEngagee.toFixed(2)} €</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function ExportBar({ concours, teams, poules, matches }: Props) {
  // Le rapport d'arbitrage se lit dans le tableau principal : il n'a de sens
  // que pour les formules à tableau.
  const hasBracket = matches.some((m) => m.stage === 'principal');
  // Les documents du comité restent visibles sur un concours officiel, même si
  // le club a masqué le mode fédéral.
  const federal = useModeFederalActif() || estConcoursOfficiel(concours);
  // Concours qualificatif : la liste des qualifiés s'exporte pour servir
  // d'inscriptions à la phase finale.
  const idsQualifies = estQualificatif(matches, 'principal')
    ? new Set(qualifiesTableau(matches, 'principal'))
    : new Set<string>();
  const qualifies = teams.filter((t) => idsQualifies.has(t.id));
  /**
   * Phases finales jouées (manuel §3.D.15) : le délégué a son propre document.
   * Sans elles, le rapport d'arbitrage suffit — c'est le même contenu.
   */
  const avecFinales = isRondesMode(concours.mode) && matches.some((m) => m.stage === 'principal');
  return (
    <div className="export-bar no-print" data-tour="exporter">
      <span className="export-bar-label">Exporter :</span>
      {/* Documents remis au comité : sans objet pour un concours de club. */}
      {hasBracket && federal && (
        <>
          <Link
            className="btn btn-ghost btn-sm"
            to={`/concours/${concours.id}/imprimer/arbitrage`}
            title="Feuille à remettre au comité (points fédéraux)"
          >
            <Receipt className="ic" aria-hidden /> Arbitrage (impression)
          </Link>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => exportArbitrageCSV(concours, teams, matches)}
            title="Colonnes du tableur fédéral, pour la saisie dans Geslico"
          >
            <Receipt className="ic" aria-hidden /> Arbitrage (CSV)
          </button>
          {/* Phases finales en système suisse : le délégué a son propre
              document (manuel §3.D.15), même contenu dans l'ordre fédéral. */}
          {avecFinales && (
            <Link
              className="btn btn-ghost btn-sm"
              to={`/concours/${concours.id}/imprimer/delegue`}
              title="Résultat du concours à remplir par le délégué (phases finales)"
            >
              <ClipboardList className="ic" aria-hidden /> Rapport du délégué
            </Link>
          )}
          <Link
            className="btn btn-ghost btn-sm"
            to={`/concours/${concours.id}/imprimer/presse`}
            title="Résultats détaillés par tour, pour le journal"
          >
            <Newspaper className="ic" aria-hidden /> Presse
          </Link>
        </>
      )}
      {/* Le graphique papier n'a rien de fédéral : tout club imprime son
          tableau pour l'afficher au boulodrome. */}
      {hasBracket && (
        <Link
          className="btn btn-ghost btn-sm"
          to={`/concours/${concours.id}/imprimer/graphique`}
          title="Graphique papier, pour le suivi manuel"
        >
          <FolderOpen className="ic" aria-hidden /> Graphique
        </Link>
      )}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => exportClassementCSV(concours, teams, poules, matches)}
      >
        <ChartColumn className="ic" aria-hidden /> Classement (CSV)
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => exportEngagesCSV(concours, teams)}
      >
        <ClipboardList className="ic" aria-hidden /> Engagés (CSV)
      </button>
      {qualifies.length > 0 && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => exportQualifiesCSV(concours, qualifies)}
          title="Liste à réutiliser comme inscriptions de la phase finale"
        >
          <Ticket className="ic" aria-hidden /> Qualifiés (CSV)
        </button>
      )}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => exportBackupJSON(concours, teams, poules, matches)}
        title="Sauvegarde complète réimportable"
      >
        <Save className="ic" aria-hidden /> Sauvegarde (JSON)
      </button>
    </div>
  );
}

const ETAT_PARCOURS_LABELS: Record<EtatParcoursEquipe, string> = {
  en_jeu: 'En jeu',
  eliminee: 'Éliminée',
  vainqueur: 'Vainqueur',
  qualifiee: 'Qualifiée',
  forfait: 'Forfait',
  non_tiree: 'Non tirée',
};

const ETAT_PARCOURS_TAG: Record<EtatParcoursEquipe, string> = {
  en_jeu: 'tag-info',
  eliminee: '',
  vainqueur: 'tag-ok',
  qualifiee: 'tag-ok',
  forfait: 'tag-danger',
  non_tiree: '',
};

/**
 * « Recherche Résultats Club » (manuel §3.D.1.D) : le président de club passe
 * à la table et demande où en sont ses équipes. On tape le club, on lit pour
 * chacune son concours, son dernier tour ou sa place, et si elle joue encore.
 */
function ResultatsClubSection({
  teams,
  poules,
  matches,
}: {
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}) {
  const [requete, setRequete] = useState('');
  const res = useMemo(
    () => resultatsClub(teams, poules, matches, requete),
    [teams, poules, matches, requete],
  );
  const cherche = requete.trim().length >= 2;

  return (
    <section className="result-section no-print">
      <h2>
        <Search className="ic" aria-hidden /> Résultats d'un club
      </h2>
      <div className="recherche-equipe">
        <label>
          Club
          <input
            type="search"
            value={requete}
            placeholder="Nom du club, en entier ou en partie"
            onChange={(e) => setRequete(e.target.value)}
          />
        </label>
        {cherche && (
          <span className="hint">
            {res.equipes.length === 0
              ? 'Aucune équipe de ce club.'
              : `${res.equipes.length} équipe${res.equipes.length > 1 ? 's' : ''} — ${res.clubs.join(', ')}`}
          </span>
        )}
      </div>
      {cherche && res.equipes.length > 0 && (
        <div className="table-scroll">
          <table className="rank-table">
            <thead>
              <tr>
                <th>Équipe</th>
                <th>Concours</th>
                <th>Parcours</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {res.equipes.map((e) => (
                <tr key={e.team.id}>
                  <td>
                    <TeamLabel team={e.team} compact />
                    {!e.homogene && (
                      <span className="hint" title="Le club n'y a qu'une partie des joueurs">
                        {' '}
                        (mixte)
                      </span>
                    )}
                  </td>
                  <td>{e.concours ?? '—'}</td>
                  <td>
                    {e.libelle}
                    {e.place !== undefined && e.place > 1 && ` (${e.place}e)`}
                  </td>
                  <td>
                    <span className={`tag ${ETAT_PARCOURS_TAG[e.etat]}`}>
                      {ETAT_PARCOURS_LABELS[e.etat]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RankTable({
  groups,
  teamsById,
  qualifiedIds,
}: {
  groups: ReturnType<typeof bracketRanking>;
  teamsById: Map<string, Team>;
  qualifiedIds?: Set<string>;
}) {
  return (
    <table className="rank-table">
      <tbody>
        {groups.map((g) => (
          <tr key={g.rank} className={g.rank === 1 ? 'rank-first' : ''}>
            <td className="rank-cell">
              {g.rank === 1 ? <Trophy className="ic" aria-hidden /> : g.rank === 2 ? <Medal className="ic" aria-hidden /> : `${g.rank}e`}
            </td>
            <td className="rank-label">{g.label}</td>
            <td>
              <ul className="rank-teams">
                {g.teamIds.map((id) => (
                  <li key={id}>
                    <TeamLabel team={teamsById.get(id)} />
                    {qualifiedIds?.has(id) && (
                      <span className="tag tag-qualifie">Qualifié</span>
                    )}
                  </li>
                ))}
              </ul>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
