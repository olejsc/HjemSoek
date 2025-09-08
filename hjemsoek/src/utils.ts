/* Pure helpers (rounding, clamping, weights)
 * Extracted from the monolithic source.
 */

/** Round to `p` decimal places (default 1). */
export const round = (n: number, p: number = 1): number => (Number.isFinite(n) ? Math.round(n * Math.pow(10, p)) / Math.pow(10, p) : 0);
/** Clamp x to [lo, hi]. */
export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
/** Clamp to [0,1]. */
export const clamp01 = (x: number): number => clamp(x, 0, 1);
/** Sum an array of numbers. */
export const sum = (arr: number[]): number => arr.reduce((s, x) => s + x, 0);

/** Normalize a dictionary of weights over the provided keys (Σ=1, or uniform if all zeros). */
export function normalizeWeights(weights: Record<string, number | undefined>, keys: string[]): Record<string, number> {
  const total = sum(keys.map((k) => weights[k] ?? 0));
  if (total <= 0) {
    const uniform = 1 / Math.max(1, keys.length);
    return Object.fromEntries(keys.map((k) => [k, uniform]));
  }
  return Object.fromEntries(keys.map((k) => [k, (weights[k] ?? 0) / total]));
}
