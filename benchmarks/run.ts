/**
 * Reproducible benchmark runner.
 *
 *   pnpm bench
 *   pnpm exec tsx benchmarks/run.ts --mode api --base-url http://127.0.0.1:3000
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDataset } from "../packages/eval/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));

type Args = {
  mode: "mock" | "api";
  baseUrl?: string;
  threshold: number;
  out?: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { mode: "mock", threshold: 0.75 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--mode") out.mode = argv[++i] === "api" ? "api" : "mock";
    else if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--threshold") out.threshold = Number(argv[++i]);
    else if (a === "--out") out.out = argv[++i];
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const fixture = resolve(here, "fixtures/routing-bench.json");
  const started = Date.now();
  const report = await runDataset({
    path: fixture,
    mode: args.mode,
    baseUrl: args.baseUrl,
  });
  const payload = {
    date: new Date().toISOString(),
    fixture: "benchmarks/fixtures/routing-bench.json",
    mode: args.mode,
    base_url: args.baseUrl ?? null,
    latency_ms_wall: Date.now() - started,
    ...report,
  };

  console.log(JSON.stringify(payload, null, 2));

  const outPath = args.out ?? resolve(here, "out/latest.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (report.accuracy < args.threshold) {
    console.error(
      `accuracy ${report.accuracy.toFixed(3)} < threshold ${args.threshold}`,
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
