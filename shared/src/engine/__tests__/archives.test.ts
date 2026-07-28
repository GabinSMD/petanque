import { describe, expect, it } from 'vitest';
import { archiver, desarchiver, estArchive, partitionArchives } from '../archives';

const QUAND = '2026-07-28T18:00:00.000Z';

/** Un concours réduit à ce qui compte ici. */
interface FauxConcours {
  id: string;
  archiveLe?: string;
}
const faux = (id: string, archiveLe?: string): FauxConcours => ({ id, archiveLe });

describe('archivage d\'un concours', () => {
  it('un concours sans date d\'archivage est courant', () => {
    expect(estArchive({})).toBe(false);
    expect(estArchive({ archiveLe: undefined })).toBe(false);
  });

  it('une date d\'archivage suffit à le sortir de la liste courante', () => {
    expect(estArchive({ archiveLe: QUAND })).toBe(true);
  });

  it('une date vide ne compte pas : on n\'archive pas sur une valeur douteuse', () => {
    expect(estArchive({ archiveLe: '' })).toBe(false);
    expect(estArchive({ archiveLe: '   ' })).toBe(false);
  });

  it('archiver pose la date, désarchiver l\'enlève', () => {
    const c = faux('c1');
    const range = archiver(c, QUAND);
    expect(estArchive(range)).toBe(true);
    expect(range.archiveLe).toBe(QUAND);
    expect(estArchive(desarchiver(range))).toBe(false);
    // L'original n'est pas modifié : les entités se remplacent, jamais en place.
    expect(c.archiveLe).toBeUndefined();
  });

  it('archiver deux fois conserve la date d\'origine', () => {
    // Sinon un clic de trop ferait mentir la date de rangement.
    const deja = archiver(faux('c1'), QUAND);
    const encore = archiver(deja, '2027-01-01T00:00:00.000Z');
    expect(encore.archiveLe).toBe(QUAND);
  });

  it('désarchiver puis réarchiver donne la nouvelle date', () => {
    const plusTard = '2027-01-01T00:00:00.000Z';
    const cycle = archiver(desarchiver(archiver(faux('c1'), QUAND)), plusTard);
    expect(cycle.archiveLe).toBe(plusTard);
  });

  it('sépare les courants des archivés en conservant l\'ordre', () => {
    const liste = [faux('a'), faux('b', QUAND), faux('c'), faux('d', QUAND)];
    const { courants, archives } = partitionArchives(liste);
    expect(courants.map((c) => c.id)).toEqual(['a', 'c']);
    expect(archives.map((c) => c.id)).toEqual(['b', 'd']);
    // La liste d'entrée est intacte.
    expect(liste).toHaveLength(4);
  });

  it('sépare une liste vide sans broncher', () => {
    expect(partitionArchives<FauxConcours>([])).toEqual({ courants: [], archives: [] });
  });
});
