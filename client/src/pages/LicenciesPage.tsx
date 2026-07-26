import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteAllLicencies, deleteLicencie, importLicencies } from '../db/actions';
import { useLicencies } from '../db/hooks';
import { parseLicenciesCsv } from '../lib/csv';

const TEMPLATE =
  'data:text/csv;charset=utf-8,' +
  encodeURIComponent('Nom;Prénom;Licence;Club\nDupont;Marie;012345678;La Boule Joyeuse\n');

/**
 * Fichier des licenciés de l'organisation : import CSV, recherche,
 * purge. Alimente l'autocomplétion des inscriptions.
 */
export function LicenciesPage() {
  const licencies = useLicencies() ?? [];
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const { rows, skipped } = parseLicenciesCsv(text);
      if (rows.length === 0) {
        setMessage('Aucune ligne exploitable dans ce fichier.');
        return;
      }
      const { added, updated } = await importLicencies(rows);
      setMessage(
        `Import terminé : ${added} ajouté${added > 1 ? 's' : ''}, ${updated} mis à jour` +
          (skipped > 0 ? `, ${skipped} ligne${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''}.` : '.'),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import impossible');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? licencies.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.licence?.toLowerCase().includes(q) ||
          l.club?.toLowerCase().includes(q),
      )
    : licencies;
  const shown = filtered.slice(0, 200);

  return (
    <div className="page">
      <div className="page-head">
        <h1>
          📇 Licenciés <span className="hint">({licencies.length})</span>
        </h1>
        <Link className="btn btn-ghost btn-sm" to="/">
          ← Retour aux concours
        </Link>
      </div>

      <div className="draw-panel licencies-import no-print">
        <h2>Importer un fichier CSV</h2>
        <p className="hint">
          Colonnes reconnues : Nom, Prénom, Licence, Club (séparées par « ; », « , » ou
          tabulation, avec ou sans en-tête).{' '}
          <a href={TEMPLATE} download="licencies-modele.csv">
            Télécharger un modèle
          </a>
          . Les licenciés servent à l'autocomplétion lors des inscriptions.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv,text/plain"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        {message && <p className="hint import-message">{message}</p>}
      </div>

      <div className="toolbar no-print">
        <input
          placeholder="Rechercher (nom, licence, club)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {licencies.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (window.confirm(`Supprimer les ${licencies.length} licenciés ?`)) {
                void deleteAllLicencies();
              }
            }}
          >
            🗑 Tout supprimer
          </button>
        )}
      </div>

      <table className="teams-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Licence</th>
            <th>Club</th>
            <th className="no-print"></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((l) => (
            <tr key={l.id}>
              <td>{l.name}</td>
              <td>{l.licence ?? ''}</td>
              <td>{l.club ?? ''}</td>
              <td className="no-print cell-actions">
                <button
                  className="btn-icon btn-icon-danger"
                  title="Supprimer"
                  onClick={() => void deleteLicencie(l.id)}
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-cell">
                {licencies.length === 0
                  ? 'Aucun licencié — importez le fichier de votre club ou comité.'
                  : 'Aucun résultat pour cette recherche.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {filtered.length > shown.length && (
        <p className="hint">… et {filtered.length - shown.length} autres (affinez la recherche).</p>
      )}
    </div>
  );
}
