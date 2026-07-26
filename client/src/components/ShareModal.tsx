import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { Concours } from '@shared';
import { api, postJson } from '../lib/api';
import { getSession } from '../lib/session';
import { Modal } from './Modal';

interface Props {
  concours: Concours;
  onClose: () => void;
}

/**
 * Lien public du concours : création/révocation, copie et QR code à
 * afficher au boulodrome. Nécessite un compte et du réseau (les
 * spectateurs consultent depuis leurs téléphones).
 */
export function ShareModal({ concours, onClose }: Props) {
  const guest = getSession()?.guest === true;
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (guest) return;
    api<{ token: string | null }>(`/api/share/${concours.id}`)
      // Ne pas écraser un jeton créé entre-temps (course GET/POST).
      .then((res) => setToken((prev) => prev ?? res.token))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Serveur injoignable (hors ligne ?)'),
      );
  }, [concours.id, guest]);

  const url = token ? `${window.location.origin}/p/${token}` : null;

  const qrSvg = useMemo(() => {
    if (!url) return null;
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }, [url]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ token: string }>('/api/share', {
        concoursId: concours.id,
      });
      setToken(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible (hors ligne ?)');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!window.confirm('Révoquer le lien ? Il cessera immédiatement de fonctionner.')) return;
    setBusy(true);
    try {
      await api(`/api/share/${concours.id}`, { method: 'DELETE' });
      setToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Révocation impossible');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copie impossible — sélectionnez le lien manuellement');
    }
  };

  return (
    <Modal title="🔗 Partager les résultats" onClose={onClose}>
      {guest ? (
        <p className="hint">
          Le lien public nécessite un compte (les résultats sont servis par le serveur).
          Créez un compte pour partager ce concours.
        </p>
      ) : (
        <>
          <p>
            Un lien <strong>public en lecture seule</strong> : poules, tableaux et
            classements se mettent à jour en direct sur les téléphones des joueurs —
            sans compte.
          </p>
          {error && <p className="form-error">{error}</p>}
          {!url ? (
            <button className="btn btn-primary" disabled={busy} onClick={() => void create()}>
              Créer le lien public
            </button>
          ) : (
            <>
              <div className="share-url">
                <input readOnly value={url} onFocus={(e) => e.target.select()} />
                <button className="btn btn-primary btn-sm" onClick={() => void copy()}>
                  {copied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
              {qrSvg && (
                <div className="share-qr">
                  <div
                    className="share-qr-svg"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <p className="hint">
                    Affichez ou imprimez ce QR code au boulodrome : les joueurs le
                    scannent pour suivre les résultats.
                  </p>
                </div>
              )}
              <div className="form-actions">
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void revoke()}>
                  Révoquer le lien
                </button>
                <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">
                  Ouvrir ↗
                </a>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
