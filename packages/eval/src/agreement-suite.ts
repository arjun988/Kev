import { evaluateWithMock } from "@kev-ai/backends";
import type { Question, SystemOneResponse } from "@kev-ai/schema";
import { KevClient } from "@kev-ai/sdk";
import {
  argmaxKey,
  klDivergence,
  maxProb,
  meanDistribution,
  round4,
  summarizeLatencies,
  type LatencySummary,
} from "./metrics.js";

export type AgreementMode = "mock" | "api";

export type AgreementQuestionReport = {
  question: string;
  type: string;
  /** 1 - majority_share of argmax / discrete label across trials */
  flip_rate: number;
  majority_label: string;
  majority_share: number;
  unique_labels: string[];
  /** Mean KL(trial || mean_distribution) — lower = more stable probs */
  mean_kl_to_mean: number;
  /** Max |max_prob_trial - max_prob_mean| across trials */
  max_prob_delta: number;
  /** Stdev of top-class probability across trials */
  top_prob_stdev: number;
};

export type AgreementReport = {
  suite: "probabilistic-agreement";
  mode: AgreementMode;
  trials: number;
  state_preview: string;
  latency: LatencySummary;
  parse_fail_rate: number;
  parse_fails: number;
  questions: AgreementQuestionReport[];
  /** Aggregate flip rate (mean across questions) */
  mean_flip_rate: number;
  /** Aggregate mean KL */
  mean_kl_to_mean: number;
};

const DEFAULT_STATE =
  "Customer: I was charged twice on my credit card invoice and want a refund. I am furious.";

const DEFAULT_QUESTIONS: Record<string, Question> = {
  topic: {
    type: "choice",
    instructions: "Which team should handle this?",
    criteria: {
      billing: "charges, refunds, payments, invoices",
      shipping: "delivery and tracking",
      technical: "bugs and outages",
    },
  },
  severity: {
    type: "score",
    instructions: "How urgent is this?",
    criteria: ["can wait", "this week", "today", "right now"],
  },
  escalate: {
    type: "noul",
    instructions: "Escalate to a human agent immediately?",
  },
};

function labelFromAnswer(
  ans: SystemOneResponse["answers"][string],
): { label: string; dist: Record<string, number> } | null {
  if (ans.type === "choice") {
    return { label: ans.choice, dist: { ...ans.probabilities } };
  }
  if (ans.type === "score") {
    return {
      label: String(argmaxKey(ans.probabilities)),
      dist: { ...ans.probabilities },
    };
  }
  if (ans.type === "noul") {
    const yes = ans.noul;
    const no = 1 - ans.noul;
    return {
      label: yes >= 0.5 ? "yes" : "no",
      dist: { yes, no },
    };
  }
  return null;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const varSum = values.reduce((a, v) => a + (v - mean) ** 2, 0);
  return Math.sqrt(varSum / (values.length - 1));
}

async function evaluateOnce(
  mode: AgreementMode,
  state: string,
  questions: Record<string, Question>,
  baseUrl?: string,
): Promise<SystemOneResponse> {
  if (mode === "api") {
    const client = new KevClient({ baseUrl });
    return client.systemOne({ state, questions, trace: true, no_cache: true });
  }
  return evaluateWithMock({
    model: "kev-mock",
    state,
    questions,
  });
}

/**
 * Re-run the same System One request N times (no option shuffle).
 * Measures how far probabilistic estimates drift across identical prompts.
 */
export async function runAgreementSuite(options: {
  trials?: number;
  mode?: AgreementMode;
  baseUrl?: string;
  state?: string;
  questions?: Record<string, Question>;
} = {}): Promise<AgreementReport> {
  const trials = options.trials ?? 20;
  const mode = options.mode ?? "mock";
  const state = options.state ?? DEFAULT_STATE;
  const questions = options.questions ?? DEFAULT_QUESTIONS;

  const wallMs: number[] = [];
  const serverMs: number[] = [];
  let parseFails = 0;

  type TrialQ = {
    labels: string[];
    dists: Array<Record<string, number>>;
    topProbs: number[];
  };
  const perQ: Record<string, TrialQ> = {};
  for (const name of Object.keys(questions)) {
    perQ[name] = { labels: [], dists: [], topProbs: [] };
  }

  for (let t = 0; t < trials; t++) {
    const started = Date.now();
    try {
      const res = await evaluateOnce(mode, state, questions, options.baseUrl);
      wallMs.push(Date.now() - started);
      if (typeof res.usage.latency_ms === "number") {
        serverMs.push(res.usage.latency_ms);
      }

      let rowOk = true;
      for (const [name, q] of Object.entries(questions)) {
        const ans = res.answers[name];
        if (!ans || ans.type !== q.type) {
          rowOk = false;
          continue;
        }
        if (ans.type === "choice" && q.type === "choice") {
          if (!(ans.choice in q.criteria)) rowOk = false;
        }
        const extracted = labelFromAnswer(ans);
        if (!extracted) {
          rowOk = false;
          continue;
        }
        perQ[name]!.labels.push(extracted.label);
        perQ[name]!.dists.push(extracted.dist);
        perQ[name]!.topProbs.push(maxProb(extracted.dist));
      }
      if (!rowOk) parseFails += 1;
    } catch {
      wallMs.push(Date.now() - started);
      parseFails += 1;
    }
  }

  const questionReports: AgreementQuestionReport[] = [];
  for (const [name, q] of Object.entries(questions)) {
    const bucket = perQ[name]!;
    const counts = new Map<string, number>();
    for (const lab of bucket.labels) {
      counts.set(lab, (counts.get(lab) ?? 0) + 1);
    }
    let majority = "";
    let majorityCount = 0;
    for (const [k, n] of counts) {
      if (n > majorityCount) {
        majority = k;
        majorityCount = n;
      }
    }
    const labeled = bucket.labels.length || 1;
    const meanDist = meanDistribution(bucket.dists);
    const kls = bucket.dists.map((d) => klDivergence(d, meanDist));
    const meanKl = kls.length ? kls.reduce((a, b) => a + b, 0) / kls.length : 0;
    const meanTop = maxProb(meanDist);
    const maxDelta = bucket.topProbs.length
      ? Math.max(...bucket.topProbs.map((p) => Math.abs(p - meanTop)))
      : 0;

    questionReports.push({
      question: name,
      type: q.type,
      flip_rate: round4(1 - majorityCount / labeled),
      majority_label: majority,
      majority_share: round4(majorityCount / labeled),
      unique_labels: [...counts.keys()],
      mean_kl_to_mean: round4(meanKl),
      max_prob_delta: round4(maxDelta),
      top_prob_stdev: round4(stdev(bucket.topProbs)),
    });
  }

  const latencySamples = serverMs.length ? serverMs : wallMs;

  return {
    suite: "probabilistic-agreement",
    mode,
    trials,
    state_preview: state.slice(0, 120),
    latency: summarizeLatencies(latencySamples),
    parse_fail_rate: round4(parseFails / trials),
    parse_fails: parseFails,
    questions: questionReports,
    mean_flip_rate: round4(
      questionReports.reduce((a, r) => a + r.flip_rate, 0) /
        (questionReports.length || 1),
    ),
    mean_kl_to_mean: round4(
      questionReports.reduce((a, r) => a + r.mean_kl_to_mean, 0) /
        (questionReports.length || 1),
    ),
  };
}
