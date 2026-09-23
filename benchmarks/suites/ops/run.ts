/**
 * Ops / production-facing benches the Reddit critique asked for:
 * - p50 / p95 latency
 * - format hallucination (= parse-fail) rate
 * - probabilistic agreement (rerun drift)
 * - multi-question scaling (1 → 15 in one request)
 *
 *   pnpm bench:ops
 *   pnpm bench:ops -- --mode api --base-url http://127.0.0.1:3000
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAgreementSuite,
  runDataset,
  runMultiQSuite,
  runStabilitySuite,
} from "../../../packages/eval/dist/index.js";
import { summarizeLatencies } from "../../../packages/eval/dist/metrics.js";
import { evaluateWithMock } from "../../../packages/backends/dist/index.js";
import { KevClient } from "../../../packages/sdk-ts/dist/index.js";
import type { Question } from "../../../packages/schema/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));

type Args = {
  mode: "mock" | "api";
  baseUrl?: string;
  trials?: number;
  multiTrials?: number;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { mode: "mock" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--mode") out.mode = argv[++i] === "api" ? "api" : "mock";
    else if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--trials") out.trials = Number(argv[++i]);
    else if (a === "--multi-trials") out.multiTrials = Number(argv[++i]);
  }
  return out;
}

async function latencySmoke(
  mode: "mock" | "api",
  baseUrl: string | undefined,
  rounds: number,
): Promise<ReturnType<typeof summarizeLatencies>> {
  const state =
    "I was charged twice on my credit card invoice and want a refund now.";
  const questions: Record<string, Question> = {
    topic: {
      type: "choice",
      instructions: "Which team?",
      criteria: {
        billing: "charges and refunds",
        technical: "bugs and outages",
        shipping: "delivery",
      },
    },
    escalate: {
      type: "noul",
      instructions: "Escalate to a human?",
    },
  };

  const samples: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const started = Date.now();
    if (mode === "api") {
      const client = new KevClient({ baseUrl });
      const res = await client.systemOne({
        state,
        questions,
        trace: true,
        no_cache: true,
      });
      samples.push(
        typeof res.usage.latency_ms === "number"
          ? res.usage.latency_ms
          : Date.now() - started,
      );
    } else {
      const res = await evaluateWithMock({
        model: "kev-mock",
        state,
        questions,
        trace: true,
      });
      samples.push(
        typeof res.usage.latency_ms === "number"
          ? res.usage.latency_ms
          : Date.now() - started,
      );
    }
  }
  return summarizeLatencies(samples);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const trials = args.trials ?? (args.mode === "mock" ? 20 : 10);
  const multiTrials = args.multiTrials ?? (args.mode === "mock" ? 5 : 3);
  const fixture = resolve(here, "../../fixtures/routing-bench.json");

  process.stderr.write("ops: routing fixture…\n");
  const dataset = await runDataset({
    path: fixture,
    mode: args.mode,
    baseUrl: args.baseUrl,
  });

  process.stderr.write("ops: latency smoke…\n");
  const latency = await latencySmoke(args.mode, args.baseUrl, trials);

  process.stderr.write("ops: agreement…\n");
  const agreement = await runAgreementSuite({
    mode: args.mode,
    baseUrl: args.baseUrl,
    trials,
  });

  process.stderr.write("ops: multi-question scaling…\n");
  const multiq = await runMultiQSuite({
    mode: args.mode,
    baseUrl: args.baseUrl,
    trialsPerCount: multiTrials,
    counts: [1, 5, 10, 15],
  });

  process.stderr.write("ops: option-order stability…\n");
  const stability =
    args.mode === "mock"
      ? await runStabilitySuite(trials)
      : {
          note: "option-order stability suite currently uses mock heuristics; run `kev eval stability` on mock, or measure agreement for API drift",
          skipped: true as const,
        };

  const payload = {
    suite: "kev-ops-v1",
    date: new Date().toISOString(),
    mode: args.mode,
    base_url: args.baseUrl ?? null,
    metrics: {
      p50_ms: latency.p50_ms,
      p95_ms: latency.p95_ms,
      p99_ms: latency.p99_ms,
      mean_ms: latency.mean_ms,
      format_hallucination_rate: agreement.parse_fail_rate,
      parse_fail_rate: agreement.parse_fail_rate,
      probabilistic_agreement_mean_flip_rate: agreement.mean_flip_rate,
      probabilistic_agreement_mean_kl: agreement.mean_kl_to_mean,
      multiq_latency_ratio_vs_1: multiq.latency_ratio_vs_1,
      multiq_confidence_ratio_vs_1: multiq.confidence_ratio_vs_1,
      routing_fixture_accuracy: dataset.accuracy,
    },
    latency_smoke: latency,
    routing_fixture: dataset,
    agreement,
    multiq,
    stability,
  };

  console.log(JSON.stringify(payload, null, 2));

  const outDir = resolve(here, "../../out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "ops-latest.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );

  const md = [
    `# Kev ops results`,
    ``,
    `Mode: **${args.mode}** · date: ${payload.date}`,
    ``,
    `| Metric | Value |`,
    `| --- | ---: |`,
    `| p50 latency | ${latency.p50_ms} ms |`,
    `| p95 latency | ${latency.p95_ms} ms |`,
    `| p99 latency | ${latency.p99_ms} ms |`,
    `| Format hallucination / parse-fail | ${(agreement.parse_fail_rate * 100).toFixed(2)}% |`,
    `| Probabilistic agreement (mean flip) | ${(agreement.mean_flip_rate * 100).toFixed(2)}% |`,
    `| Probabilistic agreement (mean KL) | ${agreement.mean_kl_to_mean} |`,
    `| Routing fixture accuracy | ${(dataset.accuracy * 100).toFixed(1)}% |`,
    ``,
    `## Multi-question scaling (one request)`,
    ``,
    `| # questions | p50 ms | p95 ms | mean confidence | parse-fail | latency × vs 1 |`,
    `| ---: | ---: | ---: | ---: | ---: | ---: |`,
    ...multiq.points.map(
      (p) =>
        `| ${p.question_count} | ${p.latency.p50_ms} | ${p.latency.p95_ms} | ${p.mean_confidence} | ${(p.parse_fail_rate * 100).toFixed(2)}% | ${multiq.latency_ratio_vs_1[String(p.question_count)]} |`,
    ),
    ``,
  ].join("\n");
  writeFileSync(join(outDir, "ops-latest.md"), md);
  process.stderr.write(md);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
