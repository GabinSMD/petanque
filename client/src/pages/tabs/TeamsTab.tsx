import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Concours, Player, Team } from '@shared';
import { addTeam, deleteTeam, updateTeam } from '../../db/actions';
import { pouleSummary } from '../../db/actions';
import { useLicencies } from '../../db/hooks';
import { controlerEquipe, type ControleEquipe } from '@shared';
import { ANOMALIE_EQUIPE_LABELS, ANOMALIE_LABELS } from '../../lib/labels';
import { RegistrationsPanel } from '../../components/RegistrationsPanel';
import { FORMAT_LABELS, PLAYERS_PER_TEAM, isIndividualMode } from '../../lib/labels';

interface Props {
  concours: Concours;
  teams: Team[];
}

export function TeamsTab({ concours, teams }: Props) {
  const individual = isIndividualMode(concours.mode);
  const nbPlayers = individual ? 1 : PLAYERS_PER_TEAM[concours.format];
  const locked = concours.status !== 'inscriptions';
  const [names, setNames] = useState<string[]>(Array(nbPlayers).fill(''));
  const [licences, setLicences] = useState<string[]>(Array(nbPlayers).fill(''));
  const [club, setClub] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const licencies = useLicencies() ?? [];
  const licencieByName = new Map(licencies.map((l) => [l.name.toLowerCase(), l]));

  /* Contrôle des licences : seulement s'il y a de quoi contrôler — des
     critères fédéraux, ou au moins un fichier de licenciés importé. */
  const criteresFederaux = Boolean(
    concours.categorieAge ||
      concours.homogene ||
      (concours.critereSexe && concours.critereSexe !== 'tous') ||
      (concours.critereClassification && concours.critereClassification !== 'tous'),
  );
  const controlActif = criteresFederaux || licencies.length > 0;
  const fiches = new Map(licencies.filter((l) => l.licence).map((l) => [l.licence!, l]));
  const controles = new Map<string, ControleEquipe>(
    controlActif
      ? teams.map((t) => [
          t.id,
          controlerEquipe(t.players, fiches, {
            annee: Number(concours.date.slice(0, 4)),
            dateConcours: concours.date,
            categorieAge: concours.categorieAge,
            strict: concours.strict,
            sexe: concours.critereSexe,
            classification: concours.critereClassification,
            homogene: concours.homogene,
            // Hors concours officiel, on ne reproche pas une licence non saisie.
            ignorerLicencesManquantes: !criteresFederaux,
          }),
        ])
      : [],
  );
  const nonConformes = [...controles.values()].filter((c) => !c.conforme).length;

  /** Autocomplétion : un nom du fichier des licenciés remplit licence et club. */
  const applyLicencie = (i: number, value: string) => {
    const found = licencieByName.get(value.trim().toLowerCase());
    if (!found) return;
    if (found.licence) {
      setLicences((prev) => prev.map((l, j) => (j === i && !l ? found.licence! : l)));
    }
    if (found.club && !club) setClub(found.club);
  };

  // La formation peut changer tant qu'on est aux inscriptions.
  if (names.length !== nbPlayers) {
    setNames(Array(nbPlayers).fill(''));
    setLicences(Array(nbPlayers).fill(''));
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const players: Player[] = names
      .map((name, i) => ({ name: name.trim(), licence: licences[i]?.trim() || undefined }))
      .filter((p) => p.name.length > 0);
    if (players.length === 0) return;
    await addTeam(concours.id, players, club);
    setNames(Array(nbPlayers).fill(''));
    setLicences(Array(nbPlayers).fill(''));
    firstInput.current?.focus();
  };

  const summary = concours.mode === 'poules' ? pouleSummary(teams.length) : null;
  const mise = concours.miseParEquipe ?? 0;
  const trackPaid = mise > 0;
  const paidCount = teams.filter((t) => t.paid && !t.forfait).length;
  const engagements = teams.filter((t) => !t.forfait).length;

  return (
    <div className="tab-content">
      {!locked && <RegistrationsPanel concours={concours} />}

      {!locked && (
        <form className="team-add-form no-print" onSubmit={(e) => void submit(e)}>
          <div className="team-add-players">
            {Array.from({ length: nbPlayers }, (_, i) => (
              <div key={i} className="player-inputs">
                <input
                  ref={i === 0 ? firstInput : undefined}
                  value={names[i] ?? ''}
                  list={licencies.length > 0 ? 'dl-licencies' : undefined}
                  onChange={(e) => {
                    setNames(names.map((n, j) => (j === i ? e.target.value : n)));
                    applyLicencie(i, e.target.value);
                  }}
                  placeholder={individual ? 'Nom du joueur' : `Joueur ${i + 1}`}
                  required={i === 0}
                />
                <input
                  className="licence-input"
                  value={licences[i] ?? ''}
                  onChange={(e) =>
                    setLicences(licences.map((l, j) => (j === i ? e.target.value : l)))
                  }
                  placeholder="N° licence"
                />
              </div>
            ))}
          </div>
          <input
            className="club-input"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="Club"
            list="clubs-connus"
          />
          <datalist id="clubs-connus">
            {[...new Set([
              ...teams.map((t) => t.club),
              ...licencies.map((l) => l.club),
            ].filter(Boolean))].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {licencies.length > 0 && (
            <datalist id="dl-licencies">
              {licencies.slice(0, 3000).map((l) => (
                <option key={l.id} value={l.name}>
                  {[l.licence, l.club].filter(Boolean).join(' · ')}
                </option>
              ))}
            </datalist>
          )}
          <button className="btn btn-primary">Inscrire</button>
        </form>
      )}

      {!locked && licencies.length === 0 && teams.length === 0 && (
        <p className="hint no-print">
          💡 Gagnez du temps : <Link to="/licencies">importez vos licenciés (CSV)</Link>{' '}
          pour l'autocomplétion des noms, licences et clubs.
        </p>
      )}

      {locked && (
        <p className="hint no-print">
          Inscriptions verrouillées : le tirage a été effectué. Annulez le tirage pour
          modifier les équipes. Vous pouvez toujours marquer un forfait.
        </p>
      )}

      {teams.length > 0 && (
        <div className="export-bar no-print">
          <span className="export-bar-label">Imprimer :</span>
          <Link className="btn btn-ghost btn-sm" to={`/concours/${concours.id}/imprimer/inscrits`}>
            📋 Liste des inscrits
          </Link>
          <Link
            className="btn btn-ghost btn-sm"
            to={`/concours/${concours.id}/imprimer/capitaines`}
          >
            👤 Liste des capitaines
          </Link>
          {trackPaid && (
            <Link
              className="btn btn-ghost btn-sm"
              to={`/concours/${concours.id}/imprimer/paiements`}
            >
              💶 Bilan des paiements
            </Link>
          )}
          {teams.some((t) => t.forfait) && (
            <Link className="btn btn-ghost btn-sm" to={`/concours/${concours.id}/imprimer/absents`}>
              🚫 Équipes absentes
            </Link>
          )}
        </div>
      )}

      {controlActif && nonConformes > 0 && (
        <p className="banner-warn no-print">
          ⚠ {nonConformes} équipe{nonConformes > 1 ? 's' : ''} en anomalie de licence — survolez
          le voyant de la colonne « Licences » pour le détail.
        </p>
      )}

      <div className="table-scroll">
      <table className="teams-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>{individual ? 'Participant' : 'Joueurs'}</th>
            <th>Club</th>
            {controlActif && <th title="Contrôle des licences">Licences</th>}
            {trackPaid && <th className="cell-paid">Réglé</th>}
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) =>
            editingId === team.id ? (
              <TeamEditRow
                key={team.id}
                team={team}
                nbPlayers={nbPlayers}
                trackPaid={trackPaid}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <tr key={team.id} className={team.forfait ? 'row-forfait' : ''}>
                <td className="cell-number">{team.number}</td>
                <td>
                  {team.players.map((p, i) => (
                    <span key={i} className="player-chip">
                      {p.name}
                      {p.licence && <em className="licence"> {p.licence}</em>}
                    </span>
                  ))}
                  {team.forfait && <span className="tag tag-danger">Forfait</span>}
                </td>
                <td>{team.club ?? ''}</td>
                {controlActif && (
                  <td className="cell-controle">
                    <ControleBadge controle={controles.get(team.id)} />
                  </td>
                )}
                {trackPaid && (
                  <td className="cell-paid">
                    <label className="paid-toggle" title="Engagement réglé">
                      <input
                        type="checkbox"
                        checked={team.paid ?? false}
                        onChange={(e) => void updateTeam({ ...team, paid: e.target.checked })}
                      />
                      <span>{team.paid ? `${mise.toLocaleString('fr-FR')} €` : '—'}</span>
                    </label>
                  </td>
                )}
                <td className="no-print cell-actions">
                  {!locked && (
                    <button
                      className="btn-icon"
                      title="Modifier"
                      onClick={() => setEditingId(team.id)}
                    >
                      ✎
                    </button>
                  )}
                  <button
                    className="btn-icon"
                    title={team.forfait ? 'Annuler le forfait' : 'Déclarer forfait'}
                    onClick={() => void updateTeam({ ...team, forfait: !team.forfait })}
                  >
                    {team.forfait ? '↩' : 'FF'}
                  </button>
                  {!locked && (
                    <button
                      className="btn-icon btn-icon-danger"
                      title="Supprimer"
                      onClick={() => {
                        if (window.confirm(`Supprimer l'équipe n°${team.number} ?`)) {
                          void deleteTeam(team);
                        }
                      }}
                    >
                      🗑
                    </button>
                  )}
                </td>
              </tr>
            ),
          )}
          {teams.length === 0 && (
            <tr>
              <td colSpan={trackPaid ? 5 : 4} className="empty-cell">
                {individual
                  ? 'Aucun participant inscrit — chacun s\'inscrit seul, les équipes seront tirées au sort.'
                  : 'Aucune équipe inscrite.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      <p className="teams-footer">
        <strong>{teams.length}</strong>{' '}
        {individual
          ? `participant${teams.length > 1 ? 's' : ''} inscrit${teams.length > 1 ? 's' : ''}`
          : `équipe${teams.length > 1 ? 's' : ''} inscrite${teams.length > 1 ? 's' : ''}`}
        {concours.mode === 'poules' &&
          teams.length > 0 &&
          (summary ? ` → ${summary}` : ' — effectif incompatible avec des poules (4, 6, 7, 8… équipes)')}
        {individual &&
          teams.length > 1 &&
          ` → ${FORMAT_LABELS[concours.format].toLowerCase()}s tirées au sort à chaque ronde`}
      </p>

      {trackPaid && engagements > 0 && (
        <p className="caisse-summary">
          💰 Caisse : <strong>{paidCount}/{engagements}</strong> engagement
          {engagements > 1 ? 's' : ''} réglé{paidCount > 1 ? 's' : ''} ·{' '}
          <strong>{(paidCount * mise).toLocaleString('fr-FR')} €</strong> encaissés
          {paidCount < engagements && (
            <> · reste {((engagements - paidCount) * mise).toLocaleString('fr-FR')} € à percevoir</>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Voyant de contrôle d'une équipe, à la manière du logiciel fédéral : vert si
 * tout est conforme, sinon la liste des champs fautifs.
 */
function ControleBadge({ controle }: { controle?: ControleEquipe }) {
  if (!controle) return null;
  if (controle.conforme) {
    return (
      <span className="tag tag-ok" title="Licences conformes aux critères du concours">
        ✓
      </span>
    );
  }
  const motifs = new Set<string>();
  for (const a of controle.anomaliesEquipe) motifs.add(ANOMALIE_EQUIPE_LABELS[a]);
  for (const j of controle.joueurs) {
    if (j.inconnu) motifs.add('joueur absent du fichier des licenciés');
    for (const a of j.anomalies) motifs.add(ANOMALIE_LABELS[a]);
  }
  const texte = [...motifs].join(', ');
  return (
    <span className="tag tag-danger" title={texte}>
      ⚠ {texte}
    </span>
  );
}

function TeamEditRow({
  team,
  nbPlayers,
  trackPaid,
  onDone,
}: {
  team: Team;
  nbPlayers: number;
  trackPaid: boolean;
  onDone: () => void;
}) {
  const [names, setNames] = useState<string[]>(
    Array.from({ length: nbPlayers }, (_, i) => team.players[i]?.name ?? ''),
  );
  const [licences, setLicences] = useState<string[]>(
    Array.from({ length: nbPlayers }, (_, i) => team.players[i]?.licence ?? ''),
  );
  const [club, setClub] = useState(team.club ?? '');

  const save = async () => {
    const players: Player[] = names
      .map((name, i) => ({ name: name.trim(), licence: licences[i]?.trim() || undefined }))
      .filter((p) => p.name.length > 0);
    if (players.length === 0) return;
    await updateTeam({ ...team, players, club: club.trim() || undefined });
    onDone();
  };

  return (
    <tr className="row-editing">
      <td className="cell-number">{team.number}</td>
      <td>
        {Array.from({ length: nbPlayers }, (_, i) => (
          <div key={i} className="player-inputs">
            <input
              value={names[i] ?? ''}
              onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
              placeholder={`Joueur ${i + 1}`}
            />
            <input
              className="licence-input"
              value={licences[i] ?? ''}
              onChange={(e) =>
                setLicences(licences.map((l, j) => (j === i ? e.target.value : l)))
              }
              placeholder="N° licence"
            />
          </div>
        ))}
      </td>
      <td>
        <input value={club} onChange={(e) => setClub(e.target.value)} placeholder="Club" />
      </td>
      {trackPaid && <td className="cell-paid">—</td>}
      <td className="cell-actions">
        <button className="btn btn-primary btn-sm" onClick={() => void save()}>
          OK
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>
          ✕
        </button>
      </td>
    </tr>
  );
}
