import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Concours, Site, Team } from '@shared';
import { effectifsParSite } from '@shared';
import { fractionnerMultisite } from '../db/actions';
import { Modal } from './Modal';

interface Props {
  concours: Concours;
  teams: Team[];
  onClose: () => void;
}

/** Un site en cours de saisie : les terrains restent modifiables librement. */
interface SaisieSite {
  nom: string;
  nbTerrains: number | '';
}

/**
 * Fractionnement multisite (manuel §3.B.10.D).
 *
 * « Utilisé en général pour des qualificatifs de championnat car nombre de
 * terrains insuffisant pour organiser le concours sur un seul site. » On
 * déclare les sites et leurs terrains, et le concours est coupé en autant de
 * concours autonomes.
 *
 * Les effectifs suivent les terrains : on les montre avant de fractionner,
 * parce que c'est là que l'organisateur voit si son partage tient debout.
 */
export function MultisiteModal({ concours, teams, onClose }: Props) {
  const navigate = useNavigate();
  const engagees = teams.filter((t) => !t.forfait);
  const [sites, setSites] = useState<SaisieSite[]>(() => {
    const moitie = Math.max(1, Math.floor(concours.nbTerrains / 2));
    return [
      { nom: concours.lieu?.trim() || 'Site 1', nbTerrains: moitie },
      { nom: 'Site 2', nbTerrains: Math.max(1, concours.nbTerrains - moitie) },
    ];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maj = (i: number, patch: Partial<SaisieSite>): void =>
    setSites(sites.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const prets: Site[] = sites.map((s, i) => ({
    nom: s.nom.trim() || `Site ${i + 1}`,
    nbTerrains: s.nbTerrains === '' ? 0 : s.nbTerrains,
  }));

  /** Effectifs annoncés, ou la raison pour laquelle le partage est impossible. */
  let effectifs: number[] | null = null;
  let empeche: string | null = null;
  try {
    effectifs = effectifsParSite(engagees.length, prets);
  } catch (err) {
    empeche = err instanceof Error ? err.message : String(err);
  }

  const fractionner = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const crees = await fractionnerMultisite(concours, prets);
      onClose();
      // Les concours filles sont dans la liste courante ; l'origine est rangée.
      navigate(crees.length > 0 ? '/' : `/concours/${concours.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="🏟 Fractionner en plusieurs sites" onClose={onClose}>
      <div className="multisite-modal">
        <p className="hint">
          Pour un concours qu'un seul boulodrome ne peut pas accueillir — un qualificatif de
          championnat, typiquement. Chaque site devient un concours autonome, avec son lieu et ses
          terrains. Les <strong>{engagees.length} équipes engagées</strong> sont réparties
          proportionnellement aux terrains, et les équipes d'un même club restent ensemble.
        </p>

        <table className="multisite-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Terrains</th>
              <th>Équipes</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={s.nom}
                    onChange={(e) => maj(i, { nom: e.target.value })}
                    placeholder={`Site ${i + 1}`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    value={s.nbTerrains}
                    onChange={(e) =>
                      maj(i, { nbTerrains: e.target.value === '' ? '' : Number(e.target.value) })
                    }
                  />
                </td>
                <td className="multisite-effectif">{effectifs ? effectifs[i] : '—'}</td>
                <td className="no-print">
                  {sites.length > 2 && (
                    <button
                      className="btn-icon btn-icon-danger"
                      title="Retirer ce site"
                      onClick={() => setSites(sites.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setSites([...sites, { nom: `Site ${sites.length + 1}`, nbTerrains: 1 }])
          }
        >
          + Ajouter un site
        </button>

        {empeche && <p className="form-error">{empeche}</p>}
        {error && <p className="form-error">{error}</p>}

        <p className="hint">
          Les dossards sont conservés : les listes d'inscrits déjà imprimées restent valables, quitte
          à ce qu'un site ait des numéros non contigus. Le concours d'origine est archivé — il garde
          la trace du fractionnement.
          {teams.length !== engagees.length && (
            <>
              {' '}
              Les {teams.length - engagees.length} équipes déclarées forfait restent dans le concours
              d'origine.
            </>
          )}
        </p>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || Boolean(empeche)}
            onClick={() => void fractionner()}
          >
            Fractionner en {sites.length} concours
          </button>
        </div>
      </div>
    </Modal>
  );
}
