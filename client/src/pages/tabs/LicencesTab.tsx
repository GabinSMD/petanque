import { useMemo, useRef, useState } from 'react';
import type { Concours, Licencie, Team } from '@shared';
import {
  chercherEquipeParLicence,
  controlerEquipe,
  depotStats,
  parseLicenceQr,
  type ChampLicence,
  type ControleEquipe,
  type CriteresLicence,
} from '@shared';
import { setCertificatValide, setLicencesDeposees, updateTeam } from '../../db/actions';
import { useLicencies } from '../../db/hooks';
import {
  ANOMALIE_EQUIPE_LABELS,
  ANOMALIE_LABELS,
  CATEGORIE_AGE_LABELS,
  formatDateFr,
} from '../../lib/labels';

interface Props {
  concours: Concours;
  teams: Team[];
}

type Filtre = 'toutes' | 'a_deposer' | 'non_conformes';

/** Un champ de la fiche, mis en évidence s'il est en anomalie. */
function Champ({
  libelle,
  valeur,
  champ,
  anomalies,
}: {
  libelle: string;
  valeur: string;
  champ: ChampLicence;
  anomalies: ChampLicence[];
}) {
  const faute = anomalies.includes(champ);
  return (
    <div className={faute ? 'depot-champ depot-champ-faute' : 'depot-champ'}>
      <span className="depot-champ-libelle">{libelle}</span>
      <span className="depot-champ-valeur">{valeur || '—'}</span>
    </div>
  );
}

/**
 * Dépôt des licences (manuel §3.C) : l'équipe présente ses licences, la table
 * de marque contrôle chaque joueur — voyant vert, ou champ fautif mis en
 * évidence — remplace un joueur si besoin, valide un certificat médical sur
 * présentation du papier, puis enregistre le dépôt.
 *
 * L'écran répond aussi à la question de l'écran « Statistiques » du logiciel
 * fédéral : quelles équipes ne sont pas encore passées.
 */
