import type { Concours } from '@shared';
import { libelleTerrain } from '@shared';

/**
 * Désigne un terrain comme le concours le demande — « 5 » ou « D ».
 *
 * Les écrans qui montrent un terrain sont nombreux et souvent imbriqués : le
 * tableau des poules, l'affichage du boulodrome, la page publique, les
 * impressions, la notification d'appel. Plutôt que d'y faire descendre le
 * concours entier, une page le calcule une fois et transmet ce formateur.
 */
export type LibelleTerrain = (numero: number) => string;

export function formateurTerrain(
  c: Pick<Concours, 'libelleTerrains' | 'decalageTerrain'>,
): LibelleTerrain {
  return (numero) => libelleTerrain(numero, c.libelleTerrains, c.decalageTerrain);
}
