import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runStabilitySuite } from "./stability-suite.js";
import { runDataset } from "./harness.js";
import { runAgreementSuite } from "./agreement-suite.js";
import { runMultiQSuite } from "./multiq-suite.js";
import {
  klDivergence,
  percentile,
  summarizeLatencies,
} from "./metrics.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

describe("stability suite", () => {
  it("keeps flip rate low on billing routing", async () => {
    const report = await runStabilitySuite(12);
    assert.ok(report.mockHeuristic.flipRate <= 0.05);
    assert.equal(report.mockHeuristic.majorityChoice, "billing");
  });
});

describe("routing dataset", () => {
  it("scores high on fixture with mock", async () => {
    const report = await runDataset({
      path: resolve(here, "../fixtures/routing.json"),
      mode: "mock",
    });
    assert.ok(report.accuracy >= 0.8);
  });
});

describe("metrics", () => {
  it("computes percentiles", () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(percentile(s, 50), 5.5);
    assert.ok(Math.abs(percentile(s, 95) - 9.55) < 0.01);
  });

  it("summarizes latencies", () => {
    const summary = summarizeLatencies([10, 20, 30, 40, 50]);
    assert.equal(summary.n, 5);
    assert.equal(summary.p50_ms, 30);
    assert.ok(summary.p95_ms >= 48);
  });

  it("kl is zero for identical dists", () => {
    const d = { a: 0.5, b: 0.5 };
    assert.ok(klDivergence(d, d) < 1e-9);
  });
});

describe("agreement suite", () => {
  it("is deterministic on mock (zero flip, zero parse fail)", async () => {
    const report = await runAgreementSuite({ mode: "mock", trials: 8 });
    assert.equal(report.parse_fail_rate, 0);
    assert.equal(report.mean_flip_rate, 0);
    assert.ok(report.latency.n === 8);
  });
});

describe("multiq suite", () => {
  it("scales 1→15 without parse failures on mock", async () => {
    const report = await runMultiQSuite({
      mode: "mock",
      trialsPerCount: 2,
      counts: [1, 5, 10, 15],
    });
    assert.equal(report.points.length, 4);
    for (const p of report.points) {
      assert.equal(p.parse_fail_rate, 0);
      assert.equal(p.question_names.length, p.question_count);
    }
    assert.equal(report.latency_ratio_vs_1["1"], 1);
  });
});
