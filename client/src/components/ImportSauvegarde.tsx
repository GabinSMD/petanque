import { Download, GitMerge, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  lireSauvegarde,
  resumeSauvegarde,
  type FusionResultats,
  type RaisonEcart,
  type ResultatPartie,
  type Sauvegarde,
} from '@shared';
import { concoursExiste, fusionnerSauvegarde, importSauvegarde } from '../db/actions';
import { Modal } from './Modal';

/**
 * Réimport d'une sauvegarde de concours (manuel §3.F.2).
 *
 * Rien n'est écrit avant que l'organisateur ait vu ce que contient le fichier
 * et choisi quoi en faire : importer à côté, fusionner les résultats, ou
 * restaurer par-dessus. La restauration détruit l'état actuel, elle n'est donc
 * jamais le choix par défaut et demande une confirmation explicite.
 *
 * La fusion est l'« Importation Manuelle » du multiposte (§3.D.1.B.6.2) : les
 * scores saisis sur un autre appareil, sans réseau, arrivent par fichier dans
 * ce concours-ci.
 */
export function ImportSauvegarde() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [sauvegarde, setSauvegarde] = useState<Sauvegarde | null>(null);
  const [existeDeja, setExisteDeja] = useState(false);
  // Fusionner d'office quand le concours existe : c'est le cas courant (les
  // scores d'un autre appareil) et le seul qui n'écrase ni ne duplique rien.
  const [choix, setChoix] = useState<ChoixImport>('fusionner');
  const [bilan, setBilan] = useState<FusionResultats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reinitialiser = (): void => {
    setSauvegarde(null);
    setExisteDeja(false);
    setChoix('fusionner');
    setBilan(null);
    if (input.current) input.current.value = '';
  };

  const lire = async (fichier: File): Promise<void> => {
    setErreur(null);
    const lecture = lireSauvegarde(await fichier.text());
    if (!lecture.ok) {
      setErreur(lecture.erreur);
      if (input.current) input.current.value = '';
      return;
    }
    // L'existence se lit avant d'ouvrir la modale : ouverte d'abord, elle
    // poserait le focus sur une version sans les choix, puis changerait.
    const existe = await concoursExiste(lecture.sauvegarde.concours.id);
    setExisteDeja(existe);
    setSauvegarde(lecture.sauvegarde);
  };

  const importer = async (mode: 'nouveau' | 'remplacer'): Promise<void> => {
    if (!sauvegarde) return;
    setBusy(true);
    try {
      const id = await importSauvegarde(sauvegarde, mode);
      reinitialiser();
      navigate(`/concours/${id}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Import impossible.');
    } finally {
      setBusy(false);
    }
  };

  const fusionner = async (): Promise<void> => {
    if (!sauvegarde) return;
    setBusy(true);
    try {
      setBilan(await fusionnerSauvegarde(sauvegarde));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Fusion impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <label className="btn btn-ghost btn-sm import-sauvegarde">
        <Download className="ic" aria-hidden /> Importer une sauvegarde
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void lire(f);
          }}
        />
      </label>
      {erreur && <p className="scan-alerte import-erreur"><TriangleAlert className="ic" aria-hidden /> {erreur}</p>}

      {sauvegarde && bilan && (
        <Modal title="Résultats fusionnés" onClose={reinitialiser}>
          <BilanFusion sauvegarde={sauvegarde} bilan={bilan} />
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={reinitialiser}>
              Fermer
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const id = sauvegarde.concours.id;
                reinitialiser();
                navigate(`/concours/${id}`);
              }}
            >
              Ouvrir le concours
            </button>
          </div>
        </Modal>
      )}

      {sauvegarde && !bilan && (
        <Modal title="Importer une sauvegarde" onClose={reinitialiser}>
          <div className="import-modal">
            <p className="import-resume">{resumeSauvegarde(sauvegarde)}</p>

            {existeDeja ? (
              <fieldset className="import-options">
                <legend>
                  Ce concours est <strong>déjà présent sur cet appareil</strong>. Que faire du
                  fichier ?
                </legend>
                {CHOIX_IMPORT.map((c) => (
                  <label key={c.valeur} className="import-option">
                    <input
                      type="radio"
                      name="choix-import"
                      value={c.valeur}
                      checked={choix === c.valeur}
                      onChange={() => setChoix(c.valeur)}
                    />
                    <span>
                      <strong>{c.titre}</strong>
                      <small>{c.detail}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p>Ce concours n'existe pas encore sur cet appareil : il sera ajouté tel quel.</p>
            )}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={reinitialiser} disabled={busy}>
                Annuler
              </button>
              <button
                className={existeDeja && choix === 'remplacer' ? 'btn btn-danger' : 'btn btn-primary'}
                disabled={busy}
                onClick={() => {
                  if (!existeDeja || choix === 'copie') {
                    void importer('nouveau');
                  } else if (choix === 'fusionner') {
                    void fusionner();
                  } else if (
                    window.confirm(
                      `Restaurer « ${sauvegarde.concours.name} » par-dessus la version actuelle ?\n\n` +
                        'Tout ce qui a été saisi depuis cette sauvegarde sera perdu.',
                    )
                  ) {
                    void importer('remplacer');
                  }
                }}
              >
                {!existeDeja ? (
                  'Importer'
                ) : choix === 'fusionner' ? (
                  <>
                    <GitMerge className="ic" aria-hidden /> Fusionner
                  </>
                ) : choix === 'copie' ? (
                  'Importer une copie'
                ) : (
                  'Restaurer par-dessus'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

type ChoixImport = 'fusionner' | 'copie' | 'remplacer';

/**
 * Les trois issues, de la plus sûre à la plus lourde. Des boutons radio et un
 * seul bouton de validation : quatre boutons côte à côte mettaient la
 * restauration, en rouge plein, plus en vue que la fusion.
 */
const CHOIX_IMPORT: { valeur: ChoixImport; titre: string; detail: string }[] = [
  {
    valeur: 'fusionner',
    titre: 'Fusionner les résultats',
    detail:
      "Les scores saisis sur l'autre appareil rejoignent ce concours. Deux scores différents pour une partie : le plus récent l'emporte.",
  },
  {
    valeur: 'copie',
    titre: 'Importer une copie',
    detail: 'Le fichier arrive à côté, comme un second concours. Rien n\'est écrasé.',
  },
  {
    valeur: 'remplacer',
    titre: 'Restaurer par-dessus',
    detail: 'Le concours actuel est remplacé par le fichier : ce qui a été saisi depuis est perdu.',
  },
];

const RAISONS: Record<RaisonEcart, string> = {
  absente: "partie absente de ce concours (tirage fait sur l'autre appareil)",
  equipes: 'les équipes ne sont pas les mêmes ici',
  illisible: 'résultat illisible dans le fichier',
};

/** Ce que la fusion a fait, partie par partie, pour que l'organisateur vérifie. */
function BilanFusion({ sauvegarde, bilan }: { sauvegarde: Sauvegarde; bilan: FusionResultats }) {
  const parties = new Map(sauvegarde.matches.map((m) => [m.id, m]));
  const equipes = new Map(sauvegarde.teams.map((t) => [t.id, t]));
  const poules = new Map(sauvegarde.poules.map((p) => [p.id, p]));

  const libelle = (id: string): string => {
    const m = parties.get(id);
    if (!m) return 'Partie';
    const lieu =
      m.stage === 'poule'
        ? `Poule ${poules.get(m.pouleId ?? '')?.index ?? '?'}`
        : m.stage === 'ronde'
          ? `Partie ${m.round + 1}`
          : `${m.stage === 'principal' ? 'Tableau' : m.stage === 'consolante' ? 'Consolante' : 'Complémentaire'}, tour ${m.round + 1}`;
    const n = (tid: string | null): string => {
      const t = tid ? equipes.get(tid) : undefined;
      return t ? `n°${t.number}` : '?';
    };
    return m.teamAId || m.teamBId ? `${lieu} : ${n(m.teamAId)} contre ${n(m.teamBId)}` : lieu;
  };

  const score = (r: ResultatPartie): string => {
    if (r.scoreA !== null && r.scoreB !== null) return `${r.scoreA} – ${r.scoreB}`;
    if (r.scoreA !== null) return String(r.scoreA);
    return r.vainqueur ? `vainqueur ${r.vainqueur}` : '—';
  };

  const rien = bilan.reprises.length === 0 && bilan.conflits.length === 0;

  return (
    <div className="import-modal">
      <p className="import-resume">
        {bilan.reprises.length} partie{bilan.reprises.length > 1 ? 's' : ''} reprise
        {bilan.reprises.length > 1 ? 's' : ''} · {bilan.conflits.length} conflit
        {bilan.conflits.length > 1 ? 's' : ''}
      </p>
      {rien && <p>Aucun résultat nouveau : ce concours contenait déjà tout ce que porte le fichier.</p>}

      {bilan.conflits.length > 0 && (
        <>
          <p>
            Ces parties avaient un score différent sur chaque appareil. Le plus récent a été
            retenu ; corrigez à la main s'il le faut.
          </p>
          <ul className="import-choix fusion-conflits">
            {bilan.conflits.map((c) => (
              <li key={c.matchId}>
                <strong>{libelle(c.matchId)}</strong>
                <br />
                Gardé :{' '}
                {c.retenu === 'local'
                  ? `le score de cet appareil (${score(c.local)})`
                  : `le score du fichier (${score(c.distant)})`}
                <span className="hint">
                  {' '}
                  · l'autre était {score(c.retenu === 'local' ? c.distant : c.local)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {bilan.ecartes.length > 0 && (
        <details>
          <summary>
            {bilan.ecartes.length} résultat{bilan.ecartes.length > 1 ? 's' : ''} non repris
          </summary>
          <ul className="import-choix">
            {bilan.ecartes.map((e) => (
              <li key={e.matchId}>
                {libelle(e.matchId)} — {RAISONS[e.raison]}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
