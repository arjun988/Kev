export type CalibrationProfile = {
  name: string;
  /** Softmax temperature for choice / score readout */
  readoutTemperature: number;
  /** Softmax temperature for noul (yes/no) */
  noulTemperature: number;
  /** Additive bias applied to the yes logit before noul softmax (usually 0) */
  noulBias: number;
  /** Clamp probabilities away from exact 0/1 for numerical stability */
  epsilon: number;
};

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  name: "default",
  readoutTemperature: 0.85,
  noulTemperature: 1.0,
  noulBias: 0,
  epsilon: 1e-9,
};

/** Built-in profiles; override via JSON files in models/calibration/. */
export const BUILTIN_PROFILES: Record<string, CalibrationProfile> = {
  default: DEFAULT_CALIBRATION,
  sharp: {
    name: "sharp",
    readoutTemperature: 0.5,
    noulTemperature: 0.7,
    noulBias: 0,
    epsilon: 1e-9,
  },
  soft: {
    name: "soft",
    readoutTemperature: 1.2,
    noulTemperature: 1.5,
    noulBias: 0,
    epsilon: 1e-9,
  },
};

export function resolveCalibrationProfile(
  nameOrProfile?: string | Partial<CalibrationProfile>,
): CalibrationProfile {
  if (!nameOrProfile) return DEFAULT_CALIBRATION;
  if (typeof nameOrProfile === "string") {
    const found = BUILTIN_PROFILES[nameOrProfile];
    if (!found) {
      throw new Error(
        `unknown calibration profile "${nameOrProfile}"; known: ${Object.keys(BUILTIN_PROFILES).join(", ")}`,
      );
    }
    return found;
  }
  const base =
    nameOrProfile.name && BUILTIN_PROFILES[nameOrProfile.name]
      ? BUILTIN_PROFILES[nameOrProfile.name]!
      : DEFAULT_CALIBRATION;
  return {
    ...base,
    ...nameOrProfile,
    name: nameOrProfile.name ?? base.name,
  };
}

/**
 * Softmax over raw scores with temperature.
 * Higher temperature → flatter distribution.
 */
export function softmax(
  scores: Record<string, number>,
  temperature: number,
  epsilon = 1e-9,
): Record<string, number> {
  const keys = Object.keys(scores);
  if (keys.length === 0) return {};
  const t = Math.max(temperature, 1e-6);
  const values = keys.map((k) => scores[k]!);
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (let i = 0; i < keys.length; i++) {
    const p = exps[i]! / sum;
    out[keys[i]!] = Math.min(1 - epsilon, Math.max(epsilon, p));
  }
  // Renormalize after clamping
  const norm = Object.values(out).reduce((a, b) => a + b, 0);
  for (const k of keys) {
    out[k] = out[k]! / norm;
  }
  return out;
}

/**
 * Confidence from distribution concentration.
 * Mass on one option → ~1; uniform → ~0.
 * Uses normalized entropy relative to log(|options|).
 */
export function confidenceFromDistribution(
  probabilities: Record<string, number>,
): number {
  const values = Object.values(probabilities);
  const n = values.length;
  if (n <= 1) return 1;
  const entropy = -values.reduce((acc, p) => {
    if (p <= 0) return acc;
    return acc + p * Math.log(p);
  }, 0);
  const maxEntropy = Math.log(n);
  if (maxEntropy <= 0) return 1;
  const normalized = entropy / maxEntropy;
  return Math.min(1, Math.max(0, 1 - normalized));
}

/** Probability-weighted mean of level indices for score answers. */
export function weightedScore(
  probabilities: Record<string, number>,
): number {
  let sum = 0;
  for (const [key, p] of Object.entries(probabilities)) {
    sum += Number(key) * p;
  }
  return sum;
}

export function pickArgmax(probabilities: Record<string, number>): string {
  let bestKey = "";
  let best = -Infinity;
  for (const [k, v] of Object.entries(probabilities)) {
    if (v > best) {
      best = v;
      bestKey = k;
    }
  }
  return bestKey;
}
