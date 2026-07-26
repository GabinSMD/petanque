import { useCallback, useEffect, useState } from 'react';
import type { Concours, Player } from '@shared';
import { addTeam } from '../db/actions';
import { api } from '../lib/api';
import { getSession } from '../lib/session';

interface Registration {
  id: string;
  players: Player[];
  club?: string;
  createdAt: string;
}

/**
 * Pré-inscriptions en ligne (table de marque) : liste les demandes reçues
 * depuis le lien public et permet de les valider (création de l'équipe) ou
 * de les refuser. Nécessite un compte et du réseau.
 */
export function RegistrationsPanel({ concours }: { concours: Concours }) {
  const guest = getSession()?.guest === true;
  const [regs, setRegs] = useState<Registration[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (guest || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    try {
      const res = await api<{ registrations: Registration[] }>(
        `/api/registrations?concoursId=${concours.id}`,
      );
      setRegs(res.registrations);
    } catch {
      // hors ligne : on réessaiera
    }
  }, [concours.id, guest]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    window.addEventListener('online', () => void refresh());
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (guest || regs.length === 0) return null;

  const accept = async (r: Registration) => {
    setBusy(r.id);
    try {
      await addTeam(concours.id, r.players, r.club);
      await api(`/api/registrations/${r.id}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const reject = async (r: Registration) => {
    if (!window.confirm('Refuser cette pré-inscription ?')) return;
    setBusy(r.id);
    try {
      await api(`/api/registrations/${r.id}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="registrations-panel no-print">
      <h3>
        ✍️ Pré-inscriptions en ligne <span className="tag tag-info">{regs.length} en attente</span>
      </h3>
      <ul>
        {regs.map((r) => (
          <li key={r.id}>
            <span className="reg-players">
              {r.players.map((p, i) => (
                <span key={i} className="player-chip">
                  {p.name}
                  {p.licence && <em className="licence"> {p.licence}</em>}
                </span>
              ))}
              {r.club && <span className="team-club"> {r.club}</span>}
            </span>
            <span className="reg-actions">
              <button
                className="btn btn-primary btn-sm"
                disabled={busy === r.id}
                onClick={() => void accept(r)}
              >
                ✓ Valider
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy === r.id}
                onClick={() => void reject(r)}
              >
                Refuser
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
