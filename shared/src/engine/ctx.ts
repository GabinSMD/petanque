/**
 * Contexte injectable du moteur : générateur aléatoire, identifiants,
 * horloge. Permet des tirages reproductibles en test et l'exécution
 * indifféremment côté navigateur ou Node.
 */
export interface EngineCtx {
  rng: () => number;
  newId: () => string;
  now: () => string;
}

/** PRNG déterministe (mulberry32) pour les tests et tirages rejouables. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `crypto.randomUUID` existe côté navigateur comme côté Node ≥ 19. */
declare const crypto: { randomUUID(): string };

export function defaultCtx(seed?: number): EngineCtx {
  return {
    rng: seed === undefined ? Math.random : mulberry32(seed),
    newId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  };
}

/** Mélange de Fisher-Yates, sans mutation de l'entrée. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** Intercale `inserts` régulièrement dans `main` (répartition des exempts). */
export function spreadEvenly<T>(main: readonly T[], inserts: readonly T[]): T[] {
  const total = main.length + inserts.length;
  const out: T[] = [];
  let mi = 0;
  let ii = 0;
  for (let p = 0; p < total; p++) {
    const insertTarget = ((p + 1) * inserts.length) / total;
    if (ii < inserts.length && insertTarget >= ii + 1) {
      out.push(inserts[ii++]!);
    } else if (mi < main.length) {
      out.push(main[mi++]!);
    } else {
      out.push(inserts[ii++]!);
    }
  }
  return out;
}
