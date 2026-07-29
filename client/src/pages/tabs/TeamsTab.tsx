import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LicenceScanModal } from '../../components/LicenceScanModal';
import { MultisiteModal } from '../../components/MultisiteModal';
import type { Concours, Player, RolePetanque, Team } from '@shared';
import { addTeam, deleteTeam, importerInscrits, updateTeam } from '../../db/actions';
import { pouleSummary } from '../../db/actions';
import { useLicencies } from '../../db/hooks';
import { aDesCriteresLicence, controlerEquipe, libelleClubs, type ControleEquipe } from '@shared';
import { ANOMALIE_EQUIPE_LABELS, ANOMALIE_LABELS } from '../../lib/labels';
import { RegistrationsPanel } from '../../components/RegistrationsPanel';
import {
  FORMAT_LABELS,
  PLAYERS_PER_TEAM,
  ROLE_ABREGE,
  ROLE_LABELS,
  isIndividualMode,
} from '../../lib/labels';

interface Props {
  concours: Concours;
  teams: Team[];
}

export function TeamsTab({ concours, teams }: Props) {
  const [scanning, setScanning] = useState(false);
  const [multisite, setMultisite] = useState(false);
  /**
   * Mode modification (manuel §3.B.8) : après le tirage, la composition
   * redevient modifiable — un joueur se remplace — sans toucher au tirage.
   */
  const [modification, setModification] = useState(false);
  const [erreurModif, setErreurModif] = useState<string | null>(null);
  const [bilanImport, setBilanImport] = useState<string | null>(null);
  const individual = isIndividualMode(concours.mode);
  const nbPlayers = individual ? 1 : PLAYERS_PER_TEAM[concours.format];
  const locked = concours.status !== 'inscriptions';
  /**
   * Le rôle de jeu ne sert qu'au tirage des mêlées : il n'a pas de sens quand
   * les équipes sont déjà constituées, ni en tête-à-tête.
   */
  const avecRoles = concours.mode === 'melee' && concours.format !== 'tete_a_tete';
  const rolesProposes: RolePetanque[] =
    concours.format === 'triplette' ? ['pointeur', 'milieu', 'tireur'] : ['pointeur', 'tireur'];
  const [names, setNames] = useState<string[]>(Array(nbPlayers).fill(''));
  const [licences, setLicences] = useState<string[]>(Array(nbPlayers).fill(''));
  const [clubs, setClubs] = useState<string[]>(Array(nbPlayers).fill(''));
  const [roles, setRoles] = useState<(RolePetanque | '')[]>(Array(nbPlayers).fill(''));
  const [club, setClub] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const licencies = useLicencies() ?? [];
  const licencieByName = new Map(licencies.map((l) => [l.name.toLowerCase(), l]));
  const licencieByLicence = new Map(
    licencies.filter((l) => l.licence).map((l) => [l.licence!, l]),
  );

  /* Contrôle des licences : seulement s'il y a de quoi contrôler — des
     critères fédéraux, ou au moins un fichier de licenciés importé. */
  const criteresFederaux = aDesCriteresLicence(concours);
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
  /** Remplit ce qu'on sait d'un licencié trouvé par son nom. */
  const applyLicencie = (i: number, value: string) => {
    const found = licencieByName.get(value.trim().toLowerCase());
    if (!found) return;
    if (found.licence) {
      setLicences((prev) => prev.map((l, j) => (j === i && !l ? found.licence! : l)));
    }
    if (found.club) {
      setClubs((prev) => prev.map((c, j) => (j === i && !c ? found.club! : c)));
      if (!club) setClub(found.club);
    }
  };

  /**
   * Recherche par n° de licence, comme le prévoit le manuel §3.B.1 : le
   * numéro suffit, le nom et le club se remplissent seuls.
   */
  const applyLicenceNumero = (i: number, numero: string) => {
    const found = licencieByLicence.get(numero.trim());
    if (!found) return;
    setNames((prev) => prev.map((n, j) => (j === i && !n.trim() ? found.name : n)));
    if (found.club) {
      setClubs((prev) => prev.map((c, j) => (j === i && !c ? found.club! : c)));
      if (!club) setClub(found.club);
    }
  };

  // La formation peut changer tant qu'on est aux inscriptions.
  if (names.length !== nbPlayers) {
    setNames(Array(nbPlayers).fill(''));
    setLicences(Array(nbPlayers).fill(''));
    setClubs(Array(nbPlayers).fill(''));
    setRoles(Array(nbPlayers).fill(''));
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const players: Player[] = names
      .map((name, i) => ({
        name: name.trim(),
        licence: licences[i]?.trim() || undefined,
        // À défaut de club propre, celui de l'équipe : un concours de club
        // n'a pas à saisir la même chose trois fois.
        club: clubs[i]?.trim() || club.trim() || undefined,
        role: roles[i] || undefined,
      }))
      .filter((p) => p.name.length > 0);
    if (players.length === 0) return;
    setErreurModif(null);
    try {
      await addTeam(concours.id, players, club);
    } catch (err) {
      // Refus à l'écriture : on le montre au lieu de perdre la saisie sans
      // rien dire — c'est ce qui rendait le défaut invisible.
      setErreurModif(err instanceof Error ? err.message : String(err));
      return;
    }
    setNames(Array(nbPlayers).fill(''));
    setLicences(Array(nbPlayers).fill(''));
    setClubs(Array(nbPlayers).fill(''));
    setRoles(Array(nbPlayers).fill(''));
    firstInput.current?.focus();
  };

  /** Import d'une liste d'inscrits (manuel §3.B.10.B). */
  const importer = async (fichier: File | undefined): Promise<void> => {
    if (!fichier) return;
    setErreurModif(null);
    setBilanImport(null);
    const res = await importerInscrits(concours, await fichier.text());
    if (!res.ok) {
      setErreurModif(res.erreur);
      return;
    }
    setBilanImport(
      `${res.ajoutees} équipe${res.ajoutees > 1 ? 's' : ''} importée${res.ajoutees > 1 ? 's' : ''}` +
        (res.numerosConserves ? ', dossards du fichier conservés' : ', numérotées à la suite') +
        (res.ignorees > 0
          ? ` — ${res.ignorees} ligne${res.ignorees > 1 ? 's' : ''} sans joueur ignorée${res.ignorees > 1 ? 's' : ''}.`
          : '.'),
    );
  };

  const summary =
    concours.mode === 'poules' ? pouleSummary(teams.length, concours.nbTerrains) : null;
  const mise = concours.miseParEquipe ?? 0;
  const trackPaid = mise > 0;
  const paidCount = teams.filter((t) => t.paid && !t.forfait).length;
  const engagements = teams.filter((t) => !t.forfait).length;

  return (
    <div className="tab-content">
      {!locked && <RegistrationsPanel concours={concours} />}

      {!locked && (
        <div className="export-bar no-print">
          <span className="export-bar-label">Inscrire :</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setScanning(true)}>
            📷 Au lecteur de licences
          </button>
          <span className="hint">Caméra, douchette USB ou saisie du n° de licence.</span>
          <label className="btn btn-ghost btn-sm" title="Reprendre une liste d'inscrits (CSV)">
            📥 Importer une liste (CSV)
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              hidden
              onChange={(e) => {
                void importer(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {bilanImport && <p className="banner-warn no-print">📥 {bilanImport}</p>}

      {/* Fractionnement multisite (manuel §3.B.10.D) : avant le tirage, et
          seulement si l'effectif permet de donner 2 équipes à chaque site. */}
      {!locked && teams.filter((t) => !t.forfait).length >= 4 && (
        <div className="export-bar no-print">
          <span className="export-bar-label">Plusieurs sites :</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setMultisite(true)}>
            🏟 Fractionner en plusieurs sites
          </button>
          <span className="hint">
            Un concours par site, quand un seul boulodrome n'a pas assez de terrains.
          </span>
        </div>
      )}

      {multisite && (
        <MultisiteModal concours={concours} teams={teams} onClose={() => setMultisite(false)} />
      )}

      {scanning && (
        <LicenceScanModal concours={concours} teams={teams} onClose={() => setScanning(false)} />
      )}

      {!locked && (
        <form className="team-add-form no-print" data-tour="inscrire" onSubmit={(e) => void submit(e)}>
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
                  onChange={(e) => {
                    setLicences(licences.map((l, j) => (j === i ? e.target.value : l)));
                    applyLicenceNumero(i, e.target.value);
                  }}
                  placeholder="N° licence"
                />
                <input
                  className="club-input club-input-joueur"
                  value={clubs[i] ?? ''}
                  onChange={(e) => setClubs(clubs.map((c, j) => (j === i ? e.target.value : c)))}
                  placeholder={i === 0 ? 'Club' : 'Club (si différent)'}
                  list="clubs-connus"
                />
                {avecRoles && (
                  <select
                    className="role-select"
                    value={roles[i] ?? ''}
                    onChange={(e) =>
                      setRoles(
                        roles.map((r, j) => (j === i ? (e.target.value as RolePetanque | '') : r)),
                      )
                    }
                    title="Rôle de prédilection : le tirage évite d'aligner trois pointeurs"
                  >
                    <option value="">Rôle indifférent</option>
                    {rolesProposes.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <input
            className="club-input"
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="Club de l'équipe (facultatif)"
            title="Utilisé pour les joueurs dont le club n'est pas précisé"
            list="clubs-connus"
          />
          <datalist id="clubs-connus">
            {[...new Set([
              ...teams.map((t) => t.club),
              ...teams.flatMap((t) => t.players.map((p) => p.club)),
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

      {locked && !modification && (
        <p className="hint no-print">
          Inscriptions verrouillées : le tirage a été effectué. Vous pouvez marquer un forfait, ou{' '}
          <button className="btn-lien" onClick={() => setModification(true)}>
            passer en mode modification
          </button>{' '}
          pour remplacer un joueur sans toucher au tirage.
        </p>
      )}

      {locked && modification && (
        <p className="banner-warn no-print">
          ✎ Mode modification — vous pouvez remplacer ou ajouter un joueur. Le tirage n'est pas
          touché : ni les numéros de dossard, ni les places au tableau. Le contrôle des licences se
          refait à chaque changement.{' '}
          <button className="btn-lien" onClick={() => { setModification(false); setEditingId(null); }}>
            Terminer
          </button>
        </p>
      )}

      {erreurModif && <p className="form-error no-print">{erreurModif}</p>}

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
                avecRoles={avecRoles}
                rolesProposes={rolesProposes}
                onErreur={setErreurModif}
                onDone={() => {
                  setEditingId(null);
                  setErreurModif(null);
                }}
              />
            ) : (
              <tr key={team.id} className={team.forfait ? 'row-forfait' : ''}>
                <td className="cell-number">{team.number}</td>
                <td>
                  {team.players.map((p, i) => (
                    <span key={i} className="player-chip">
                      {p.name}
                      {p.licence && <em className="licence"> {p.licence}</em>}
                      {avecRoles && p.role && (
                        <span className="role-tag" title={ROLE_LABELS[p.role]}>
                          {ROLE_ABREGE[p.role]}
                        </span>
                      )}
                    </span>
                  ))}
                  {team.forfait && <span className="tag tag-danger">Forfait</span>}
                </td>
                <td>{libelleClubs(team.players, team.club) || (team.club ?? '')}</td>
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
                  {(!locked || modification) && (
                    <button
                      className="btn-icon"
                      title={
                        locked
                          ? 'Modifier la composition (le tirage n\'est pas touché)'
                          : 'Modifier'
                      }
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
  avecRoles,
  rolesProposes,
  onErreur,
  onDone,
}: {
  team: Team;
  nbPlayers: number;
  trackPaid: boolean;
  avecRoles: boolean;
  rolesProposes: RolePetanque[];
  onErreur: (message: string | null) => void;
  onDone: () => void;
}) {
  const [names, setNames] = useState<string[]>(
    Array.from({ length: nbPlayers }, (_, i) => team.players[i]?.name ?? ''),
  );
  const [licences, setLicences] = useState<string[]>(
    Array.from({ length: nbPlayers }, (_, i) => team.players[i]?.licence ?? ''),
  );
  const [roles, setRoles] = useState<(RolePetanque | '')[]>(
    Array.from({ length: nbPlayers }, (_, i) => team.players[i]?.role ?? ''),
  );
  const [club, setClub] = useState(team.club ?? '');

  const save = async () => {
    const players: Player[] = names
      // On repart de la fiche existante : le club du joueur et tout ce que la
      // ligne de modification n'affiche pas doivent survivre à un « OK ».
      .map((name, i) => ({
        ...team.players[i],
        name: name.trim(),
        licence: licences[i]?.trim() || undefined,
        role: roles[i] || undefined,
      }))
      .filter((p) => p.name.length > 0);
    if (players.length === 0) return;
    try {
      await updateTeam({ ...team, players, club: club.trim() || undefined });
    } catch (err) {
      // Refus de la règle d'après-tirage : on le montre au lieu de perdre la saisie.
      onErreur(err instanceof Error ? err.message : String(err));
      return;
    }
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
            {avecRoles && (
              <select
                className="role-select"
                value={roles[i] ?? ''}
                onChange={(e) =>
                  setRoles(
                    roles.map((r, j) => (j === i ? (e.target.value as RolePetanque | '') : r)),
                  )
                }
              >
                <option value="">Rôle indifférent</option>
                {rolesProposes.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            )}
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
