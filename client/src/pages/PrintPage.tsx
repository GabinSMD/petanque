import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Match, Team } from '@shared';
import {
  arbitrageReport,
  bilanArbitrage,
  bracketSizeOf,
  isByeMatch,
  presseSections,
  roundLabel,
  rondesTirees,
  type TriEquipes,
  rapportDelegue,
} from '@shared';
import {
  BilanLicences,
  BilanPaiements,
  SyntheseNonPayeDoc,
  GraphiqueTableau,
  ListeAbsents,
  ListeEngages,
  PartiesLancees,
  ResultatsPresse,
} from '../components/PrintDocs';
import {
  useBilanAvantTirage,
  useConcours,
  useLicencies,
  useMatches,
  usePoules,
  useTeams,
} from '../db/hooks';
import { teamDisplayName } from '../components/TeamLabel';
import { FORMAT_LABELS, NIVEAU_LABELS, POULE_SLOT_LABELS, formatDateFr } from '../lib/labels';

function sideText(m: Match, side: 'A' | 'B', teamsById: Map<string, Team>): string {
  const players = side === 'A' ? m.playersA : m.playersB;
  if (players && players.length > 0) {
    return players
      .map((id) => teamsById.get(id))
      .filter((t): t is Team => Boolean(t))
      .map((t) => teamDisplayName(t))
      .join(' · ');
  }
  const teamId = side === 'A' ? m.teamAId : m.teamBId;
  const team = teamId ? teamsById.get(teamId) : undefined;
  return team ? `n°${team.number} — ${teamDisplayName(team)}` : '';
}

/**
 * Documents imprimables : feuilles de poules officielles (2 par page)
 * ou tickets de parties à distribuer aux équipes (6 par page).
 * L'impression se lance automatiquement à l'ouverture.
 */
/**
 * Une ligne du bilan, au format du document : « libellé : n/total (p%) ». Le
 * document omet le pourcentage sur trois lignes (Elite, Honneur, Inconnus) —
 * `sansPct` reproduit cette omission plutôt que de l'uniformiser.
 */
function Ligne({
  libelle,
  c,
  sansPct = false,
}: {
  libelle: string;
  c: { n: number; total: number; pourcentage: number };
  sansPct?: boolean;
}) {
  return (
    <li>
      {libelle} : {c.n}/{c.total}
      {!sansPct && <> ({c.pourcentage}%)</>}
    </li>
  );
}

