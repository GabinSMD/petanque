/**
 * Valeurs de départ des nouveaux concours.
 *
 * Un club joue presque toujours sur le même boulodrome, au même nombre de
 * terrains, en 13 points, avec la même mise. L'organisateur les retapait à
 * chaque création : on retient celles du dernier concours créé sur l'appareil.
 *
 * Rien de ce qui est propre à un concours n'en fait partie — nom, date,
 * formule, catégorie. La formation non plus : elle se choisit sur une carte à
 * l'étape précédente, et la présélectionner ferait sauter un choix qui compte.
 */
export interface DefautsConcours {
  nbTerrains: number;
  scoreMax: number;
  consolante: boolean;
  planTerrains: boolean;
  lieu?: string;
  miseParJoueur?: number;
}

/** Ce que l'application proposait avant qu'on retienne quoi que ce soit. */
export const DEFAUTS_ORIGINE: DefautsConcours = {
  nbTerrains: 8,
  scoreMax: 13,
  consolante: true,
  planTerrains: true,
};

const entier = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

/**
 * Relit un enregistrement brut. Un champ absent, mal typé ou hors bornes
 * retombe sur la valeur d'origine plutôt que de proposer un « 0 terrain » ou
 * un score de 3 points à quelqu'un qui n'a rien demandé. Un enregistrement
 * illisible vaut l'origine entière.
 */
export function lireDefautsConcours(brut: string | null | undefined): DefautsConcours {
  if (!brut) return { ...DEFAUTS_ORIGINE };
  let v: unknown;
  try {
    v = JSON.parse(brut);
  } catch {
    return { ...DEFAUTS_ORIGINE };
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return { ...DEFAUTS_ORIGINE };
  const o = v as Record<string, unknown>;
  const lieu = typeof o.lieu === 'string' && o.lieu.trim() ? o.lieu.trim() : undefined;
  const mise =
    typeof o.miseParJoueur === 'number' && Number.isFinite(o.miseParJoueur) && o.miseParJoueur > 0
      ? o.miseParJoueur
      : undefined;
  return {
    nbTerrains: entier(o.nbTerrains, 1, 500) ?? DEFAUTS_ORIGINE.nbTerrains,
    scoreMax: entier(o.scoreMax, 1, 99) ?? DEFAUTS_ORIGINE.scoreMax,
    consolante: typeof o.consolante === 'boolean' ? o.consolante : DEFAUTS_ORIGINE.consolante,
    planTerrains:
      typeof o.planTerrains === 'boolean' ? o.planTerrains : DEFAUTS_ORIGINE.planTerrains,
    ...(lieu ? { lieu } : {}),
    ...(mise !== undefined ? { miseParJoueur: mise } : {}),
  };
}

/** Les valeurs diffèrent-elles de celles d'origine ? (pour proposer d'y revenir) */
export function defautsPersonnalises(d: DefautsConcours): boolean {
  return (
    d.nbTerrains !== DEFAUTS_ORIGINE.nbTerrains ||
    d.scoreMax !== DEFAUTS_ORIGINE.scoreMax ||
    d.consolante !== DEFAUTS_ORIGINE.consolante ||
    d.planTerrains !== DEFAUTS_ORIGINE.planTerrains ||
    d.lieu !== undefined ||
    d.miseParJoueur !== undefined
  );
}
