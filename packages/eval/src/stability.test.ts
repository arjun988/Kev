import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runStabilitySuite } from "./stability-suite.js";
import { runDataset } from "./harness.js";
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