export function LicencesTab({ concours, teams }: Props) {
  const licencies = useLicencies() ?? [];
  const fiches = useMemo(
    () => new Map(licencies.filter((l) => l.licence).map((l) => [l.licence!, l])),
    [licencies],
  );

  const criteres: CriteresLicence = useMemo(
    () => ({
      annee: Number(concours.date.slice(0, 4)),
      dateConcours: concours.date,
      categorieAge: concours.categorieAge,
      strict: concours.strict,
      sexe: concours.critereSexe,
      classification: concours.critereClassification,
      homogene: concours.homogene,
      certificatsValides: new Set(concours.certificatsValides ?? []),
    }),
    [concours],
  );

  const controles = useMemo(() => {
    const map = new Map<string, ControleEquipe>();
    for (const t of teams) map.set(t.id, controlerEquipe(t.players, fiches, criteres));
    return map;
  }, [teams, fiches, criteres]);

  const stats = depotStats(
    teams,
    [...controles.entries()].map(([teamId, c]) => ({ teamId, conforme: c.conforme })),
  );

  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const champScan = useRef<HTMLInputElement>(null);

  const attendues = teams.filter((t) => !t.forfait);
  const visibles = attendues.filter((t) => {
    if (filtre === 'a_deposer') return !t.licencesDeposees;
    if (filtre === 'non_conformes') return controles.get(t.id)?.conforme === false;
    return true;
  });

  /** Scanner une licence ouvre l'équipe qui la porte. */
  const scanner = (contenu: string): void => {
    const decode = parseLicenceQr(contenu);
    const licence = decode?.licence;
    if (!licence) {
      setMessage(`Contenu non reconnu : « ${contenu.slice(0, 40)} ».`);
      return;
    }
    const equipe = chercherEquipeParLicence(teams, licence);
    if (!equipe) {
      setMessage(`Licence ${licence} : aucune équipe inscrite ne la porte.`);
      return;
    }
    setOuverte(equipe.id);
    setFiltre('toutes');
    setMessage(`Équipe n°${equipe.number} — licence ${licence}.`);
  };

  return (
    <div className="tab-content">
      <div className="depot-stats">
        <div className="depot-jauge" role="img" aria-label={`${stats.pourcentage}% déposées`}>
          <div className="depot-jauge-remplie" style={{ width: `${stats.pourcentage}%` }} />
        </div>
        <p>
          <strong>
            {stats.deposees} / {stats.total}
          </strong>{' '}
          équipe{stats.total > 1 ? 's' : ''} ayant déposé ses licences
          {stats.restantes > 0 && <> · {stats.restantes} à passer</>}
          {stats.nonConformes > 0 && (
            <>
              {' '}
              · <span className="depot-alerte">{stats.nonConformes} non conforme
              {stats.nonConformes > 1 ? 's' : ''}</span>
            </>
          )}
        </p>
      </div>

      <form
        className="toolbar no-print"
        onSubmit={(e) => {
          e.preventDefault();
          const v = saisie.trim();
          if (!v) return;
          scanner(v);
          setSaisie('');
          champScan.current?.focus();
        }}
      >
        <input
          ref={champScan}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Scannez une licence (douchette) ou tapez un n° puis Entrée"
          autoComplete="off"
        />
        <span className="toolbar-actions">
          {(['toutes', 'a_deposer', 'non_conformes'] as Filtre[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filtre === f ? 'btn btn-sm btn-primary' : 'btn btn-sm'}
              onClick={() => setFiltre(f)}
            >
              {f === 'toutes' ? 'Toutes' : f === 'a_deposer' ? 'À déposer' : 'Non conformes'}
            </button>
          ))}
        </span>
      </form>

      {message && <p className="hint">{message}</p>}

      {attendues.length === 0 && <p>Aucune équipe inscrite.</p>}

      <ul className="depot-liste">
        {visibles.map((team) => {
          const controle = controles.get(team.id)!;
          const ouvert = ouverte === team.id;
          return (
            <li key={team.id} className={ouvert ? 'depot-equipe depot-equipe-ouverte' : 'depot-equipe'}>
              <button
                className="depot-entete"
                onClick={() => setOuverte(ouvert ? null : team.id)}
                aria-expanded={ouvert}
              >
                <span className="depot-num">n°{team.number}</span>
                <span className="depot-joueurs">
                  {team.players.map((p) => p.name).join(' / ')}
                </span>
                <span className={controle.conforme ? 'tag tag-ok' : 'tag tag-danger'}>
                  {controle.conforme ? '✓ conforme' : '⚠ à vérifier'}
                </span>
                <span className={team.licencesDeposees ? 'tag tag-ok' : 'tag tag-warn'}>
                  {team.licencesDeposees ? 'déposées' : 'non déposées'}
                </span>
              </button>

              {ouvert && (
                <div className="depot-detail">
                  {controle.anomaliesEquipe.length > 0 && (
                    <p className="depot-alerte">
                      ⚠{' '}
                      {controle.anomaliesEquipe
                        .map((a) => ANOMALIE_EQUIPE_LABELS[a])
                        .join(', ')}
                    </p>
                  )}

                  {team.players.map((joueur, i) => {
                    const c = controle.joueurs[i]!;
                    const fiche: Licencie | undefined = joueur.licence
                      ? fiches.get(joueur.licence)
                      : undefined;
                    const jeune =
                      c.categorie === 'juniors' ||
                      c.categorie === 'cadets' ||
                      c.categorie === 'minimes' ||
                      c.categorie === 'benjamins';
                    return (
                      <div key={i} className="depot-joueur">
                        <div className="depot-joueur-tete">
                          <span
                            className={
                              c.anomalies.length === 0 && !c.inconnu
                                ? 'depot-voyant depot-voyant-ok'
                                : 'depot-voyant depot-voyant-ko'
                            }
                            title={
                              c.anomalies.length === 0 && !c.inconnu
                                ? 'Conforme'
                                : c.anomalies.map((a) => ANOMALIE_LABELS[a]).join(', ')
                            }
                          />
                          {/* Remplacement d'un joueur : autorisé même après le
                              tirage, comme le prévoit le manuel. */}
                          <input
                            value={joueur.name}
                            onChange={(e) =>
                              void updateTeam({
                                ...team,
                                players: team.players.map((p, k) =>
                                  k === i ? { ...p, name: e.target.value } : p,
                                ),
                              })
                            }
                            aria-label={`Nom du joueur ${i + 1}`}
                          />
                          <input
                            className="licence-input"
                            value={joueur.licence ?? ''}
                            onChange={(e) =>
                              void updateTeam({
                                ...team,
                                players: team.players.map((p, k) =>
                                  k === i ? { ...p, licence: e.target.value || undefined } : p,
                                ),
                              })
                            }
                            placeholder="N° licence"
                            aria-label={`Licence du joueur ${i + 1}`}
                          />
                        </div>

                        {c.inconnu ? (
                          <p className="depot-alerte">
                            Licence {joueur.licence} absente du fichier des licenciés : rien à
                            contrôler.
                          </p>
                        ) : (
                          <div className="depot-champs">
                            <Champ
                              libelle="Licence"
                              valeur={joueur.licence ?? ''}
                              champ="licence"
                              anomalies={c.anomalies}
                            />
                            <Champ
                              libelle="Année de reprise"
                              valeur={fiche?.anneeReprise ? String(fiche.anneeReprise) : ''}
                              champ="anneeReprise"
                              anomalies={c.anomalies}
                            />
                            <Champ
                              libelle="Naissance"
                              valeur={
                                fiche?.dateNaissance
                                  ? `${formatDateFr(fiche.dateNaissance)}${
                                      c.categorie ? ` (${CATEGORIE_AGE_LABELS[c.categorie]})` : ''
                                    }`
                                  : ''
                              }
                              champ="dateNaissance"
                              anomalies={c.anomalies}
                            />
                            <Champ
                              libelle="Sexe"
                              valeur={fiche?.sexe ?? ''}
                              champ="sexe"
                              anomalies={c.anomalies}
                            />
                            <Champ
                              libelle="Classification"
                              valeur={fiche?.classification ?? ''}
                              champ="classification"
                              anomalies={c.anomalies}
                            />
                            <Champ
                              libelle="Club"
                              valeur={fiche?.club ?? ''}
                              champ="club"
                              anomalies={c.anomalies}
                            />
                            {jeune && (
                              <Champ
                                libelle="Certificat médical"
                                valeur={
                                  fiche?.certificatMedical
                                    ? formatDateFr(fiche.certificatMedical)
                                    : ''
                                }
                                champ="certificatMedical"
                                anomalies={c.anomalies}
                              />
                            )}
                          </div>
                        )}

                        {jeune && joueur.licence && (
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={(concours.certificatsValides ?? []).includes(joueur.licence)}
                              onChange={(e) =>
                                void setCertificatValide(
                                  concours,
                                  joueur.licence!,
                                  e.target.checked,
                                )
                              }
                            />
                            Certificat médical présenté sur papier
                          </label>
                        )}
                      </div>
                    );
                  })}

                  <div className="form-actions">
                    {team.licencesDeposees ? (
                      <>
                        <span className="hint">
                          Déposées le {new Date(team.licencesDeposees).toLocaleString('fr-FR')}
                        </span>
                        <button
                          className="btn btn-ghost"
                          onClick={() => void setLicencesDeposees(team, false)}
                        >
                          ↩ Annuler le dépôt
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => void setLicencesDeposees(team, true)}
                      >
                        ✓ Valider le dépôt
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {visibles.length === 0 && attendues.length > 0 && (
        <p className="hint">
          {filtre === 'a_deposer'
            ? 'Toutes les équipes ont déposé leurs licences.'
            : 'Aucune équipe non conforme.'}
        </p>
      )}
    </div>
  );
}
