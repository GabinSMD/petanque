/**
 * Import du fichier des licenciés (CSV), tolérant aux formats d'export
 * courants : séparateur « ; », « , » ou tabulation, en-tête facultatif,
 * colonnes reconnues par mots-clés et non par position.
 *
 * On préfère ignorer une valeur illisible plutôt que d'en inventer une :
 * un contrôle de licence appuyé sur une donnée fausse est pire que pas de
 * contrôle du tout.
 */
import type { Classification, Sexe, EtatMutation } from '../types';

export interface LicencieRow {
  name: string;
  licence?: string;
  club?: string;
  clubNumero?: string;
  comite?: string;
  dateNaissance?: string;
  sexe?: Sexe;
  classification?: Classification;
  anneeReprise?: number;
  certificatMedical?: string;
  nationalite?: string;
  mutation?: boolean;
  etatMutation?: EtatMutation;
  suspendu?: boolean;
}

const strip = (s: string): string => s.replace(/^"(.*)"$/, '$1').trim();

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Date fédérale : accepte JJ/MM/AAAA et AAAA-MM-JJ, rend l'ISO ou rien. */
export function parseDateFr(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  let y: number, m: number, d: number;
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (fr) {
    [y, m, d] = [Number(fr[3]), Number(fr[2]), Number(fr[1])];
  } else {
    return undefined;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const iso2 = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Rejette les dates inexistantes (31 février…).
  const parsed = new Date(`${iso2}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== d) return undefined;
  return iso2;
}

function parseSexe(value: string | undefined): Sexe | undefined {
  if (!value) return undefined;
  const v = norm(value);
  if (v.startsWith('h') || v.startsWith('m')) return 'M';
  if (v.startsWith('f')) return 'F';
  return undefined;
}

function parseClassification(value: string | undefined): Classification | undefined {
  if (!value) return undefined;
  const v = norm(value);
  if (v.startsWith('e')) return 'E';
  if (v.startsWith('h')) return 'H';
  if (v.startsWith('p')) return 'P';
  return undefined;
}

function parseAnnee(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value.trim());
  if (!Number.isInteger(n) || n < 1900 || n > 2200) return undefined;
  return n;
}

/**
 * Colonne « Position » du fichier fédéral : l'état de mutation.
 *
 * Le logiciel fédéral affiche « MUT.OK » pour un joueur non muté et « MUT.INT »
 * pour une mutation interne (manuel p.114) ; « MUT.EXT » s'en déduit. L'ancienne
 * lecture prenait tout ce qui commençait par « mut » pour une mutation : chaque
 * « MUT.OK » comptait au contingent, et des équipes conformes étaient refusées.
 *
 * Les valeurs d'un fichier fait à la main (« muté », « oui », « X ») disent
 * qu'il y a mutation sans dire laquelle : `etat` reste vide, et le contrôle la
 * compte comme externe — c'est ce qu'il faisait avant, il ne s'ouvre pas.
 */
export function parsePosition(
  value: string | undefined,
): { etat?: EtatMutation; mute?: boolean } {
  if (!value || !value.trim()) return {};
  const v = norm(value).replace(/[^a-z0-9]/g, '');
  if (v.includes('ext')) return { etat: 'externe', mute: true };
  if (v.includes('int')) return { etat: 'interne', mute: true };
  if (v.endsWith('ok') || v.startsWith('non') || v === '0' || v === 'n') {
    return { etat: 'aucune', mute: false };
  }
  if (v.startsWith('mut') || v === 'oui' || v === '1' || v === 'x' || v === 'm') {
    return { mute: true };
  }
  return {};
}

/**
 * Colonne de suspension. Le format d'un export réel n'est pas documenté : toute
 * valeur qui n'est pas une négation vaut suspension (« oui », « S », une date
 * de fin…). Une cellule vide, colonne présente, vaut « non suspendu » — sans
 * quoi un réimport ne lèverait jamais une suspension terminée.
 */
function parseSuspension(value: string | undefined): boolean {
  if (!value || !value.trim()) return false;
  const v = norm(value).trim();
  return !(v.startsWith('non') || v === '0' || v === 'n' || v === 'false');
}

/** En-tête désignant un numéro (« n° club », « num club », « code club »). */
function estNumero(header: string): boolean {
  return /(^|\s)(n°|no|num|numero|code)(\s|$)/.test(header);
}

/** Colonnes reconnues, par mots-clés sur l'en-tête normalisé. */
interface ColumnSpec {
  key: string;
  match: (header: string) => boolean;
}

const COLUMNS: ColumnSpec[] = [
  { key: 'complet', match: (h) => h.includes('joueur') || h === 'nom complet' },
  { key: 'nom', match: (h) => h.includes('nom') && !h.includes('pren') && !h.includes('complet') },
  { key: 'prenom', match: (h) => h.includes('pren') },
  {
    key: 'licence',
    match: (h) => h.includes('licence') || h === 'lic' || h === 'n' || h === 'n°' || h === 'numero',
  },
  { key: 'clubNumero', match: (h) => h.includes('club') && estNumero(h) },
  {
    key: 'club',
    match: (h) => (h.includes('club') || h.includes('association')) && !estNumero(h),
  },
  { key: 'comite', match: (h) => h.includes('comite') || h === 'cd' || h.includes('departement') },
  {
    key: 'dateNaissance',
    match: (h) => h.includes('naissance') || h.includes('ne le') || h.includes('nee le'),
  },
  { key: 'sexe', match: (h) => h.includes('sexe') || h.includes('genre') },
  {
    key: 'classification',
    match: (h) => h.includes('classification') || h.includes('classement') || h.includes('categorie f'),
  },
  {
    key: 'anneeReprise',
    match: (h) =>
      !h.includes('naissance') &&
      (h.includes('reprise') || h.includes('saison') || h.includes('annee')),
  },
  {
    key: 'certificatMedical',
    match: (h) => h.includes('certificat') || h.includes('medical') || h === 'cm',
  },
  { key: 'nationalite', match: (h) => h.includes('nationalite') || h.includes('pays') },
  { key: 'mutation', match: (h) => h.includes('mutation') || h.includes('mute') || h.includes('position') },
  { key: 'suspension', match: (h) => h.includes('suspen') },
];

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

  /** Index de chaque colonne reconnue ; -1 = absente. */
  const idx: Record<string, number> = {};
  if (hasHeader) {
    for (const spec of COLUMNS) {
      idx[spec.key] = headerCells.findIndex((h) => spec.match(h));
    }
  } else {
    // Sans en-tête, l'ordre historique : Nom ; Prénom ; Licence ; Club.
    idx.nom = 0;
    idx.prenom = 1;
    idx.licence = 2;
    idx.club = 3;
  }

  const cell = (cells: string[], key: string): string | undefined => {
    const i = idx[key];
    if (i === undefined || i < 0) return undefined;
    return cells[i] || undefined;
  };

  const rows: LicencieRow[] = [];
  let skipped = 0;

  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cells = line.split(delim).map(strip);

    const complet = cell(cells, 'complet');
    const nom = cell(cells, 'nom') ?? '';
    const prenom = cell(cells, 'prenom') ?? '';
    const name = (complet ?? `${prenom} ${nom}`).trim();
    if (!name) {
      skipped += 1;
      continue;
    }

    rows.push({
      name,
      licence: cell(cells, 'licence'),
      club: cell(cells, 'club'),
      clubNumero: cell(cells, 'clubNumero'),
      comite: cell(cells, 'comite'),
      dateNaissance: parseDateFr(cell(cells, 'dateNaissance')),
      sexe: parseSexe(cell(cells, 'sexe')),
      classification: parseClassification(cell(cells, 'classification')),
      anneeReprise: parseAnnee(cell(cells, 'anneeReprise')),
      certificatMedical: parseDateFr(cell(cells, 'certificatMedical')),
      nationalite: cell(cells, 'nationalite'),
      ...(() => {
        const position = parsePosition(cell(cells, 'mutation'));
        return { mutation: position.mute, etatMutation: position.etat };
      })(),
      suspendu: (idx.suspension ?? -1) >= 0 ? parseSuspension(cell(cells, 'suspension')) : undefined,
    });
  }

  return { rows, skipped };
}
