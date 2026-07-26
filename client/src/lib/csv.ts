/** Import CSV des licenciés — tolérant aux formats d'export courants. */

export interface LicencieRow {
  name: string;
  licence?: string;
  club?: string;
}

const strip = (s: string): string => s.replace(/^"(.*)"$/, '$1').trim();

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Accepte ; , ou tabulation, avec ou sans ligne d'en-tête.
 * Colonnes reconnues : nom, prénom, licence (ou n°), club — sinon
 * l'ordre supposé est Nom;Prénom;Licence;Club.
 */
export function parseLicenciesCsv(text: string): { rows: LicencieRow[]; skipped: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], skipped: 0 };

  const first = lines[0]!;
  const delim = [';', ',', '\t'].reduce((best, d) =>
    first.split(d).length > first.split(best).length ? d : best,
  );

  const headerCells = first.split(delim).map((c) => norm(strip(c)));
  const hasHeader = headerCells.some(
    (c) => c.includes('nom') || c.includes('licence') || c.includes('club'),
  );

  let idxNom = 0;
  let idxPrenom = 1;
  let idxLicence = 2;
  let idxClub = 3;
  let idxComplet = -1;

  if (hasHeader) {
    idxNom = headerCells.findIndex((c) => c.includes('nom') && !c.includes('pren'));
    idxPrenom = headerCells.findIndex((c) => c.includes('pren'));
    idxLicence = headerCells.findIndex(
      (c) => c.includes('lic') || c.includes('numero') || c === 'n' || c.includes('n°'),
    );
    idxClub = headerCells.findIndex((c) => c.includes('club'));
    idxComplet = headerCells.findIndex((c) => c.includes('joueur') || c === 'nom complet');
  }

  const rows: LicencieRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = line.split(delim).map(strip);
    let name = '';
    if (idxComplet >= 0) {
      name = cells[idxComplet] ?? '';
    } else {
      const nom = idxNom >= 0 ? (cells[idxNom] ?? '') : '';
      const prenom = idxPrenom >= 0 ? (cells[idxPrenom] ?? '') : '';
      name = `${prenom} ${nom}`.trim();
    }
    if (!name) {
      skipped += 1;
      continue;
    }
    rows.push({
      name,
      licence: idxLicence >= 0 ? cells[idxLicence] || undefined : undefined,
      club: idxClub >= 0 ? cells[idxClub] || undefined : undefined,
    });
  }
  return { rows, skipped };
}
