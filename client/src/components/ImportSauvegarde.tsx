import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lireSauvegarde, resumeSauvegarde, type Sauvegarde } from '@shared';
import { concoursExiste, importSauvegarde } from '../db/actions';
import { Modal } from './Modal';

/**
 * Réimport d'une sauvegarde de concours (manuel §3.F.2).
 *
 * Rien n'est écrit avant que l'organisateur ait vu ce que contient le fichier
 * et choisi quoi en faire : importer à côté, ou restaurer par-dessus. La
 * restauration détruit l'état actuel, elle n'est donc jamais le choix par
 * défaut et demande une confirmation explicite.
 */
export function ImportSauvegarde() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [sauvegarde, setSauvegarde] = useState<Sauvegarde | null>(null);
  const [existeDeja, setExisteDeja] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reinitialiser = (): void => {
    setSauvegarde(null);
    setExisteDeja(false);
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
    setSauvegarde(lecture.sauvegarde);
    setExisteDeja(await concoursExiste(lecture.sauvegarde.concours.id));
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

  return (
    <>
      <label className="btn btn-ghost btn-sm import-sauvegarde">
        📥 Importer une sauvegarde
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
      {erreur && <p className="scan-alerte import-erreur">⚠ {erreur}</p>}

      {sauvegarde && (
        <Modal title="📥 Importer une sauvegarde" onClose={reinitialiser}>
          <div className="import-modal">
            <p className="import-resume">{resumeSauvegarde(sauvegarde)}</p>

            {existeDeja ? (
              <>
                <p>
                  Ce concours est <strong>déjà présent sur cet appareil</strong>. Deux façons de
                  procéder :
                </p>
                <ul className="import-choix">
                  <li>
                    <strong>Importer une copie</strong> — la sauvegarde arrive à côté, sous de
                    nouveaux identifiants. Rien n'est écrasé.
                  </li>
                  <li>
                    <strong>Restaurer par-dessus</strong> — l'état actuel du concours est{' '}
                    <strong>remplacé</strong> par celui du fichier. Les équipes et parties
                    enregistrées depuis cette sauvegarde seront perdues.
                  </li>
                </ul>
              </>
            ) : (
              <p>Ce concours n'existe pas encore sur cet appareil : il sera ajouté tel quel.</p>
            )}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={reinitialiser} disabled={busy}>
                Annuler
              </button>
              {existeDeja && (
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Restaurer « ${sauvegarde.concours.name} » par-dessus la version actuelle ?\n\n` +
                          'Tout ce qui a été saisi depuis cette sauvegarde sera perdu.',
                      )
                    ) {
                      void importer('remplacer');
                    }
                  }}
                >
                  Restaurer par-dessus
                </button>
              )}
              <button className="btn btn-primary" disabled={busy} onClick={() => void importer('nouveau')}>
                {existeDeja ? 'Importer une copie' : 'Importer'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
