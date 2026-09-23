/** Shared stats for latency + probabilistic agreement benches. */

export type LatencySummary = {
  n: number;
  mean_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  min_ms: number;
  max_ms: number;
};

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo]!;
  const w = rank - lo;
  return sortedAsc[lo]! * (1 - w) + sortedAsc[hi]! * w;
}

export function summarizeLatencies(samplesMs: number[]): LatencySummary {
  const sorted = [...samplesMs].filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) {
    return {
      n: 0,
      mean_ms: 0,
      p50_ms: 0,
      p95_ms: 0,
      p99_ms: 0,
      min_ms: 0,
      max_ms: 0,
    };
  }
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  return {
    n,
    mean_ms: round1(mean),
    p50_ms: round1(percentile(sorted, 50)),
    p95_ms: round1(percentile(sorted, 95)),
    p99_ms: round1(percentile(sorted, 99)),
    min_ms: round1(sorted[0]!),
    max_ms: round1(sorted[n - 1]!),
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** KL(p || q) for discrete distributions over the same keys. */
export function klDivergence(
  p: Record<string, number>,
  q: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  let sum = 0;
  for (const k of keys) {
    const pk = Math.max(p[k] ?? 0, 1e-12);
    const qk = Math.max(q[k] ?? 0, 1e-12);
    sum += pk * Math.log(pk / qk);
  }
  return sum;
}

export function meanDistribution(
  dists: Array<Record<string, number>>,
): Record<string, number> {
  const acc: Record<string, number> = {};
  if (dists.length === 0) return acc;
  for (const d of dists) {
    for (const [k, v] of Object.entries(d)) {
      acc[k] = (acc[k] ?? 0) + v;
    }
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(acc)) {
    out[k] = v / dists.length;
  }
  return out;
}

export function maxProb(dist: Record<string, number>): number {
  let m = 0;
  for (const v of Object.values(dist)) if (v > m) m = v;
  return m;
}

export function argmaxKey(dist: Record<string, number>): string {
  let best = "";
  let bestP = -1;
  for (const [k, v] of Object.entries(dist)) {
    if (v > bestP) {
      bestP = v;
      best = k;
    }
  }
  return best;
}

export type StrategyCounts = Record<string, number>;

export function bumpStrategy(
  counts: StrategyCounts,
  strategy: string | undefined,
): void {
  const key = strategy ?? "unknown";
  counts[key] = (counts[key] ?? 0) + 1;
}
