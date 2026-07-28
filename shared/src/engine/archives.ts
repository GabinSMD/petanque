/**
 * Archivage d'un concours (manuel « Gestion Concours » §3.F.3).
 *
 * Dans le logiciel fédéral, archiver déplace le fichier du concours dans le
 * dossier « Archives » : il sort de la liste courante mais reste entier, et le
 * menu « Importer » sait le relire. Archiver n'est donc pas supprimer — c'est
 * ranger.
 *
 * Ici il n'y a pas de fichiers à déplacer : le concours porte la date à
 * laquelle il a été rangé. Absente, il est courant. Rien n'est perdu, rien
 * n'est même déplacé — seules les listes changent.
 */

/** Ce qu'il faut d'un concours pour savoir s'il est rangé. */
export interface Archivable {
  archiveLe?: string;
}

/**
 * Un concours est archivé dès qu'il porte une date de rangement. Une chaîne
 * vide ou blanche ne compte pas : on ne sort pas un concours de la liste
 * courante sur une valeur douteuse.
 */
export function estArchive(c: Archivable): boolean {
  return Boolean(c.archiveLe?.trim());
}

/**
 * Range un concours. Déjà rangé, il garde sa date d'origine : un clic de trop
 * ne doit pas faire mentir la date de rangement.
 */
export function archiver<T extends Archivable>(c: T, quand: string): T {
  return estArchive(c) ? c : { ...c, archiveLe: quand };
}

/** Remet un concours dans la liste courante. */
export function desarchiver<T extends Archivable>(c: T): T {
  return { ...c, archiveLe: undefined };
}

/**
 * Sépare une liste de concours en courants et archivés, chacun dans l'ordre
 * d'origine. Source unique de la distinction, pour que le tableau de bord et
 * le palmarès ne divergent pas.
 */
export function partitionArchives<T extends Archivable>(
  liste: T[],
): { courants: T[]; archives: T[] } {
  const courants: T[] = [];
  const archives: T[] = [];
  for (const c of liste) (estArchive(c) ? archives : courants).push(c);
  return { courants, archives };
}
