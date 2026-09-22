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
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateWithMock } from "../../../packages/backends/dist/index.js";
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
  chance: number;
  lift_over_chance: number;
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

function scoreRow(
  questions: Record<string, Question>,
  expected: Record<string, string | number | boolean>,
  response: SystemOneResponse,
): { ok: boolean; detail?: { expected: unknown; got: unknown } } {
  for (const [qName, gold] of Object.entries(expected)) {
    const q = questions[qName];
    const ans = response.answers[qName];
    if (!q || !ans) return { ok: false, detail: { expected: gold, got: null } };

    if (q.type === "choice" && ans.type === "choice") {
      if (ans.choice !== String(gold)) {
        return { ok: false, detail: { expected: gold, got: ans.choice } };
      }
    } else if (q.type === "score" && ans.type === "score") {
      // Match OpenJev-style hard label: nearest level / argmax of distribution
      let best = "0";
      let bestP = -1;
      for (const [k, p] of Object.entries(ans.probabilities)) {
        if (p > bestP) {
          bestP = p;
          best = k;
        }
      }
      if (Number(best) !== Number(gold)) {
        return { ok: false, detail: { expected: gold, got: Number(best) } };
      }
    } else if (q.type === "noul" && ans.type === "noul") {
      const wantToxic = Boolean(gold);
      const predToxic = ans.noul >= 0.5;
      if (wantToxic !== predToxic) {
        return { ok: false, detail: { expected: gold, got: ans.noul } };
      }
    } else {
      return { ok: false, detail: { expected: gold, got: ans } };
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
    return client.systemOne({ state, questions });
  }
  return evaluateWithMock({
    model: "kev-mock",
    state,
    questions,
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
  const failures_sample: TaskReport["failures_sample"] = [];

  for (const row of rows) {
    const response = await evaluateOne(args, row.state, questions);
    const scored = scoreRow(questions, row.answers, response);
    if (scored.ok) correct += 1;
    else if (failures_sample.length < 5 && scored.detail) {
      failures_sample.push({
        state: row.state.slice(0, 120),
        expected: scored.detail.expected,
        got: scored.detail.got,
      });
    }
  }

  const n = rows.length;
  const accuracy = n ? correct / n : 0;
  const chance = chanceRate(questions);
  const q0 = Object.values(questions)[0]!;

  return {
    task: taskName,
    primitive: q0.type,
    n,
    correct,
    accuracy,
    chance,
    lift_over_chance: accuracy - chance,
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

  // Markdown summary for README pasting
  const md = [
    `# OpenJev held-out results (Kev)`,
    ``,
    `Suite: [s1lv3rj1nx/openjev-heldout](https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout)`,
    `Mode: **${args.mode}** · date: ${payload.date}`,
    ``,
    `| Task | Primitive | n | Kev accuracy | Chance | Lift |`,
    `| --- | --- | ---: | ---: | ---: | ---: |`,
    ...reports.map(
      (r) =>
        `| ${r.task} | ${r.primitive} | ${r.n} | ${(r.accuracy * 100).toFixed(1)}% | ${(r.chance * 100).toFixed(1)}% | ${(r.lift_over_chance * 100).toFixed(1)} pp |`,
    ),
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