export function PrintPage() {
  const { id, doc } = useParams<{ id: string; doc: string }>();
  const concours = useConcours(id);
  const teams = useTeams(id) ?? [];
  const poules = usePoules(id) ?? [];
  const matches = useMatches(id) ?? [];
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const arbitrage = useMemo(() => arbitrageReport(teams, matches), [teams, matches]);
  const licencies = useLicencies() ?? [];
  /**
   * Bilan du champ engagé (manuel §3.D.1.B.4.5) : il demande les fiches, donc
   * le fichier des licenciés, et il ne dit rien d'utile sans lui.
   */
  const bilanChamp = useMemo(() => {
    const fiches = new Map(
      licencies.filter((l) => l.licence).map((l) => [l.licence!, l]),
    );
    return bilanArbitrage(teams, fiches, {
      comiteOrganisateur: concours?.comiteNumero,
      comitesLigue: concours?.comitesLigue,
    });
  }, [teams, licencies, concours]);
  // Rapport du délégué (§3.D.15) : les mêmes données, dans l'ordre et avec les
  // colonnes du document fédéral.
  const delegue = useMemo(() => rapportDelegue(teams, matches), [teams, matches]);
  const presse = useMemo(() => presseSections(teams, matches, 'principal'), [teams, matches]);
  // Bilan des licences (§3.B.6) : le même calcul que la modale avant tirage.
  const bilan = useBilanAvantTirage(concours, teams);
  const [tri, setTri] = useState<TriEquipes>('numero');
  const [toursMasques, setToursMasques] = useState<Set<number>>(new Set());
  const printed = useRef(false);

  /** Documents à options : on laisse l'organisateur régler avant d'imprimer. */
  const avecTri = doc === 'inscrits' || doc === 'capitaines' || doc === 'paiements';
  const avecTours = doc === 'presse';
  const autoPrint = !avecTri && !avecTours;

  useEffect(() => {
    if (!concours || printed.current || !autoPrint) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [concours, autoPrint]);

  if (!concours) {
    return (
      <div className="print-page">
        <p>Concours introuvable.</p>
      </div>
    );
  }

  /* ------------------------- Tickets de parties ------------------------- */

  interface Ticket {
    key: string;
    title: string;
    a: string;
    b: string;
    terrain: number | null;
  }

  const tickets: Ticket[] = [];
  if (doc === 'parties') {
    for (const m of matches) {
      if (m.done || isByeMatch(m)) continue;
      const a = sideText(m, 'A', teamsById);
      const b = sideText(m, 'B', teamsById);
      if (!a || !b) continue;
      let title = '';
      if (m.stage === 'poule') {
        const poule = poules.find((p) => p.id === m.pouleId);
        title = `Poule ${poule?.index ?? '?'} — ${POULE_SLOT_LABELS[m.pouleSlot ?? ''] ?? ''}`;
      } else if (m.stage === 'ronde') {
        title = `Ronde ${m.round + 1} — Partie ${m.position + 1}`;
      } else {
        const stageMatches = matches.filter((x) => x.stage === m.stage);
        const size = bracketSizeOf(stageMatches);
        const hasByes = stageMatches.some((x) => x.round === 0 && isByeMatch(x));
        title = `${m.stage === 'consolante' ? 'Consolante — ' : ''}${roundLabel(size, m.round, hasByes)} — Partie ${m.position + 1}`;
      }
      tickets.push({ key: m.id, title, a, b, terrain: m.terrain });
    }
    // Rondes : ne garder que la ronde en cours.
    const rondeMs = matches.filter((m) => m.stage === 'ronde');
    if (rondeMs.length > 0) {
      const current = rondesTirees(rondeMs) - 1;
      for (let i = tickets.length - 1; i >= 0; i--) {
        const m = matches.find((x) => x.id === tickets[i]!.key);
        if (m?.stage === 'ronde' && m.round !== current) tickets.splice(i, 1);
      }
    }
  }

  return (
    <div className="print-page">
      <div className="print-controls no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Imprimer
        </button>
        <Link className="btn btn-ghost" to={`/concours/${concours.id}`}>
          ← Retour au concours
        </Link>
        {avecTri && (
          <label className="print-option">
            Trier par
            <select value={tri} onChange={(e) => setTri(e.target.value as TriEquipes)}>
              <option value="numero">N° de dossard</option>
              <option value="nom">Nom</option>
              <option value="club">Club</option>
            </select>
          </label>
        )}
        {avecTours && presse.length > 0 && (
          <span className="print-option">
            Tours :
            {presse.map((s) => (
              <label key={s.round} className="print-option-check">
                <input
                  type="checkbox"
                  checked={!toursMasques.has(s.round)}
                  onChange={(e) =>
                    setToursMasques((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(s.round);
                      else next.add(s.round);
                      return next;
                    })
                  }
                />
                {s.label}
              </label>
            ))}
          </span>
        )}
      </div>

      <header className="print-doc-head">
        <h1>{concours.name}</h1>
        <p>
          {formatDateFr(concours.date)}
          {concours.lieu ? ` · ${concours.lieu}` : ''} · {FORMAT_LABELS[concours.format]} ·
          Parties en {concours.scoreMax} points
        </p>
        {(concours.comiteOrganisateur || concours.clubOrganisateur || concours.niveau) && (
          <p className="print-doc-organisateur">
            {[
              concours.niveau ? NIVEAU_LABELS[concours.niveau] : '',
              concours.comiteOrganisateur ? `Comité : ${concours.comiteOrganisateur}` : '',
              concours.clubOrganisateur ? `Club organisateur : ${concours.clubOrganisateur}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </header>

      {doc === 'poules' && (
        <div className="print-poules">
          {poules.map((poule) => {
            const pm = matches
              .filter((m) => m.pouleId === poule.id)
              .sort((a, b) => a.position - b.position);
            return (
              <section key={poule.id} className="print-poule">
                <h2>
                  Poule {poule.index}
                  {poule.terrain ? ` — Terrain ${poule.terrain}` : ''}
                </h2>
                <ul className="print-poule-teams">
                  {poule.teamIds.map((tid) => {
                    const t = teamsById.get(tid);
                    return (
                      <li key={tid}>
                        <strong>n°{t?.number}</strong> {t ? teamDisplayName(t) : '?'}
                        {t?.club ? ` (${t.club})` : ''}
                      </li>
                    );
                  })}
                </ul>
                <table className="print-poule-matches">
                  <tbody>
                    {pm.map((m) => (
                      <tr key={m.id}>
                        <td className="print-slot">
                          {POULE_SLOT_LABELS[m.pouleSlot ?? ''] ?? ''}
                        </td>
                        <td>{sideText(m, 'A', teamsById) || '…'}</td>
                        <td className="print-score-box">
                          {m.done ? m.scoreA : ''}
                        </td>
                        <td className="print-score-box">
                          {m.done ? m.scoreB : ''}
                        </td>
                        <td>{sideText(m, 'B', teamsById) || '…'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
          {poules.length === 0 && <p>Aucune poule tirée.</p>}
        </div>
      )}

      {(doc === 'inscrits' || doc === 'capitaines') && (
        <ListeEngages teams={teams} tri={tri} capitainesSeulement={doc === 'capitaines'} />
      )}

      {doc === 'paiements' && <BilanPaiements concours={concours} teams={teams} tri={tri} />}

      {/* La synthèse a son ordre propre — par numéro de club, comme la planche
          p.33 — donc pas d'option de tri : elle n'aurait aucun sens ici. */}
      {doc === 'synthese-non-paye' && (
        <SyntheseNonPayeDoc concours={concours} teams={teams} licencies={licencies} />
      )}

      {doc === 'absents' && <ListeAbsents teams={teams} />}
      {doc === 'bilan-licences' && bilan && <BilanLicences bilan={bilan} />}

      {doc === 'parties-lancees' && (
        <PartiesLancees
          teams={teams}
          poules={poules}
          matches={matches}
          maintenant={new Date().toISOString()}
        />
      )}

      {doc === 'presse' && <ResultatsPresse sections={presse} toursMasques={toursMasques} />}

      {doc === 'graphique' && (
        <>
          <GraphiqueTableau
            teams={teams}
            matches={matches}
            stage="principal"
            titre="Graphique — tableau principal"
          />
          <GraphiqueTableau
            teams={teams}
            matches={matches}
            stage="consolante"
            titre="Graphique — consolante"
          />
          <GraphiqueTableau
            teams={teams}
            matches={matches}
            stage="complementaire"
            titre="Graphique — complémentaire"
          />
        </>
      )}

      {doc === 'delegue' && (
        <div className="print-arbitrage">
          <h2 className="print-arbitrage-title">{delegue.titre}</h2>
          <p className="hint print-arbitrage-intro">
            Phases finales — document du délégué (manuel §3.D.15). Les sections vont du perdant le
            plus précoce au champion, comme sur la feuille fédérale.
          </p>
          {delegue.sections.map((section) => (
            <section key={section.label} className="print-arbitrage-section">
              <h3>{section.label}</h3>
              <table className="print-arbitrage-table">
                <thead>
                  <tr>
                    <th>N° licence</th>
                    <th>Nom, prénom</th>
                    <th>Association ou club</th>
                    <th>N° dép.</th>
                    <th>N° équipe</th>
                  </tr>
                </thead>
                <tbody>
                  {section.teams.map((team) =>
                    team.players.map((p, i) => (
                      <tr key={`${team.number}-${i}`}>
                        <td>{p.licence ?? ''}</td>
                        <td>{p.name.toLocaleUpperCase('fr-FR')}</td>
                        <td>{p.club ?? (i === 0 ? (team.club ?? '') : '')}</td>
                        <td>{p.departement ?? ''}</td>
                        <td>{i === 0 ? team.number : ''}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </section>
          ))}
          {delegue.sections.length === 0 && (
            <p>Aucun résultat à reporter : les phases finales ne sont pas encore assez avancées.</p>
          )}
          <section className="print-arbitrage-sign">
            <p>
              Délégué : <span className="print-rule" />
            </p>
            <p>
              Fait à <span className="print-rule print-rule-sm" /> le{' '}
              <span className="print-rule print-rule-sm" />
            </p>
          </section>
        </div>
      )}

      {doc === 'arbitrage' && (
        <div className="print-arbitrage">
          <h2 className="print-arbitrage-title">Résultats d'arbitrage</h2>
          <p className="hint print-arbitrage-intro">
            Document à remettre au comité pour la saisie des résultats et l'attribution des
            points fédéraux.
          </p>
          {arbitrage.sections.map((section) => (
            <section key={section.label} className="print-arbitrage-section">
              <h3>{section.label}</h3>
              <table className="print-arbitrage-table">
                <thead>
                  <tr>
                    <th>N° équipe</th>
                    <th>N° licence</th>
                    <th>Nom, prénom</th>
                    <th>Association ou club</th>
                  </tr>
                </thead>
                <tbody>
                  {section.teams.map((team) =>
                    team.players.map((p, i) => (
                      <tr key={`${team.number}-${i}`}>
                        <td>{i === 0 ? team.number : ''}</td>
                        <td>{p.licence ?? ''}</td>
                        <td>{p.name.toLocaleUpperCase('fr-FR')}</td>
                        <td>{p.club ?? (i === 0 ? (team.club ?? '') : '')}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </section>
          ))}
          {arbitrage.sections.length === 0 && (
            <p>Aucun résultat à reporter : le tableau n'est pas encore assez avancé.</p>
          )}

          {/* Bilan du champ engagé, dans l'ordre et sur les deux colonnes du
              document fédéral (manuel §3.D.1.B.4.5, p.55 et p.78). */}
          <section className="print-arbitrage-bilan">
            <h3>Bilan des équipes engagées ({bilanChamp.equipes.total})</h3>
            <div className="print-bilan-cols">
              <ul>
                <Ligne libelle="Équipe(s) Non Homogène(s)" c={bilanChamp.equipes.nonHomogenes} />
                {bilanChamp.equipes.ligue && (
                  <Ligne libelle="Équipe(s) de la Ligue" c={bilanChamp.equipes.ligue} />
                )}
                <Ligne libelle="Équipe(s) du Comité" c={bilanChamp.equipes.comite} />
                <Ligne libelle="Joueurs Elite" c={bilanChamp.joueurs.elite} sansPct />
                <Ligne libelle="Joueurs Honneur" c={bilanChamp.joueurs.honneur} sansPct />
                <Ligne libelle="Joueurs Promotion" c={bilanChamp.joueurs.promotion} />
              </ul>
              <ul>
                {bilanChamp.joueurs.ligue && (
                  <Ligne libelle="Joueurs de la Ligue" c={bilanChamp.joueurs.ligue} />
                )}
                <Ligne libelle="Joueurs du Comité" c={bilanChamp.joueurs.comite} />
                <Ligne libelle="Joueurs Classés" c={bilanChamp.joueurs.classes} />
                <Ligne
                  libelle="Joueurs Inconnus ou Etranger"
                  c={bilanChamp.joueurs.inconnus}
                  sansPct
                />
                <li>dont forfaits : {arbitrage.stats.forfaits}</li>
              </ul>
            </div>
            <ul className="print-bilan-criteres">
              <li>Critère Y (% Extérieur CD) = {bilanChamp.critereY}%</li>
              {bilanChamp.critereZ !== undefined ? (
                <li>Critère Z (% Extérieur Ligue) = {bilanChamp.critereZ}%</li>
              ) : (
                <li className="hint">
                  Critère Z (% Extérieur Ligue) : déclarez les comités de la ligue pour l'obtenir.
                </li>
              )}
            </ul>
            {/* Le critère X et la table des grilles ne sont pas calculables : les
                deux exemplaires du manuel se contredisent sur X, et la table n'y
                est pas. On laisse la place, comme le formulaire fédéral laisse
                celle de l'arbitre. */}
            <p className="print-bilan-grille">
              Critère X (% Joueur Promotion) = <span className="print-rule print-rule-sm" /> ·
              Manifestation Classée Grille <span className="print-rule print-rule-sm" />
            </p>
          </section>

          <section className="print-arbitrage-sign">
            <p>
              Arbitre principal : <span className="print-rule" />
            </p>
            <p>
              Fait à <span className="print-rule print-rule-sm" /> le{' '}
              <span className="print-rule print-rule-sm" />
            </p>
            <p>Signature :</p>
          </section>
        </div>
      )}

      {doc === 'parties' && (
        <div className="print-tickets">
          {tickets.map((t) => (
            <section key={t.key} className="print-ticket">
              <p className="print-ticket-concours">{concours.name}</p>
              <p className="print-ticket-title">{t.title}</p>
              <p className="print-ticket-team">{t.a}</p>
              <p className="print-ticket-vs">contre</p>
              <p className="print-ticket-team">{t.b}</p>
              <p className="print-ticket-foot">
                <span>Terrain : {t.terrain ?? '⬜'}</span>
                <span>
                  Score : <em className="print-box" /> – <em className="print-box" />
                </span>
              </p>
            </section>
          ))}
          {tickets.length === 0 && <p>Aucune partie à jouer pour le moment.</p>}
        </div>
      )}
    </div>
  );
}
