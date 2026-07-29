import { describe, expect, it } from 'vitest';
import { lireInscritsCsv } from '../inscritsImport';

/** Ce que produit « 📋 Engagés (CSV) » de l'application. */
const NOTRE_EXPORT = `N°;Joueurs;Licences;Club;Forfait;Réglé
1;DUPOND Jean / MARTIN Lina;02600100 / 02600101;Boule de l'Avenir;;oui
2;BLANC Odette / NOIR Paul;02600102 / ;PC Romans;oui;
3;SEUL Gerard;02600103;Crest;;`;

function lire(texte: string) {
  const res = lireInscritsCsv(texte);
  if (!res.ok) throw new Error(`lecture refusée : ${res.erreur}`);
  return res;
}

describe('import d\'une liste d\'inscrits (§3.B.10.B)', () => {
  it('relit l\'export de l\'application, joueurs et licences appariés', () => {
    const { equipes, ignorees } = lire(NOTRE_EXPORT);
    expect(ignorees).toBe(0);
    expect(equipes).toHaveLength(3);
    expect(equipes[0]).toMatchObject({
      number: 1,
      club: 'Boule de l\'Avenir',
      paid: true,
      forfait: false,
    });
    expect(equipes[0]!.players).toEqual([
      { name: 'DUPOND Jean', licence: '02600100' },
      { name: 'MARTIN Lina', licence: '02600101' },
    ]);
  });

  it('une licence manquante ne décale pas les joueurs', () => {
    // « 02600102 / » : le second joueur n'a pas de licence, mais il existe.
    const { equipes } = lire(NOTRE_EXPORT);
    expect(equipes[1]!.players).toEqual([
      { name: 'BLANC Odette', licence: '02600102' },
      { name: 'NOIR Paul' },
    ]);
  });

  it('un joueur manquant au milieu ne décale pas les licences des suivants', () => {
    // Une triplette inscrite à deux : la place vide est au milieu. Apparier
    // après avoir retiré les vides donnerait au troisième la licence du second.
    const troue = `N°;Joueurs;Licences;Club
9;DUPOND Jean / / MARTIN Lina;02600100 / 02600102 / 02600101;Crest`;
    const { equipes } = lire(troue);
    expect(equipes[0]!.players).toEqual([
      { name: 'DUPOND Jean', licence: '02600100' },
      { name: 'MARTIN Lina', licence: '02600101' },
    ]);
  });

  it('reprend le forfait et le règlement', () => {
    const { equipes } = lire(NOTRE_EXPORT);
    expect(equipes[1]!.forfait).toBe(true);
    expect(equipes[1]!.paid).toBe(false);
  });

  it('accepte une équipe d\'un seul joueur', () => {
    const { equipes } = lire(NOTRE_EXPORT);
    expect(equipes[2]!.players).toHaveLength(1);
  });

  it('accepte une colonne par joueur, comme un tableur fait à la main', () => {
    const tableur = `Equipe,Joueur 1,Licence 1,Joueur 2,Licence 2,Club
5,DUPOND Jean,02600100,MARTIN Lina,02600101,Boule de l'Avenir
6,SEUL Gerard,,,,Crest`;
    const { equipes } = lire(tableur);
    expect(equipes).toHaveLength(2);
    expect(equipes[0]!.number).toBe(5);
    expect(equipes[0]!.players).toEqual([
      { name: 'DUPOND Jean', licence: '02600100' },
      { name: 'MARTIN Lina', licence: '02600101' },
    ]);
    expect(equipes[1]!.players).toEqual([{ name: 'SEUL Gerard' }]);
  });

  it('accepte la virgule, le point-virgule et la tabulation', () => {
    const virgule = 'N°,Joueurs,Club\n1,DUPOND Jean,Crest';
    const tab = 'N°\tJoueurs\tClub\n1\tDUPOND Jean\tCrest';
    expect(lire(virgule).equipes).toHaveLength(1);
    expect(lire(tab).equipes).toHaveLength(1);
  });

  it('compte les lignes sans joueur au lieu de les inventer', () => {
    const troue = `N°;Joueurs;Club
1;DUPOND Jean;Crest
2;;Die
3;   ;Nyons`;
    const { equipes, ignorees } = lire(troue);
    expect(equipes).toHaveLength(1);
    expect(ignorees).toBe(2);
  });

  it('refuse un fichier qui n\'est pas une liste d\'inscrits, en disant quoi', () => {
    // Chaque refus mérite son message : « vide » et « pas les bonnes colonnes »
    // ne demandent pas la même correction à l'utilisateur.
    const vide = lireInscritsCsv('');
    expect(vide.ok).toBe(false);
    if (!vide.ok) expect(vide.erreur).toMatch(/vide/i);

    for (const intrus of ['du texte au hasard', 'a;b;c\n1;2;3']) {
      const res = lireInscritsCsv(intrus);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.erreur).toMatch(/colonne/i);
    }
  });

  it('refuse un fichier de licenciés : c\'est l\'erreur qui arrivera', () => {
    const licencies = `Nom;Prénom;Licence;Club;Date de naissance
DUPOND;Jean;02600100;Crest;01/05/1980`;
    const res = lireInscritsCsv(licencies);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.erreur).toMatch(/licenciés/i);
  });

  it('sans numéro d\'équipe, l\'import se fait quand même', () => {
    const sansNumero = `Joueurs;Club
DUPOND Jean / MARTIN Lina;Crest`;
    const { equipes } = lire(sansNumero);
    expect(equipes[0]!.number).toBeUndefined();
    expect(equipes[0]!.players).toHaveLength(2);
  });
});
