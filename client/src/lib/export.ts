import type { Concours, FeuilleMatch, Match, Poule, Team } from '@shared';
import { arbitrageReport, csvInscrits, designationCategorie, ecrireFeuilleFichier, libelleClubs } from '@shared';
import { teamDisplayName } from '../components/TeamLabel';
import { DISCIPLINE_LABELS, FORMAT_LABELS, MODE_LABELS, NIVEAU_LABELS } from './labels';
import { finalRanking } from './results';

/** Déclenche le téléchargement d'un fichier texte dans le navigateur. */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob(['﻿' + text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nom de fichier « sûr » à partir du nom du concours. */
export function safeFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'concours'
  );
}

/** Échappe une valeur pour un CSV à séparateur point-virgule (tableur FR). */
function csvCell(value: string | number | undefined | null): string {
  const s = value == null ? '' : String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

/**
 * CSV des équipes engagées (dossard, joueurs, licences, club, réglé).
 *
 * Le format vit dans le moteur, à côté de son lecteur : c'est un fichier fait
 * pour être réimporté, et les deux sont éprouvés ensemble par aller-retour.
 */
export function engagesCSV(_concours: Concours, teams: Team[]): string {
  return csvInscrits(teams);
}

/**
 * Liste spécifique (manuel §3.D.1.B.5.1) : la sélection cochée à la main,
 * dans le même format que les engagés — c'est ce fichier qui amorce le
 * concours suivant.
 */
export function exportListeSpecifique(concours: Concours, teams: Team[]): void {
  const retenues = teams.filter((t) => t.retenue);
  downloadText(
    `${safeFilename(concours.name)}-liste-specifique.csv`,
    csvInscrits(retenues),
    'text/csv',
  );
}

/** CSV du classement final (rang, équipe, joueurs, licences, club). */
export function classementCSV(
  concours: Concours,
  teams: Team[],
  poules: Poule[],
  matches: Match[],
): string {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const rows: (string | number | null)[][] = [
    ['Rang', 'Catégorie', 'Équipe', 'Joueurs', 'Licences', 'Club'],
  ];
  for (const g of finalRanking(concours, teams, poules, matches)) {
    for (const id of g.teamIds) {
      const t = byId.get(id);
      if (!t) continue;
      rows.push([
        g.rank,
        g.label,
        t.number,
        t.players.map((p) => p.name).join(' / '),
        t.players.map((p) => p.licence ?? '').join(' / '),
        libelleClubs(t.players, t.club),
      ]);
    }
  }
  return toCSV(rows);
}

/**
 * Résultats d'arbitrage au format du tableur fédéral (manuel §3.D.1.B.4.5) :
 * une ligne par joueur, regroupée par place, avec les colonnes attendues par
 * le comité pour la saisie dans Geslico.
 *
 * « N° Dép. » et « Points » restent vides : la première demande le fichier
 * fédéral des licenciés, la seconde est remplie par le comité.
 */
export function arbitrageCSV(concours: Concours, teams: Team[], matches: Match[]): string {
  const report = arbitrageReport(teams, matches);
  const rows: (string | number | null)[][] = [
    ['RÉSULTATS DU CONCOURS', concoursSummaryLine(concours)],
    ['Comité', concours.comiteOrganisateur ?? '', 'Club organisateur', concours.clubOrganisateur ?? ''],
    ['Niveau', concours.niveau ? NIVEAU_LABELS[concours.niveau] : ''],
    ['Lieu', concours.lieu ?? '', 'Nombre d\'équipes', report.stats.equipes],
    [],
    ['N° Licence', 'Nom, Prénom', 'Association ou Club', 'N° Dép.', 'N° d\'équipe', 'Points'],
  ];

  for (const section of report.sections) {
    rows.push([section.label]);
    for (const team of section.teams) {
      team.players.forEach((p, i) => {
        rows.push([
          p.licence ?? '',
          p.name.toLocaleUpperCase('fr-FR'),
          p.club ?? team.club ?? '',
          '',
          // Le n° d'équipe n'est porté que par la première ligne, comme sur
          // la feuille fédérale.
          i === 0 ? team.number : '',
          '',
        ]);
      });
    }
  }

  rows.push([]);
  rows.push(['Bilan des équipes engagées', report.stats.equipes]);
  rows.push(['dont forfaits', report.stats.forfaits]);
  rows.push(['Joueurs', report.stats.joueurs]);
  rows.push(['Joueurs sans n° de licence', report.stats.joueursSansLicence]);
  rows.push([]);
  rows.push(['Arbitre principal', '']);
  rows.push(['Fait à', '', 'le', '']);
  return toCSV(rows);
}

export function exportArbitrageCSV(concours: Concours, teams: Team[], matches: Match[]): void {
  downloadText(
    `arbitrage-${safeFilename(concours.name)}.csv`,
    arbitrageCSV(concours, teams, matches),
    'text/csv',
  );
}

/** Sauvegarde JSON complète et relisible d'un concours (données brutes). */
export function concoursBackupJSON(
  concours: Concours,
  teams: Team[],
  poules: Poule[],
  matches: Match[],
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'petanque-concours',
      version: 1,
      concours,
      teams,
      poules,
      matches,
    },
    null,
    2,
  );
}

