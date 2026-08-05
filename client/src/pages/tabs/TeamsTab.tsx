import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LicenceEtrangereModal } from '../../components/LicenceEtrangereModal';
import { LicenceScanModal } from '../../components/LicenceScanModal';
import { Modal } from '../../components/Modal';
import { MultisiteModal } from '../../components/MultisiteModal';
import type { Concours, Licencie, Player, Poule, RolePetanque, Team } from '@shared';
import { addTeam, deleteTeam, importerInscrits, insererEquipe, updateTeam } from '../../db/actions';
import { pouleSummary } from '../../db/actions';
import { useLicencies } from '../../db/hooks';
import {
  ETATS_MISE,
  PAYS_LICENCE_ETRANGERE,
  comiteDuJoueur,
  aDesCriteresLicence,
  bilanMises,
  etatMise,
  poserMise,
  type EtatMise,
  chercherEquipes,
  controlerEquipe,
  libelleClubs,
  type ControleEquipe,
} from '@shared';
import { ANOMALIE_EQUIPE_LABELS, ANOMALIE_LABELS, ETAT_MISE_LABELS } from '../../lib/labels';
import { RegistrationsPanel } from '../../components/RegistrationsPanel';
import { exportListeSpecifique } from '../../lib/export';
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
  /** Poules déjà tirées : sert à dire où joue une équipe retrouvée. */
  poules: Poule[];
}

