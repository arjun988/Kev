/**
 * Convert + evaluate the public OpenJev held-out suite
 * (https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout)
 *
 * Same tasks Jev / OpenJev cite for generalization:
 * banking77, clinc_oos, massive_intent, sst5, ag_news, civil_comments_toxicity, …
 *
 *   pnpm exec tsx benchmarks/suites/openjev-heldout/run.ts
 *   pnpm exec tsx benchmarks/suites/openjev-heldout/run.ts --tasks banking77,ag_news
 *   pnpm exec tsx benchmarks/suites/openjev-heldout/run.ts --mode api --base-url http://127.0.0.1:3000
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateWithMock } from "../../../packages/backends/dist/index.js";
import {
  bumpStrategy,
  round4,
  summarizeLatencies,
  type LatencySummary,
  type StrategyCounts,
} from "../../../packages/eval/dist/metrics.js";
import { KevClient } from "../../../packages/sdk-ts/dist/index.js";
import type { Question, SystemOneResponse } from "../../../packages/schema/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const rawRoot = resolve(here, "raw");

type TaskFile = {
  name: string;
  description?: string;
  questions: Record<
    string,
    {
      type?: "choice" | "score" | "noul";
      instructions: string;
      criteria: Record<string, string | null> | string[];
    }
  >;
};

type Row = {
  state: string;
  answers: Record<string, string | number | boolean>;
  meta?: Record<string, unknown>;
};

type TaskReport = {
  task: string;
  primitive: string;
  n: number;
  correct: number;
  accuracy: number;
  /** Exact-match for score; same as accuracy for choice/noul */
  accuracy_exact?: number;
  /** Ordinal within-1 (|pred-gold|≤1). Only set for score tasks. */
  accuracy_within1?: number;
  correct_within1?: number;
  chance: number;
  lift_over_chance: number;
  /** First-shot structure failures (missing answer, invented label, request error) */
  parse_fails: number;
  parse_fail_rate: number;
  /** Format hallucination rate ≡ parse_fail_rate for System One */
  format_hallucination_rate: number;
  latency: LatencySummary;
  strategy_counts: StrategyCounts;
  failures_sample: Array<{ state: string; expected: unknown; got: unknown }>;
};

function loadJsonl(path: string): Row[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row);
}

function toQuestions(task: TaskFile): Record<string, Question> {
  const out: Record<string, Question> = {};
  for (const [name, q] of Object.entries(task.questions)) {
    if (Array.isArray(q.criteria)) {
      out[name] = {
        type: "score",
        instructions: q.instructions,
        criteria: q.criteria,
      };
    } else if (q.type === "noul" || ("true" in q.criteria && "false" in q.criteria)) {
      out[name] = {
        type: "noul",
        instructions: q.instructions,
        criteria: {
          true: String(q.criteria.true ?? "yes"),
          false: String(q.criteria.false ?? "no"),
        },
      };
    } else {
      out[name] = {
        type: "choice",
        instructions: q.instructions,
        criteria: q.criteria as Record<string, string | null>,
      };
    }
  }
  return out;
}

function argmaxScoreLevel(
  probabilities: Record<string, number>,
): number {
  let best = "0";
  let bestP = -1;
  for (const [k, p] of Object.entries(probabilities)) {
    if (p > bestP) {
      bestP = p;
      best = k;
    }
  }
  return Number(best);
}

function scoreRow(
  questions: Record<string, Question>,
  expected: Record<string, string | number | boolean>,
  response: SystemOneResponse,
): {
  exact: boolean;
  within1: boolean;
  detail?: { expected: unknown; got: unknown };
} {
  let exact = true;
  let within1 = true;
  let detail: { expected: unknown; got: unknown } | undefined;

  for (const [qName, gold] of Object.entries(expected)) {
    const q = questions[qName];
    const ans = response.answers[qName];
    if (!q || !ans) {
      return { exact: false, within1: false, detail: { expected: gold, got: null } };
    }

    if (q.type === "choice" && ans.type === "choice") {
      const ok = ans.choice === String(gold);
      if (!ok) {
        exact = false;
        within1 = false;
        detail ??= { expected: gold, got: ans.choice };
      }
    } else if (q.type === "score" && ans.type === "score") {
      const pred = argmaxScoreLevel(ans.probabilities);
      const g = Number(gold);
      if (pred !== g) {
        exact = false;
        detail ??= { expected: gold, got: pred };
      }
      if (Math.abs(pred - g) > 1) {
        within1 = false;
      }
    } else if (q.type === "noul" && ans.type === "noul") {
      const wantToxic = Boolean(gold);
      const predToxic = ans.noul >= 0.5;
      const ok = wantToxic === predToxic;
      if (!ok) {
        exact = false;
        within1 = false;
        detail ??= { expected: gold, got: ans.noul };
      }
    } else {
      return { exact: false, within1: false, detail: { expected: gold, got: ans } };
    }
  }
  return { exact, within1, detail };
}

