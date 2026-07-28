import { useState } from 'react';
import type { Team } from '@shared';
import { teamDisplayName } from './TeamLabel';

/**
 * Sélection des têtes de série : on active l'option puis on désigne des
 * équipes dans l'ordre (1 = meilleure). Elles seront réparties dans des
 * poules / moitiés de tableau différentes au tirage.
 */
export function SeedPicker({
  teams,
  seeds,
  onChange,
}: {
  teams: Team[];
  seeds: string[];
  onChange: (seeds: string[]) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [search, setSearch] = useState('');

  const active = teams.filter((t) => !t.forfait);
  const rank = (id: string) => seeds.indexOf(id);

  const toggle = (id: string) => {
    onChange(seeds.includes(id) ? seeds.filter((s) => s !== id) : [...seeds, id]);
  };

  const q = search.trim().toLowerCase();
  const shown = q
    ? active.filter(
        (t) =>
          String(t.number).includes(q) ||
          teamDisplayName(t).toLowerCase().includes(q) ||
          t.club?.toLowerCase().includes(q) ||
          t.players.some((p) => p.club?.toLowerCase().includes(q)),
      )
    : active;

  return (
    <div className="seed-picker">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (!e.target.checked) onChange([]);
          }}
        />
        Têtes de série (réparties dans des poules / moitiés différentes)
      </label>

      {enabled && (
        <div className="seed-picker-body">
          {seeds.length > 0 && (
            <ol className="seed-list">
              {seeds.map((id) => {
                const t = teams.find((x) => x.id === id);
                return (
                  <li key={id}>
                    <span className="seed-rank">{rank(id) + 1}</span>
                    {t ? `n°${t.number} ${teamDisplayName(t)}` : '?'}
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => toggle(id)}
                      title="Retirer"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <input
            className="seed-search"
            placeholder="Ajouter une tête de série (n° ou nom)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="seed-choices">
            {shown.slice(0, 40).map((t) => (
              <button
                type="button"
                key={t.id}
                className={`seed-chip${seeds.includes(t.id) ? ' selected' : ''}`}
                onClick={() => toggle(t.id)}
              >
                {seeds.includes(t.id) && <span className="seed-rank">{rank(t.id) + 1}</span>}
                n°{t.number} {teamDisplayName(t)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
