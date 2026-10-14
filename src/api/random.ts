/**
 * Small random helpers built on any `() => number` source in [0, 1).
 *
 * Seed data uses a seeded generator so every run (and the demo video) shows
 * the same deals; runtime behaviour such as failures and teammate activity
 * uses `Math.random`.
 */

export type RandomSource = () => number;

/**
 * Mulberry32: a tiny, fast, seedable PRNG. Plenty for fake data.
 * https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] (inclusive). */
export function randomInt(random: RandomSource, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pickOne<T>(random: RandomSource, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

/** Picks an item using relative weights, e.g. `[['a', 3], ['b', 1]]` → 'a' 75% of the time. */
export function pickWeighted<T>(random: RandomSource, weighted: readonly (readonly [T, number])[]): T {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [item, weight] of weighted) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return weighted[weighted.length - 1][0];
}