export function TeamsTab({ concours, teams, poules }: Props) {
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
  /**
   * Colonne « CD » de la grille fédérale (§3.B.1, zone 15) : le comité du joueur.
   * Prérempli depuis sa licence, corrigible — la copie d'écran p.25 montre une
   * équipe à trois comités différents.
   */
  const [comites, setComites] = useState<string[]>(Array(nbPlayers).fill(''));
  /**
   * Pays d'une licence étrangère (manuel §3.B.1, zone 21). Saisi à la place du
   * numéro : le joueur a une licence, elle n'est pas française.
   */
  const [etrangeres, setEtrangeres] = useState<string[]>(Array(nbPlayers).fill(''));
  /** Index du joueur dont on ouvre la fiche étrangère, ou `null`. */
  const [ficheEtrangere, setFicheEtrangere] = useState<number | null>(null);
  const [roles, setRoles] = useState<(RolePetanque | '')[]>(Array(nbPlayers).fill(''));
  const [club, setClub] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  /**
   * Recherche d'équipe (manuel §3.D.1.D, « la loupe ») : « je suis dans quelle
   * poule ? » est la question la plus posée à la table de marque, et sur cent
   * équipes la liste ne répond pas.
   */
  const [recherche, setRecherche] = useState('');
  /**
   * Dossard devant lequel insérer une équipe (manuel §3.B.1, zone 24). `null` =
   * pas d'insertion en cours.
   */
  const [insertionAvant, setInsertionAvant] = useState<number | null>(null);
  /**
   * Liste spécifique (manuel §3.D.1.B.5.1) : une sélection cochée à la main
   * pendant le concours, exportée pour amorcer le suivant. Le manuel en fait la
   * sortie normale d'un qualificatif.
   */
  const retenues = teams.filter((t) => t.retenue).length;
  const trouvailles = useMemo(() => chercherEquipes(teams, recherche), [teams, recherche]);
  /** Liste affichée : filtrée dès qu'une recherche est en cours. */
  const affichees =
    recherche.trim().length > 0 ? trouvailles.map((t) => t.team) : teams;
  /**
   * Où joue cette équipe, si on le sait : c'est la vraie réponse à « je suis
   * dans quelle poule ? ». La poule est cherchée dans les poules du concours.
   */
  const placeDe = (teamId: string): string => {
    const poule = poules.find((p) => p.teamIds.includes(teamId));
    return poule ? `poule ${poule.index}` : '';
  };
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
          }, t.club),
        ])
      : [],
  );
  const nonConformes = [...controles.values()].filter((c) => !c.conforme).length;

  /** Autocomplétion : un nom du fichier des licenciés remplit licence et club. */
  /** Remplit ce qu'on sait d'un licencié trouvé par son nom. */
  /**
   * Comité prérempli depuis la fiche du licencié, ou à défaut des trois premiers
   * chiffres de son numéro. Valeur par défaut et non vérité : elle reste
   * corrigible, la copie d'écran p.25 montrant une équipe à trois comités.
   */
  const remplirComite = (i: number, found: Licencie): void => {
    const comite = comiteDuJoueur(
      { name: found.name, licence: found.licence, comite: found.comite },
      licencieByLicence,
    );
    if (comite) setComites((prev) => prev.map((c, j) => (j === i && !c ? comite : c)));
  };

  /**
   * Tient le club d'équipe d'accord avec les clubs des joueurs.
   *
   * Le champ « club de l'équipe » ne vaut que pour une équipe qui en a **un**.
   * L'autocomplétion le remplissait depuis le premier joueur trouvé et l'y
   * laissait : une équipe de deux clubs se retrouvait donc à déclarer celui du
   * premier — ce que le manuel appelle « Club Equipe Incorrect : devrait être
   * NH » (§3.B.6), et ce que quatre documents lisent directement.
   *
   * Trois cas, et le dernier est le seul qui efface :
   *  - aucun club de joueur connu : on ne touche à rien, le champ sert de valeur
   *    par défaut à tout le monde ;
   *  - un seul club : on le propose s'il n'y a rien de saisi ;
   *  - deux clubs ou plus : **on vide**, parce qu'aucune valeur n'est vraie. Le
   *    libellé affichera « CLUB A / CLUB B », qui est la vérité.
   */
  const accorderClubEquipe = (clubsJoueurs: string[]): void => {
    const distincts = [
      ...new Set(clubsJoueurs.map((c) => c.trim()).filter(Boolean).map((c) => c.toLowerCase())),
    ];
    if (distincts.length === 0) return;
    if (distincts.length > 1) {
      setClub('');
      return;
    }
    const seul = clubsJoueurs.map((c) => c.trim()).find(Boolean)!;
    setClub((prev) => (prev.trim() ? prev : seul));
  };

  const applyLicencie = (i: number, value: string) => {
    const found = licencieByName.get(value.trim().toLowerCase());
    if (!found) return;
    if (found.licence) {
      setLicences((prev) => prev.map((l, j) => (j === i && !l ? found.licence! : l)));
    }
    if (found.club) {
      setClubs((prev) => {
        const suivant = prev.map((c, j) => (j === i && !c ? found.club! : c));
        accorderClubEquipe(suivant);
        return suivant;
      });
    }
    remplirComite(i, found);
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
      setClubs((prev) => {
        const suivant = prev.map((c, j) => (j === i && !c ? found.club! : c));
        accorderClubEquipe(suivant);
        return suivant;
      });
    }
    remplirComite(i, found);
  };

  // La formation peut changer tant qu'on est aux inscriptions.
  if (names.length !== nbPlayers) {
    setNames(Array(nbPlayers).fill(''));
    setLicences(Array(nbPlayers).fill(''));
    setClubs(Array(nbPlayers).fill(''));
    setComites(Array(nbPlayers).fill(''));
    setRoles(Array(nbPlayers).fill(''));
    setEtrangeres(Array(nbPlayers).fill(''));
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const players: Player[] = names
      .map((name, i) => ({
        name: name.trim(),
        licence: licences[i]?.trim() || undefined,
        licenceEtrangere: licences[i]?.trim()
          ? undefined
          : etrangeres[i]?.trim().toUpperCase() || undefined,
        // À défaut de club propre, celui de l'équipe : un concours de club
        // n'a pas à saisir la même chose trois fois.
        club: clubs[i]?.trim() || club.trim() || undefined,
        comite: comites[i]?.trim() || undefined,
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
    setComites(Array(nbPlayers).fill(''));
    setRoles(Array(nbPlayers).fill(''));
    setEtrangeres(Array(nbPlayers).fill(''));
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
  const bilan = bilanMises(teams, mise);
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
                {/* Colonne « CD » de la grille fédérale, avant le n° de licence
                    comme dans le manuel. Réservée aux concours à critères
                    fédéraux : sur un concours de club, personne ne regarde le
                    comité, et la ligne de saisie est déjà chargée. */}
                {criteresFederaux && (
                  <input
                    className="comite-input"
                    value={comites[i] ?? ''}
                    onChange={(e) =>
                      setComites(comites.map((c, j) => (j === i ? e.target.value : c)))
                    }
                    placeholder="CD"
                    maxLength={3}
                    inputMode="numeric"
                    title="Comité départemental (manuel §3.B.1, zone 15). Prérempli depuis la licence, corrigible : un joueur peut relever d'un autre comité."
                  />
                )}
                <input
                  className="licence-input"
                  value={licences[i] ?? ''}
                  onChange={(e) => {
                    setLicences(licences.map((l, j) => (j === i ? e.target.value : l)));
                    applyLicenceNumero(i, e.target.value);
                  }}
                  placeholder="N° licence"
                />
                {!licences[i]?.trim() && (
                  <span className="licence-etrangere-groupe">
                    {/* Une liste et non un code libre : le contingent hors UE se
                        calcule sur ce code, et un « SUI » tapé à la main ne
                        compterait dans aucun contrôle. */}
                    <select
                      className="licence-etrangere"
                      value={etrangeres[i] ?? ''}
                      onChange={(e) =>
                        setEtrangeres(etrangeres.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      title="Manuel §3.B.1, zone 21 : joueur affilié à la fédération de son pays. Le pays compte au contingent hors UE."
                    >
                      <option value="">Licence française</option>
                      {PAYS_LICENCE_ETRANGERE.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.nom}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setFicheEtrangere(i)}
                      title="Fiche de licence étrangère, conservée sur la base personnelle"
                    >
                      🌍 Fiche
                    </button>
                  </span>
                )}
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

      {retenues > 0 && (
        <p className="hint no-print">
          📋 Liste spécifique : {retenues} équipe{retenues > 1 ? 's' : ''} retenue
          {retenues > 1 ? 's' : ''}.{' '}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => exportListeSpecifique(concours, teams)}
          >
            Exporter (CSV)
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              for (const t of teams.filter((x) => x.retenue)) {
                void updateTeam({ ...t, retenue: undefined });
              }
            }}
          >
            Tout décocher
          </button>
        </p>
      )}

      {teams.length >= 8 && (
        <div className="recherche-equipe no-print">
          <label>
            🔍 Retrouver une équipe
            <input
              type="search"
              value={recherche}
              placeholder="Nom d'un joueur, dossard, licence ou club"
              onChange={(e) => setRecherche(e.target.value)}
            />
          </label>
          {recherche.trim().length > 0 && (
            <span className="hint">
              {trouvailles.length === 0
                ? 'Aucune équipe ne correspond.'
                : `${trouvailles.length} équipe${trouvailles.length > 1 ? 's' : ''} : ${trouvailles
                    .map(
                      (t) =>
                        `n°${t.team.number}${
                          t.motif === 'joueur' || t.motif === 'licence' ? ` (${t.joueur})` : ''
                        }${placeDe(t.team.id) ? ` — ${placeDe(t.team.id)}` : ''}`,
                    )
                    .join(', ')}`}
            </span>
          )}
        </div>
      )}

      <div className="table-scroll">
      <table className="teams-table">
        <thead>
          <tr>
            <th className="no-print" title="Liste spécifique (manuel §3.D.1.B.5.1)">
              ✓
            </th>
            <th>N°</th>
            <th>{individual ? 'Participant' : 'Joueurs'}</th>
            <th>Club</th>
            {controlActif && <th title="Contrôle des licences">Licences</th>}
            {trackPaid && <th className="cell-paid">Mise</th>}
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {affichees.map((team) =>
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
                <td className="no-print cell-retenue">
                  <input
                    type="checkbox"
                    checked={team.retenue ?? false}
                    title="Retenir dans la liste spécifique"
                    onChange={(e) =>
                      void updateTeam({ ...team, retenue: e.target.checked || undefined })
                    }
                  />
                </td>
                <td className="cell-number">{team.number}</td>
                <td>
                  {team.players.map((p, i) => (
                    <span key={i} className="player-chip">
                      {p.name}
                      {p.licence && <em className="licence"> {p.licence}</em>}
                      {!p.licence && p.licenceEtrangere && (
                        <em className="licence" title="Licence étrangère">
                          {' '}
                          🌍 {p.licenceEtrangere}
                        </em>
                      )}
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
                    {/* Trois états, comme le cadre « Mises » du manuel : une case
                        à cocher ne pouvait pas dire « facturation ». */}
                    <select
                      className="mise-select"
                      value={etatMise(team)}
                      onChange={(e) =>
                        void updateTeam(poserMise(team, e.target.value as EtatMise))
                      }
                      title="Mise de l'équipe (manuel §3.B.1, zone 19)"
                    >
                      {ETATS_MISE.map((etat) => (
                        <option key={etat} value={etat}>
                          {ETAT_MISE_LABELS[etat]}
                        </option>
                      ))}
                    </select>
                    <input
                      className="mise-commentaire"
                      value={team.commentaireMise ?? ''}
                      onChange={(e) =>
                        void updateTeam({ ...team, commentaireMise: e.target.value || undefined })
                      }
                      placeholder="Commentaire"
                      title="Champ « Commentaire » du cadre « Mises »"
                    />
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
                  {!locked && (
                    <button
                      className="btn-icon"
                      title={`Insérer une équipe avant le n°${team.number} (les suivants décalent)`}
                      onClick={() => setInsertionAvant(team.number)}
                    >
                      ↧
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
          💰 Caisse : <strong>{bilan.parEtat.paye}/{engagements}</strong> engagement
          {engagements > 1 ? 's' : ''} réglé{bilan.parEtat.paye > 1 ? 's' : ''} ·{' '}
          <strong>{bilan.encaisse.toLocaleString('fr-FR')} €</strong> encaissés
          {/* Les trois montants restent séparés : mélanger la facturation à
              l'encaissé fausse le compte de caisse, la mélanger à l'impayé fait
              courir après un règlement déjà réglé. */}
          {bilan.aFacturer > 0 && (
            <>
              {' '}
              · <strong>{bilan.aFacturer.toLocaleString('fr-FR')} €</strong> à facturer (
              {bilan.parEtat.facturation} équipe{bilan.parEtat.facturation > 1 ? 's' : ''})
            </>
          )}
          {bilan.restantDu > 0 && (
            <> · reste {bilan.restantDu.toLocaleString('fr-FR')} € à percevoir</>
          )}
        </p>
      )}

      {insertionAvant !== null && (
        <InsertionModal
          concours={concours}
          dossard={insertionAvant}
          nbPlayers={nbPlayers}
          onClose={() => setInsertionAvant(null)}
        />
      )}

      {ficheEtrangere !== null && (
        <LicenceEtrangereModal
          onChoisir={(joueur) => {
            const i = ficheEtrangere;
            setNames(names.map((n, j) => (j === i ? joueur.name : n)));
            setEtrangeres(etrangeres.map((v, j) => (j === i ? joueur.licenceEtrangere : v)));
            // Une licence étrangère n'est pas un numéro fédéral : le champ
            // français reste vide, sinon on chercherait une fiche inexistante.
            setLicences(licences.map((l, j) => (j === i ? '' : l)));
          }}
          onClose={() => setFicheEtrangere(null)}
        />
      )}
    </div>
  );
}

/**
 * Insertion d'une équipe à un dossard donné (manuel §3.B.1, zone 24).
 *
 * Le dossard est annoncé en clair avec sa conséquence : les suivants décalent.
 * C'est irréversible pour les étiquettes déjà distribuées, donc ça se dit avant,
 * pas après.
 */
function InsertionModal({
  concours,
  dossard,
  nbPlayers,
  onClose,
}: {
  concours: Concours;
  dossard: number;
  nbPlayers: number;
  onClose: () => void;
}) {
  const [names, setNames] = useState<string[]>(Array(nbPlayers).fill(''));
  const [club, setClub] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = async (): Promise<void> => {
    const players = names
      .map((name) => ({ name: name.trim() }))
      .filter((p) => p.name.length > 0);
    if (players.length === 0) {
      setErreur('Il faut au moins un joueur.');
      return;
    }
    try {
      await insererEquipe(concours, dossard, players, club);
      onClose();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal title={`Insérer une équipe au n°${dossard}`} onClose={onClose}>
      <p>
        L'équipe prendra le dossard <strong>{dossard}</strong>, et toutes les équipes à partir de ce
        numéro monteront d'un cran.
      </p>
      <p className="hint">
        Les étiquettes déjà distribuées à partir du n°{dossard} ne correspondront plus : réimprimez
        la liste des inscrits après l'insertion.
      </p>
      {names.map((name, i) => (
        <label key={i}>
          Joueur {i + 1}
          <input
            value={name}
            onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
          />
        </label>
      ))}
      <label>
        Club
        <input value={club} onChange={(e) => setClub(e.target.value)} />
      </label>
      {erreur && <p className="form-error">{erreur}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" onClick={() => void valider()}>
          Insérer
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Modal>
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
      <td className="no-print" />
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
