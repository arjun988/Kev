import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confidenceFromDistribution,
  softmax,
  weightedScore,
} from "./calibration.js";

describe("softmax", () => {
  it("sums to ~1", () => {
    const p = softmax({ a: 1, b: 2, c: 0.5 }, 1);
    const sum = Object.values(p).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.ok(p.b! > p.a!);
  });
});

describe("confidenceFromDistribution", () => {
  it("is high when peaked", () => {
    const c = confidenceFromDistribution({ a: 0.98, b: 0.01, c: 0.01 });
    assert.ok(c > 0.8);
  });

  it("is low when uniform", () => {
    const c = confidenceFromDistribution({ a: 0.5, b: 0.5 });
    assert.ok(c < 0.2);
  });
});

describe("weightedScore", () => {
  it("computes expected level", () => {
    const s = weightedScore({ "0": 0, "1": 0.7, "2": 0.3 });
    assert.ok(Math.abs(s - 1.3) < 1e-9);
  });
});