/** Résumé lisible d'un concours (en-tête des exports). */
export function concoursSummaryLine(concours: Concours): string {
  const parts = [
    concours.name,
    concours.date,
    concours.discipline === 'jeu_provencal' ? DISCIPLINE_LABELS.jeu_provencal : 'Pétanque',
    FORMAT_LABELS[concours.format],
    MODE_LABELS[concours.mode],
  ];
  const categorie = designationCategorie(concours);
  if (categorie) parts.push(categorie);
  return parts.join(' · ');
}

/**
 * Liste des qualifiés d'un concours qualificatif. Les colonnes sont celles que
 * l'import des licenciés reconnaît : le fichier se réimporte donc tel quel pour
 * la phase finale (manuel §3.D.2, « extraire la liste spécifique »).
 */
export function qualifiesCSV(teams: Team[]): string {
  // Colonne « Joueur » : l'import des licenciés la reconnaît comme un nom
  // complet. On évite ainsi de deviner où s'arrête le prénom — « Jean-Paul
  // Martin Le Goff » ne se découpe pas de façon fiable.
  const rows: (string | number | null)[][] = [['N° équipe', 'Joueur', 'Licence', 'Club']];
  for (const t of [...teams].sort((a, b) => a.number - b.number)) {
    for (const p of t.players) {
      rows.push([t.number, p.name, p.licence ?? '', p.club ?? t.club ?? '']);
    }
  }
  return toCSV(rows);
}

export function exportQualifiesCSV(concours: Concours, teams: Team[]): void {
  downloadText(
    `qualifies-${safeFilename(concours.name)}.csv`,
    qualifiesCSV(teams),
    'text/csv',
  );
}

export function exportEngagesCSV(concours: Concours, teams: Team[]): void {
  downloadText(`engages-${safeFilename(concours.name)}.csv`, engagesCSV(concours, teams), 'text/csv');
}

export function exportClassementCSV(
  concours: Concours,
  teams: Team[],
  poules: Poule[],
  matches: Match[],
): void {
  downloadText(
    `classement-${safeFilename(concours.name)}.csv`,
    classementCSV(concours, teams, poules, matches),
    'text/csv',
  );
}

/** Sauvegarde d'une feuille de match dans un fichier autonome. */
export function exportFeuilleJSON(feuille: FeuilleMatch): void {
  const nom = [
    'feuille',
    feuille.date,
    feuille.club || 'nous',
    feuille.adversaire || 'adversaire',
  ].join('-');
  downloadText(`${safeFilename(nom)}.json`, ecrireFeuilleFichier(feuille), 'application/json');
}

export function exportBackupJSON(
  concours: Concours,
  teams: Team[],
  poules: Poule[],
  matches: Match[],
): void {
  downloadText(
    `${safeFilename(concours.name)}.json`,
    concoursBackupJSON(concours, teams, poules, matches),
    'application/json',
  );
}
