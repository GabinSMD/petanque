import { useEffect, useState } from 'react';
import { api, postJson } from '../lib/api';
import { useSession } from '../db/hooks';
import { Modal } from './Modal';

interface Member {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

/**
 * Équipe du club : liste des membres du compte et génération de codes
 * d'invitation (valables 7 jours) pour ajouter des co-organisateurs.
 */
export function ClubModal({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ members: Member[] }>('/api/org/members')
      .then((res) => setMembers(res.members))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Serveur injoignable (hors ligne ?)'),
      );
  }, []);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setInvite(await postJson<{ code: string; expiresAt: string }>('/api/org/invites', {}));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Génération impossible');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title={`👥 ${session?.org.name ?? 'Mon club'}`} onClose={onClose}>
      <p className="hint">
        Plusieurs organisateurs peuvent travailler sur les mêmes concours : chacun son
        compte, les données se synchronisent entre les appareils du club.
      </p>
      {error && <p className="form-error">{error}</p>}

      <h3>Membres</h3>
      <ul className="club-members">
        {(members ?? []).map((m) => (
          <li key={m.id}>
            <strong>{m.name}</strong> <span className="hint">{m.email}</span>
          </li>
        ))}
        {members === null && !error && <li className="hint">Chargement…</li>}
      </ul>

      <h3>Inviter un co-organisateur</h3>
      {invite ? (
        <div className="invite-code-box">
          <code className="invite-code">{invite.code}</code>
          <button className="btn btn-primary btn-sm" onClick={() => void copy()}>
            {copied ? '✓ Copié' : 'Copier'}
          </button>
          <p className="hint">
            Transmettez ce code : sur l'écran « Créer un compte club », il suffit de le
            saisir dans « Code d'invitation » pour rejoindre {session?.org.name}. Valable
            7 jours.
          </p>
        </div>
      ) : (
        <button className="btn btn-primary" disabled={busy} onClick={() => void generate()}>
          Générer un code d'invitation
        </button>
      )}
    </Modal>
  );
}
