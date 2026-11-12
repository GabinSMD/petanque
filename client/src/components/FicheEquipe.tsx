import { useState } from 'react';
import type { Concours, Match, Player, Poule, RolePetanque, Team } from '@shared';
import { TAILLE_FORMATION, libelleClubs, parcoursEquipe } from '@shared';
import { updateTeam } from '../db/actions';
import { ROLE_LABELS, isIndividualMode } from '../lib/labels';
import { Modal } from './Modal';

/**
 * Ce que la saisie d'une composition demande au concours : le nombre de
 * joueurs, et si l'on propose un rôle. Partagé entre l'onglet Inscriptions et
 * la fiche équipe, pour que les deux écrans posent les mêmes questions.
 */
export function parametresSaisie(concours: Concours): {
  individual: boolean;
  nbPlayers: number;
  avecRoles: boolean;
  rolesProposes: RolePetanque[];
} {
  const individual = isIndividualMode(concours.mode);
  return {
    individual,
    nbPlayers: individual ? 1 : TAILLE_FORMATION[concours.format],
    // Le rôle de jeu ne sert qu'au tirage des mêlées : il n'a pas de sens
    // quand les équipes sont déjà constituées, ni en tête-à-tête.
    avecRoles: concours.mode === 'melee' && concours.format !== 'tete_a_tete',
    rolesProposes:
      concours.format === 'triplette' ? ['pointeur', 'milieu', 'tireur'] : ['pointeur', 'tireur'],
  };
}

/**
 * Modification d'une composition (manuel §3.B.8, repris par §3.D.1.C : « vous
 * pouvez modifier les joueurs de la même manière que dans Préparer Concours »).
 * La ligne de l'onglet Inscriptions et la fiche équipe l'emploient toutes deux.
 */
export function useSaisieEquipe(team: Team, nbPlayers: number) {
  const depart = <T,>(lire: (p: Player | undefined) => T): T[] =>
    Array.from({ length: nbPlayers }, (_, i) => lire(team.players[i]));
  const [names, setNames] = useState<string[]>(() => depart((p) => p?.name ?? ''));
  const [licences, setLicences] = useState<string[]>(() => depart((p) => p?.licence ?? ''));
  const [roles, setRoles] = useState<(RolePetanque | '')[]>(() => depart((p) => p?.role ?? ''));
  const [club, setClub] = useState(team.club ?? '');

  const remplacer = <T,>(liste: T[], i: number, v: T): T[] => liste.map((x, j) => (j === i ? v : x));

  /**
   * Enregistre. Rend `null` si c'est fait, sinon la raison du refus — la règle
   * d'après-tirage de `updateTeam`, ou une équipe vidée de ses joueurs.
   */
  const enregistrer = async (): Promise<string | null> => {
    const players: Player[] = names
      // On repart de la fiche existante : le club du joueur et tout ce que le
      // formulaire n'affiche pas doivent survivre à un « OK ».
      .map((name, i) => ({
        ...team.players[i],
        name: name.trim(),
        licence: licences[i]?.trim() || undefined,
        role: roles[i] || undefined,
      }))
      .filter((p) => p.name.length > 0);
    if (players.length === 0) return 'Il faut au moins un joueur.';
    try {
      await updateTeam({ ...team, players, club: club.trim() || undefined });
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
    return null;
  };

  return {
    names,
    licences,
    roles,
    club,
    setNom: (i: number, v: string) => setNames((l) => remplacer(l, i, v)),
    setLicence: (i: number, v: string) => setLicences((l) => remplacer(l, i, v)),
    setRole: (i: number, v: RolePetanque | '') => setRoles((l) => remplacer(l, i, v)),
    setClub,
    enregistrer,
  };
}

/**
 * Fiche équipe ouverte depuis le graphique (manuel §3.D.1.C : « en faisant un
 * clic droit sur le n° d'équipe dans le graphique, vous allez sur la fiche de
 * l'équipe »). On y lit la composition, le club, les licences et où en est
 * l'équipe ; on y corrige les joueurs, et on la met dans la liste spécifique.
 *
 * Sans elle, remplacer un joueur en plein concours obligeait à quitter le
 * graphique pour l'onglet Inscriptions, et à y retrouver l'équipe.
 */
export function FicheEquipeModal({
  concours,
  team,
  poules,
  matches,
  onClose,
}: {
  concours: Concours;
  team: Team;
  poules: Poule[];
  matches: Match[];
  onClose: () => void;
}) {
  const { nbPlayers, avecRoles, rolesProposes } = parametresSaisie(concours);
  const saisie = useSaisieEquipe(team, nbPlayers);
  const [erreur, setErreur] = useState<string | null>(null);
  const clubs = libelleClubs(team.players, team.club);
  const parcours = parcoursEquipe(team, poules, matches);

  const valider = async (): Promise<void> => {
    const refus = await saisie.enregistrer();
    if (refus) setErreur(refus);
    else onClose();
  };

  return (
    <Modal title={`Fiche de l'équipe n°${team.number}`} onClose={onClose}>
      <form
        className="fiche-equipe"
        onSubmit={(e) => {
          e.preventDefault();
          void valider();
        }}
      >
        <p className="fiche-equipe-resume">
          {clubs && <span>{clubs}</span>}
          <span className="tag">
            {parcours.concours ? `Concours ${parcours.concours} — ` : ''}
            {parcours.libelle}
          </span>
          {team.forfait && <span className="tag tag-danger">Forfait</span>}
        </p>

        {Array.from({ length: nbPlayers }, (_, i) => (
          <fieldset key={i} className="fiche-equipe-joueur">
            <legend>Joueur {i + 1}</legend>
            <div className="form-row">
              <label>
                Nom
                <input value={saisie.names[i] ?? ''} onChange={(e) => saisie.setNom(i, e.target.value)} />
              </label>
              <label>
                N° licence
                <input
                  value={saisie.licences[i] ?? ''}
                  onChange={(e) => saisie.setLicence(i, e.target.value)}
                />
              </label>
            </div>
            {avecRoles && (
              <label>
                Rôle
                <select
                  value={saisie.roles[i] ?? ''}
                  onChange={(e) => saisie.setRole(i, e.target.value as RolePetanque | '')}
                >
                  <option value="">Rôle indifférent</option>
                  {rolesProposes.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
        ))}

        <label>
          Club
          <input value={saisie.club} onChange={(e) => saisie.setClub(e.target.value)} />
        </label>

        {/* Case du manuel : « Rajouter à la Liste Spécifique ». Elle s'écrit
            tout de suite, comme la case de l'onglet Inscriptions : ce n'est pas
            une modification de la composition. */}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={team.retenue ?? false}
            onChange={(e) => void updateTeam({ ...team, retenue: e.target.checked || undefined })}
          />
          Rajouter à la liste spécifique
        </label>

        {erreur && <p className="form-error">{erreur}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Enregistrer
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </div>
      </form>
    </Modal>
  );
}
