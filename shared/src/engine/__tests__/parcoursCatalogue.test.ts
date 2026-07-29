import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PARCOURS, parcoursParId } from '../parcoursCatalogue';
import { ciblesParcours } from '../parcours';

const CLIENT_SRC = fileURLToPath(new URL('../../../../client/src', import.meta.url));

/** Tous les fichiers source du client, à plat. */
function fichiersClient(dir = CLIENT_SRC): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersClient(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Ancres `data-tour="…"` réellement posées dans l'interface. */
function ancresPosees(): Set<string> {
  const ancres = new Set<string>();
  for (const f of fichiersClient()) {
    const src = readFileSync(f, 'utf8');
    // Littéral (data-tour="poules") et interpolation (data-tour={`tab-${k}`}).
    for (const m of src.matchAll(/data-tour="([^"{}$]+)"/g)) ancres.add(m[1]!);
    for (const m of src.matchAll(/data-tour=\{`([^`$]*)\$\{[^}]*\}`\}/g)) {
      ancres.add(`${m[1]!}*`); // préfixe dynamique : « tab-* »
    }
  }
  return ancres;
}

/** Une ancre couvre-t-elle ce nom ? (littérale, ou préfixe dynamique) */
function couverte(nom: string, ancres: Set<string>): boolean {
  if (ancres.has(nom)) return true;
  for (const a of ancres) {
    if (a.endsWith('*') && nom.startsWith(a.slice(0, -1))) return true;
  }
  return false;
}

describe('cibles des parcours', () => {
  const ancres = ancresPosees();

  it('l\'interface pose bien des ancres (sinon le test ne prouve rien)', () => {
    expect(ancres.size).toBeGreaterThan(5);
  });

  it.each(PARCOURS.map((p) => [p.id, p] as const))(
    'toutes les cibles de « %s » existent dans le client',
    (_id, parcours) => {
      const manquantes = ciblesParcours(parcours)
        .map((sel) => /^\[data-tour="([^"]+)"\]$/.exec(sel)?.[1] ?? sel)
        .filter((nom) => !couverte(nom, ancres));
      // Un surlignage fantôme est le pire défaut d'un guide : il fait perdre
      // confiance sans rien signaler. Ce test le rend impossible en silence.
      expect(manquantes).toEqual([]);
    },
  );

  it('toutes les cibles sont des sélecteurs d\'ancre, pas des classes CSS', () => {
    // Une classe se renomme au premier remaniement de style ; une ancre
    // `data-tour` est là *pour* être visée.
    const suspectes = PARCOURS.flatMap(ciblesParcours).filter(
      (sel) => !/^\[data-tour="[^"]+"\]$/.test(sel),
    );
    expect(suspectes).toEqual([]);
  });
});

describe('structure du catalogue', () => {
  it('les identifiants sont uniques', () => {
    const ids = PARCOURS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('se retrouvent par identifiant', () => {
    expect(parcoursParId('tirer-poules')?.titre).toBe('Tirer les poules');
    expect(parcoursParId('inexistant')).toBeUndefined();
  });

  it.each(PARCOURS.map((p) => [p.id, p] as const))('« %s » est jouable', (_id, parcours) => {
    expect(parcours.etapes.length).toBeGreaterThan(0);
    for (const e of parcours.etapes) {
      expect(e.titre.trim()).not.toBe('');
      expect(e.texte.trim()).not.toBe('');
      if (e.route) expect(e.route.startsWith('/')).toBe(true);
    }
  });

  it.each(PARCOURS.map((p) => [p.id, p] as const))(
    '« %s » sait où ramener quelqu\'un qui s\'est égaré',
    (_id, parcours) => {
      expect(parcours.retour.startsWith('/')).toBe(true);
      // Un parcours de concours ne peut pas ramener sur un écran général.
      if (parcours.besoinConcours) expect(parcours.retour).toContain(':id');
    },
  );

  it('une étape « clic » vise forcément quelque chose', () => {
    // Sans cible, il n'y a rien à cliquer : l'étape ne passerait jamais.
    const orphelines = PARCOURS.flatMap((p) =>
      p.etapes
        .filter((e) => e.declencheur.type === 'clic' && !e.cible)
        .map((e) => `${p.id} / ${e.titre}`),
    );
    expect(orphelines).toEqual([]);
  });

  it('chaque parcours finit sur une étape franchissable sans donnée', () => {
    // Une dernière étape suspendue à un jalon laisserait le parcours ouvert
    // indéfiniment chez qui ne fait pas le geste.
    const suspendus = PARCOURS.filter(
      (p) => p.etapes[p.etapes.length - 1]!.declencheur.type === 'jalon',
    ).map((p) => p.id);
    expect(suspendus).toEqual([]);
  });

  it('couvre les cas d\'usage annoncés', () => {
    const attendus = [
      'creer-concours',
      'inscrire-equipes',
      'tirer-poules',
      'saisir-score',
      'corriger-score',
      'barrage',
      'lancer-tableau',
      'consolante',
      'affichage-public',
      'impressions',
      'feuille-match',
      'exporter-resultats',
    ];
    const ids = PARCOURS.map((p) => p.id);
    expect(attendus.filter((a) => !ids.includes(a))).toEqual([]);
  });

  it('les parcours de concours le déclarent', () => {
    // Faute de quoi l'assistant surligne le vide au lieu de dire « ouvrez
    // d'abord un concours ».
    for (const id of ['inscrire-equipes', 'tirer-poules', 'saisir-score', 'barrage']) {
      expect(parcoursParId(id)?.besoinConcours).toBe(true);
    }
    // Ceux-là s'ouvrent depuis n'importe où.
    for (const id of ['creer-concours', 'feuille-match', 'decouverte']) {
      expect(parcoursParId(id)?.besoinConcours).toBeUndefined();
    }
  });
});
