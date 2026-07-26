import type { FaqEntry } from './faq';

/** Minuscules, sans accents ni ponctuation. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'comment', 'faire', 'est', 'ce', 'que', 'quoi', 'pour', 'les', 'des', 'une', 'un',
  'le', 'la', 'de', 'du', 'je', 'on', 'peut', 'mon', 'ma', 'mes', 'dans', 'sur',
  'avec', 'sans', 'qui', 'quand', 'ou', 'et', 'a', 'au', 'aux', 'veux', 'voudrais',
]);

export interface FaqMatch {
  entry: FaqEntry;
  score: number;
}

/**
 * Recherche par mots-clés pondérés : suffisant pour un guide hors-ligne,
 * tolérant aux accents et au vocabulaire approchant.
 */
export function searchFaq(query: string, entries: FaqEntry[]): FaqMatch[] {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const results: FaqMatch[] = [];
  for (const entry of entries) {
    let score = 0;
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      if (!k) continue;
      if (q.includes(k)) {
        score += k.length >= 6 ? 3 : 2;
      } else if (words.some((w) => k.startsWith(w) || w.startsWith(k))) {
        score += 1;
      }
    }
    const questionWords = new Set(normalize(entry.question).split(' '));
    for (const w of words) {
      if (questionWords.has(w)) score += 1;
    }
    if (score > 0) results.push({ entry, score });
  }
  return results.sort((a, b) => b.score - a.score);
}
