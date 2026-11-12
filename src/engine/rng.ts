/**
 * Deterministic RNG (mulberry32). The live state lives inside SimState so
 * replays with the same seed are bit-identical. Engine code must NEVER call
 * Math.random.
 */

/** Returns a uniform float in [0, 1) and advances `state`. */
export function rand(state: { seed: number }): number {
  let t = (state.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform float in [min, max). */
export function randRange(state: { seed: number }, min: number, max: number): number {
  return min + rand(state) * (max - min);
}

/** Pick an integer in [min, max] inclusive. */
export function randInt(state: { seed: number }, min: number, max: number): number {
  return Math.floor(randRange(state, min, max + 1));
}

/** Classic stand-alone mulberry32 generator (used for demo data seeding). */
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