/** Structure / format validity — independent of label correctness. */
function checkParseable(
  questions: Record<string, Question>,
  response: SystemOneResponse,
): { ok: boolean; reason?: string } {
  for (const [name, q] of Object.entries(questions)) {
    const ans = response.answers[name];
    if (!ans) return { ok: false, reason: `missing:${name}` };
    if (ans.type !== q.type) return { ok: false, reason: `type_mismatch:${name}` };
    if (ans.type === "choice" && q.type === "choice") {
      if (!(ans.choice in q.criteria)) {
        return { ok: false, reason: `invented_choice:${name}:${ans.choice}` };
      }
      for (const k of Object.keys(q.criteria)) {
        if (typeof ans.probabilities[k] !== "number") {
          return { ok: false, reason: `missing_prob:${name}:${k}` };
        }
      }
    }
    if (ans.type === "score" && q.type === "score") {
      for (let i = 0; i < q.criteria.length; i++) {
        if (typeof ans.probabilities[String(i)] !== "number") {
          return { ok: false, reason: `missing_score_prob:${name}:${i}` };
        }
      }
    }
    if (ans.type === "noul") {
      if (!Number.isFinite(ans.noul) || ans.noul < 0 || ans.noul > 1) {
        return { ok: false, reason: `bad_noul:${name}` };
      }
    }
  }
  return { ok: true };
}

function chanceRate(questions: Record<string, Question>): number {
  const q = Object.values(questions)[0];
  if (!q) return 0;
  if (q.type === "choice") return 1 / Object.keys(q.criteria).length;
  if (q.type === "score") return 1 / q.criteria.length;
  return 0.5;
}

type Args = {
  mode: "mock" | "api";
  baseUrl?: string;
  tasks?: string[];
  limit?: number;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { mode: "mock" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--mode") out.mode = argv[++i] === "api" ? "api" : "mock";
    else if (a === "--base-url") out.baseUrl = argv[++i];
    else if (a === "--tasks") out.tasks = argv[++i]!.split(",").map((s) => s.trim());
    else if (a === "--limit") out.limit = Number(argv[++i]);
  }
  return out;
}

async function evaluateOne(
  args: Args,
  state: string,
  questions: Record<string, Question>,
): Promise<SystemOneResponse> {
  if (args.mode === "api") {
    const client = new KevClient({ baseUrl: args.baseUrl });
    return client.systemOne({ state, questions, trace: true });
  }
  return evaluateWithMock({
    model: "kev-mock",
    state,
    questions,
    trace: true,
  });
}

