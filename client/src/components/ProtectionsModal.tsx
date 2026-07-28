import { useMemo, useState } from 'react';
import type { Concours, Team } from '@shared';
import { updateConcours } from '../db/actions';
import { Modal } from './Modal';

interface Props {
  concours: Concours;
  teams: Team[];
  onClose: () => void;
}

/**
 * Groupes de protection (manuel §3.B.5, niveau 2).
 *
 * La protection club est appliquée d'office. Ici on déclare les clubs qui
 * doivent être traités **comme un seul** au tirage : deux clubs d'un même
 * village, une entente, deux sociétés qui partagent un boulodrome. La fenêtre
 * reprend celle du logiciel fédéral — les clubs non groupés d'un côté, les
 * groupes de l'autre.
 *
 * Les groupes ne valent que pour ce concours.
 */
export function ProtectionsModal({ concours, teams, onClose }: Props) {
  const [groupes, setGroupes] = useState<string[][]>(
    (concours.protections ?? []).map((g) => [...g]),
  );
  const [selection, setSelection] = useState<string[]>([]);

  /** Tous les clubs engagés, joueur par joueur (équipes non homogènes comprises). */
  const clubs = useMemo(() => {
    const vus = new Map<string, string>();
    for (const t of teams) {
      for (const club of [...t.players.map((p) => p.club), t.club]) {
        const c = club?.trim();
        if (c) vus.set(c.toLowerCase(), c);
      }
    }
    return [...vus.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [teams]);

  const groupeDe = (club: string): number =>
    groupes.findIndex((g) => g.some((c) => c.toLowerCase() === club.toLowerCase()));
  const nonGroupes = clubs.filter((c) => groupeDe(c) < 0);

  const basculer = (club: string): void =>
    setSelection((prev) =>
      prev.includes(club) ? prev.filter((c) => c !== club) : [...prev, club],
    );

  const nouveauGroupe = (): void => {
    if (selection.length === 0) return;
    setGroupes([...groupes, selection]);
    setSelection([]);
  };

  const ajouterAu = (i: number): void => {
    if (selection.length === 0) return;
    setGroupes(groupes.map((g, j) => (j === i ? [...g, ...selection] : g)));
    setSelection([]);
  };

  const retirer = (i: number, club: string): void =>
    setGroupes(
      groupes
        .map((g, j) => (j === i ? g.filter((c) => c !== club) : g))
        .filter((g) => g.length > 0),
    );

  const enregistrer = async (): Promise<void> => {
    // Un groupe d'un seul club ne protège rien de plus que la protection club.
    const utiles = groupes.filter((g) => g.length >= 2);
    await updateConcours({
      ...concours,
      protections: utiles.length > 0 ? utiles : undefined,
    });
    onClose();
  };

  return (
    <Modal title="🛡 Groupes de protection" onClose={onClose}>
      <div className="protections-modal">
        <p className="hint">
          Deux équipes d'un <strong>même club</strong> sont déjà séparées au tirage. Ajoutez ici les
          clubs à traiter comme un seul — un même village, une entente — pour qu'ils ne se
          rencontrent pas non plus dès le début. Valable pour ce concours seulement.
        </p>

        {clubs.length === 0 ? (
          <p>Aucun club renseigné sur les équipes inscrites.</p>
        ) : (
          <div className="protections-colonnes">
            <section>
              <h3>Clubs non groupés ({nonGroupes.length})</h3>
              <ul className="protections-liste">
                {nonGroupes.map((club) => (
                  <li key={club}>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selection.includes(club)}
                        onChange={() => basculer(club)}
                      />
                      {club}
                    </label>
                  </li>
                ))}
                {nonGroupes.length === 0 && <li className="hint">Tous les clubs sont groupés.</li>}
              </ul>
              <div className="protections-actions">
                <button
                  className="btn btn-sm btn-primary"
                  disabled={selection.length < 2 && groupes.length === 0}
                  onClick={nouveauGroupe}
                  title="Créer un groupe avec les clubs cochés"
                >
                  + Nouveau groupe
                </button>
                {groupes.map((_, i) => (
                  <button
                    key={i}
                    className="btn btn-sm"
                    disabled={selection.length === 0}
                    onClick={() => ajouterAu(i)}
                  >
                    → Groupe {i + 1}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3>Groupes protégés ({groupes.length})</h3>
              {groupes.length === 0 && (
                <p className="hint">
                  Aucun groupe. Seule la protection club s'applique, ce qui suffit à la plupart des
                  concours.
                </p>
              )}
              <ul className="protections-liste">
                {groupes.map((g, i) => (
                  <li key={i} className="protections-groupe">
                    <strong>Groupe {i + 1}</strong>
                    <ul>
                      {g.map((club) => (
                        <li key={club}>
                          {club}
                          <button
                            className="btn-icon btn-icon-danger"
                            title="Retirer du groupe"
                            onClick={() => retirer(i, club)}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void enregistrer()}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
}
