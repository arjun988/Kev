#!/usr/bin/env node
import { Choice, KevClient, KevError, Noul, Score } from "@kev-ai/sdk";
import { runDataset, runStabilitySuite } from "@kev-ai/eval";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Args = {
  _: string[];
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  state?: string;
  file?: string;
  dataset?: string;
  mode?: string;
  trials?: number;
  trace?: boolean;
  help?: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--trace") out.trace = true;
    else if (a === "--base-url" || a === "-u") out.baseUrl = argv[++i];
    else if (a === "--api-key" || a === "-k") out.apiKey = argv[++i];
    else if (a === "--model" || a === "-m") out.model = argv[++i];
    else if (a === "--state" || a === "-s") out.state = argv[++i];
    else if (a === "--file" || a === "-f") out.file = argv[++i];
    else if (a === "--dataset" || a === "-d") out.dataset = argv[++i];
    else if (a === "--mode") out.mode = argv[++i];
    else if (a === "--trials") out.trials = Number(argv[++i]);
    else out._.push(a);
  }
  return out;
}

function printHelp(): void {
  console.log(`Kev CLI — open System One decisions

Usage:
  kev health [--base-url URL]
  kev ask --state "..." [--trace]
  kev ask --file request.json
  kev demo
  kev eval dataset [--dataset path] [--mode mock|api]
  kev eval stability [--trials N]

Environment:
  KEV_BASE_URL       Server URL (default http://127.0.0.1:3000)
  KEV_API_KEY        Optional bearer token
  KEV_MODEL          Default model id
`);
}

async function cmdHealth(args: Args): Promise<void> {
  const client = new KevClient({
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
  });
  console.log(JSON.stringify(await client.health(), null, 2));
}

async function cmdDemo(args: Args): Promise<void> {
  const client = new KevClient({
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    model: args.model,
  });
  const res = await client.systemOne({
    state:
      "Customer: I was charged twice for my order last week and nobody has replied. I am furious.",
    questions: {
      topic: Choice("Which team should handle this?", {
        billing: "charges, refunds, payments",
        shipping: "delivery and tracking",
        technical: "bugs and outages",
      }),
      severity: Score("How urgent is this?", [
        "can wait",
        "this week",
        "today",
        "right now",
      ]),
      escalate: Noul("Escalate to a human agent now?"),
    },
    trace: true,
  });
  console.log(JSON.stringify(res, null, 2));
}

async function cmdAsk(args: Args): Promise<void> {
  const client = new KevClient({
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    model: args.model,
  });

  if (args.file) {
    const raw = readFileSync(resolve(args.file), "utf8");
    const json = JSON.parse(raw) as {
      state: unknown;
      questions: Record<string, unknown>;
      model?: string;
      trace?: boolean;
    };
    const res = await client.systemOne({
      state: json.state as never,
      questions: json.questions as never,
      model: json.model ?? args.model,
      trace: json.trace ?? args.trace,
    });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (!args.state) {
    console.error("Provide --state or --file");
    process.exitCode = 1;
    return;
  }

  const res = await client.systemOne({
    state: args.state,
    questions: {
      topic: Choice("What is this about?", {
        billing: "money / charges",
        bug: "product broken",
        other: "something else",
      }),
      urgent: Noul("Needs immediate attention?"),
    },
    trace: args.trace,
  });
  console.log(JSON.stringify(res, null, 2));
}

async function cmdEval(args: Args): Promise<void> {
  const sub = args._[1];
  if (sub === "stability") {
    const report = await runStabilitySuite(args.trials ?? 20);
    console.log(JSON.stringify(report, null, 2));
    if (report.mockHeuristic.flipRate > 0.05) process.exitCode = 1;
    return;
  }
  if (sub === "dataset" || !sub) {
    const here = dirname(fileURLToPath(import.meta.url));
    const fallback = resolve(here, "../../eval/fixtures/routing.json");
    const report = await runDataset({
      path: args.dataset ?? fallback,
      mode: args.mode === "api" ? "api" : "mock",
      baseUrl: args.baseUrl,
      apiKey: args.apiKey,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.accuracy < 1) process.exitCode = 1;
    return;
  }
  console.error(`Unknown eval subcommand: ${sub}`);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const [cmd] = args._;

  if (args.help || !cmd) {
    printHelp();
    return;
  }

  try {
    switch (cmd) {
      case "health":
        await cmdHealth(args);
        break;
      case "demo":
        await cmdDemo(args);
        break;
      case "ask":
        await cmdAsk(args);
        break;
      case "eval":
        await cmdEval(args);
        break;
      default:
        console.error(`Unknown command: ${cmd}`);
        printHelp();
        process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof KevError) {
      console.error(`Error (${err.status ?? "?"}): ${err.message}`);
      if (err.body) console.error(JSON.stringify(err.body, null, 2));
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

main();