async function runTask(taskName: string, args: Args): Promise<TaskReport> {
  const taskPath = join(rawRoot, taskName, "task.json");
  const dataPath = join(rawRoot, taskName, "test.jsonl");
  if (!existsSync(taskPath) || !existsSync(dataPath)) {
    throw new Error(`Missing raw files for ${taskName}. Download first (see README).`);
  }
  const task = JSON.parse(readFileSync(taskPath, "utf8")) as TaskFile;
  const questions = toQuestions(task);
  let rows = loadJsonl(dataPath);
  if (args.limit && args.limit > 0) rows = rows.slice(0, args.limit);

  let correct = 0;
  let correctWithin1 = 0;
  let parseFails = 0;
  const wallMs: number[] = [];
  const serverMs: number[] = [];
  const strategy_counts: StrategyCounts = {};
  const failures_sample: TaskReport["failures_sample"] = [];

  for (const row of rows) {
    const started = Date.now();
    try {
      const response = await evaluateOne(args, row.state, questions);
      wallMs.push(Date.now() - started);
      if (typeof response.usage.latency_ms === "number") {
        serverMs.push(response.usage.latency_ms);
      }

      const parsed = checkParseable(questions, response);
      if (!parsed.ok) {
        parseFails += 1;
        if (failures_sample.length < 5) {
          failures_sample.push({
            state: row.state.slice(0, 120),
            expected: row.answers,
            got: parsed.reason ?? "parse_fail",
          });
        }
      } else {
        const scored = scoreRow(questions, row.answers, response);
        if (scored.exact) correct += 1;
        if (scored.within1) correctWithin1 += 1;
        if (!scored.exact && failures_sample.length < 5 && scored.detail) {
          failures_sample.push({
            state: row.state.slice(0, 120),
            expected: scored.detail.expected,
            got: scored.detail.got,
          });
        }
      }

      if (response.trace) {
        for (const tr of Object.values(response.trace)) {
          bumpStrategy(strategy_counts, tr.strategy);
        }
      } else {
        bumpStrategy(strategy_counts, args.mode === "mock" ? "mock" : "unknown");
      }
    } catch (err) {
      wallMs.push(Date.now() - started);
      parseFails += 1;
      if (failures_sample.length < 5) {
        failures_sample.push({
          state: row.state.slice(0, 120),
          expected: row.answers,
          got: err instanceof Error ? err.message : "request_error",
        });
      }
    }
  }

  const n = rows.length;
  const accuracy = n ? correct / n : 0;
  const chance = chanceRate(questions);
  const q0 = Object.values(questions)[0]!;
  const isScore = q0.type === "score";
  const within1Acc = n ? correctWithin1 / n : 0;
  const parse_fail_rate = n ? round4(parseFails / n) : 0;
  const latencySamples = serverMs.length ? serverMs : wallMs;

  return {
    task: taskName,
    primitive: q0.type,
    n,
    correct,
    accuracy,
    ...(isScore
      ? {
          accuracy_exact: accuracy,
          accuracy_within1: within1Acc,
          correct_within1: correctWithin1,
        }
      : {}),
    chance,
    lift_over_chance: accuracy - chance,
    parse_fails: parseFails,
    parse_fail_rate,
    format_hallucination_rate: parse_fail_rate,
    latency: summarizeLatencies(latencySamples),
    strategy_counts,
    failures_sample,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const allTasks = [
    "ag_news",
    "banking77",
    "civil_comments_toxicity",
    "clinc_oos",
    "massive_intent",
    "sst5",
  ].filter((t) => existsSync(join(rawRoot, t, "test.jsonl")));

  const tasks = args.tasks?.length
    ? args.tasks.filter((t) => allTasks.includes(t))
    : allTasks;

  if (tasks.length === 0) {
    console.error("No tasks found under raw/. Run the download step in README.");
    process.exit(1);
  }

  const started = Date.now();
  const reports: TaskReport[] = [];
  for (const t of tasks) {
    process.stderr.write(`running ${t}…\n`);
    reports.push(await runTask(t, args));
  }

  const totalCorrect = reports.reduce((a, r) => a + r.correct, 0);
  const totalN = reports.reduce((a, r) => a + r.n, 0);
  const totalParseFails = reports.reduce((a, r) => a + r.parse_fails, 0);
  const allLatencies = reports.flatMap((r) => {
    // Reconstruct approximate samples is hard; combine per-task summaries via weighted mean of p50/p95 later
    return [] as number[];
  });
  void allLatencies;

  // Aggregate latency: recompute from per-task means is lossy — publish per-task + micro parse rate
  const strategy_counts: StrategyCounts = {};
  for (const r of reports) {
    for (const [k, v] of Object.entries(r.strategy_counts)) {
      strategy_counts[k] = (strategy_counts[k] ?? 0) + v;
    }
  }

  const payload = {
    suite: "openjev-heldout-v1",
    source: "https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout",
    date: new Date().toISOString(),
    mode: args.mode,
    base_url: args.baseUrl ?? null,
    latency_ms_wall: Date.now() - started,
    micro_accuracy: totalN ? totalCorrect / totalN : 0,
    total_correct: totalCorrect,
    total_n: totalN,
    parse_fails: totalParseFails,
    parse_fail_rate: totalN ? round4(totalParseFails / totalN) : 0,
    format_hallucination_rate: totalN ? round4(totalParseFails / totalN) : 0,
    strategy_counts,
    tasks: reports,
    reference_published: {
      note: "Published by others on related splits — not our run. Cited for context.",
      openjev_10k_text: {
        jev_hosted: 0.854,
        openjev: 0.84,
        source: "https://huggingface.co/openjev/openjev",
      },
      banking77: {
        jevbench_full_test_n3080_jev_1_13: 0.803,
        openjev_heldout_note: "Jev ~0.820 on a 300-row subset of this sample (task.json)",
        source: "https://jevbench.xyz/methodology",
      },
    },
  };

  console.log(JSON.stringify(payload, null, 2));

  const outDir = resolve(here, "../../out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "openjev-heldout-latest.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );

  const md = [
    `# OpenJev held-out results (Kev)`,
    ``,
    `Suite: [s1lv3rj1nx/openjev-heldout](https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout)`,
    `Mode: **${args.mode}** · date: ${payload.date}`,
    `Parse-fail / format-hallucination: **${(payload.parse_fail_rate * 100).toFixed(2)}%** (${totalParseFails}/${totalN})`,
    `Strategies: \`${JSON.stringify(strategy_counts)}\``,
    ``,
    `| Task | Primitive | n | Exact | Within-1 | Parse-fail | p50 ms | p95 ms | Chance |`,
    `| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
    ...reports.map((r) => {
      const exact = `${(r.accuracy * 100).toFixed(1)}%`;
      const w1 =
        r.accuracy_within1 != null
          ? `${(r.accuracy_within1 * 100).toFixed(1)}%`
          : "—";
      return `| ${r.task} | ${r.primitive} | ${r.n} | ${exact} | ${w1} | ${(r.parse_fail_rate * 100).toFixed(2)}% | ${r.latency.p50_ms} | ${r.latency.p95_ms} | ${(r.chance * 100).toFixed(1)}% |`;
    }),
    ``,
    `**Micro-average:** ${(payload.micro_accuracy * 100).toFixed(1)}% (${totalCorrect}/${totalN})`,
    ``,
  ].join("\n");
  writeFileSync(join(outDir, "openjev-heldout-latest.md"), md);
  process.stderr.write(md);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
