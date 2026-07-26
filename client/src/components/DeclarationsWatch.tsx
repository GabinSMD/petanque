import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Concours, Match, Poule, Team } from '@shared';
import { setScore } from '../db/actions';
import { api } from '../lib/api';
import { matchLabel, sideName } from '../lib/matchLabel';
import { getSession } from '../lib/session';
import { Modal } from './Modal';

export interface Declaration {
  id: string;
  concoursId: string;
  matchId: string;
  side: 'A' | 'B';
  scoreA: number;
  scoreB: number;
  createdAt: string;
}

/**
 * Table de marque : surveille les scores déclarés par les équipes depuis
 * le lien public (auto-arbitrage) et permet de les appliquer en un clic.
 * La table de marque reste seule décisionnaire.
 */
export function DeclarationsWatch({
  concours,
  teams,
  poules,
  matches,
}: {
  concours: Concours;
  teams: Team[];
  poules: Poule[];
  matches: Match[];
}) {
  const guest = getSession()?.guest === true;
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const refresh = useCallback(async () => {
    if (guest || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    try {
      const res = await api<{ declarations: Declaration[] }>(
        `/api/declarations?concoursId=${concours.id}`,
      );
      setDeclarations(res.declarations);
    } catch {
      // hors ligne ou serveur injoignable : on réessaiera au prochain tick
    }
  }, [concours.id, guest]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    window.addEventListener('online', () => void refresh());
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (guest || declarations.length === 0) return null;

  const byMatch = new Map<string, Declaration[]>();
  for (const d of declarations) {
    byMatch.set(d.matchId, [...(byMatch.get(d.matchId) ?? []), d]);
  }

  const resolve = async (matchId: string, apply?: { a: number; b: number }) => {
    setBusy(true);
    try {
      if (apply) {
        const match = matches.find((m) => m.id === matchId);
        if (match && !match.done) {
          await setScore(concours, match, apply.a, apply.b);
        }
      }
      await api(`/api/declarations/match/${matchId}`, { method: 'DELETE' });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="declarations-banner no-print" onClick={() => setOpen(true)}>
        📣 {byMatch.size} score{byMatch.size > 1 ? 's' : ''} déclaré
        {byMatch.size > 1 ? 's' : ''} par les équipes — à valider
      </button>

      {open && (
        <Modal title="📣 Scores déclarés par les équipes" onClose={() => setOpen(false)}>
          <p className="hint">
            Les équipes déclarent depuis le lien public ; quand les deux camps annoncent
            le même score, la déclaration est <strong>concordante</strong>. Vous restez
            seul juge : appliquer ou ignorer.
          </p>
          <div className="declarations-list">
            {[...byMatch.entries()].map(([matchId, decls]) => {
              const match = matches.find((m) => m.id === matchId);
              const a = decls.find((d) => d.side === 'A');
              const b = decls.find((d) => d.side === 'B');
              const agreement = a && b && a.scoreA === b.scoreA && a.scoreB === b.scoreB;
              if (!match) return null;
              return (
                <div key={matchId} className="declaration-item">
                  <p className="declaration-match">
                    <strong>{matchLabel(match, poules, matches)}</strong>
                    <br />
                    {sideName(match, 'A', teamsById)} <em>contre</em>{' '}
                    {sideName(match, 'B', teamsById)}
                  </p>
                  <p className="declaration-sides">
                    {a ? (
                      <span className="tag">
                        Camp A : {a.scoreA}–{a.scoreB}
                      </span>
                    ) : (
                      <span className="tag">Camp A : en attente</span>
                    )}
                    {b ? (
                      <span className="tag">
                        Camp B : {b.scoreA}–{b.scoreB}
                      </span>
                    ) : (
                      <span className="tag">Camp B : en attente</span>
                    )}
                    {agreement ? (
                      <span className="tag tag-ok">✓ Concordant</span>
                    ) : a && b ? (
                      <span className="tag tag-danger">⚠ Divergent</span>
                    ) : (
                      <span className="tag tag-info">⏳ Un seul camp</span>
                    )}
                  </p>
                  <p className="declaration-actions">
                    {agreement && a && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy || match.done}
                        onClick={() => void resolve(matchId, { a: a.scoreA, b: a.scoreB })}
                      >
                        Appliquer {a.scoreA}–{a.scoreB}
                      </button>
                    )}
                    {!agreement &&
                      [a, b].filter(Boolean).map((d) => (
                        <button
                          key={d!.id}
                          className="btn btn-sm"
                          disabled={busy || match.done}
                          onClick={() =>
                            void resolve(matchId, { a: d!.scoreA, b: d!.scoreB })
                          }
                        >
                          Appliquer {d!.scoreA}–{d!.scoreB} (camp {d!.side})
                        </button>
                      ))}
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => void resolve(matchId)}
                    >
                      Ignorer
                    </button>
                    {match.done && <span className="hint">Score déjà saisi à la table.</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}
