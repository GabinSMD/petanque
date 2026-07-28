import { Link } from 'react-router-dom';
import type { Concours } from '@shared';
import { useConcoursList } from '../db/hooks';

interface Props {
  concours: Concours;
}

/**
 * Lien entre un concours fractionné et ses sites (manuel §3.B.10.D).
 *
 * Sans ça, le fractionnement produirait des concours orphelins : trois lignes
 * qui se ressemblent dans la liste, sans moyen de savoir qu'elles forment un
 * même qualificatif. On l'affiche dans les deux sens — depuis l'origine vers
 * ses sites, et depuis un site vers ses voisins.
 */
export function LienMultisite({ concours }: Props) {
  const tous = useConcoursList() ?? [];
  const sites = tous
    .filter((c) => c.issuDeConcours === (concours.issuDeConcours ?? concours.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  if (sites.length === 0) return null;

  const origine = concours.issuDeConcours
    ? tous.find((c) => c.id === concours.issuDeConcours)
    : concours;
  const autres = sites.filter((c) => c.id !== concours.id);

  return (
    <p className="hint no-print multisite-lien">
      🏟{' '}
      {concours.issuDeConcours ? (
        <>
          Site d'un concours fractionné en {sites.length}
          {origine && (
            <>
              {' '}
              — origine :{' '}
              <Link to={`/concours/${origine.id}`}>{origine.name}</Link>
            </>
          )}
          .
        </>
      ) : (
        <>Fractionné en {sites.length} sites.</>
      )}
      {autres.length > 0 && (
        <>
          {' '}
          {concours.issuDeConcours ? 'Autres sites' : 'Sites'} :{' '}
          {autres.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <Link to={`/concours/${c.id}`}>{c.lieu?.trim() || c.name}</Link>
            </span>
          ))}
          .
        </>
      )}
    </p>
  );
}
