#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runDataset } from "./harness.js";
import { runStabilitySuite } from "./stability-suite.js";
import { runAgreementSuite } from "./agreement-suite.js";
import { runMultiQSuite } from "./multiq-suite.js";

const here = dirname(fileURLToPath(import.meta.url));

type Args = {
  _: string[];
  dataset?: string;
  mode?: string;
  baseUrl?: string;
  trials?: number;
  multiTrials?: number;
  help?: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--dataset" || a === "-d") out.dataset = argv[++i];
    else if (a === "--mode") out.mode = argv[++i];
    else if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--trials") out.trials = Number(argv[++i]);
    else if (a === "--multi-trials") out.multiTrials = Number(argv[++i]);
    else out._.push(a);
  }
  return out;
}

function help(): void {
  console.log(`kev-eval — evaluation harness

Usage:
  kev-eval dataset [--dataset path] [--mode mock|api]
  kev-eval stability [--trials N]
  kev-eval agreement [--trials N] [--mode mock|api] [--base-url URL]
  kev-eval multiq [--multi-trials N] [--mode mock|api] [--base-url URL]

Defaults:
  dataset → packages/eval/fixtures/routing.json (from package) or fixtures/routing.json
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const [cmd] = args._;
  if (args.help || !cmd) {
    help();
    return;
  }

  if (cmd === "dataset") {
    const defaultPath = resolve(here, "../fixtures/routing.json");
    const report = await runDataset({
      path: args.dataset ?? defaultPath,
      mode: args.mode === "api" ? "api" : "mock",
      baseUrl: args.baseUrl,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.accuracy < 1) process.exitCode = 1;
    return;
  }

  if (cmd === "stability") {
    const report = await runStabilitySuite(args.trials ?? 20);
    console.log(JSON.stringify(report, null, 2));
    if (report.mockHeuristic.flipRate > 0.05) process.exitCode = 1;
    return;
  }

  if (cmd === "agreement") {
    const report = await runAgreementSuite({
      trials: args.trials ?? 20,
      mode: args.mode === "api" ? "api" : "mock",
      baseUrl: args.baseUrl,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.parse_fail_rate > 0 || report.mean_flip_rate > 0.05) {
      process.exitCode = 1;
    }
    return;
  }

  if (cmd === "multiq") {
    const report = await runMultiQSuite({
      mode: args.mode === "api" ? "api" : "mock",
      baseUrl: args.baseUrl,
      trialsPerCount: args.multiTrials ?? args.trials ?? 5,
    });
    console.log(JSON.stringify(report, null, 2));
    const anyFail = report.points.some((p) => p.parse_fail_rate > 0);
    if (anyFail) process.exitCode = 1;
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  help();
  process.exitCode = 1;
}

main();
