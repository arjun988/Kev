import { evaluateWithMock } from "@kev-ai/backends";
import type { Question, SystemOneResponse } from "@kev-ai/schema";
import { KevClient } from "@kev-ai/sdk";
import {
  bumpStrategy,
  round4,
  summarizeLatencies,
  type LatencySummary,
  type StrategyCounts,
} from "./metrics.js";

function meanConfidence(res: SystemOneResponse): number {
  const vals: number[] = [];
  for (const ans of Object.values(res.answers)) {
    if (ans.type === "choice" || ans.type === "score") {
      vals.push(ans.confidence);
    } else if (ans.type === "noul") {
      vals.push(Math.abs(ans.noul - 0.5) * 2);
    }
  }
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export type MultiQMode = "mock" | "api";

export type MultiQPoint = {
  question_count: number;
  question_names: string[];
  trials: number;
  latency: LatencySummary;
  mean_confidence: number;
  parse_fail_rate: number;
  parse_fails: number;
  strategy_counts: StrategyCounts;
};

export type MultiQReport = {
  suite: "multi-question-scaling";
  mode: MultiQMode;
  state_preview: string;
  counts: number[];
  points: MultiQPoint[];
  /**
   * Relative latency vs 1-question baseline (mean_ms_n / mean_ms_1).
   * Helps answer: can I batch 10–15 questions in one request?
   */
  latency_ratio_vs_1: Record<string, number>;
  /**
   * Relative mean confidence vs 1-question baseline.
   * Drop here ≈ “intelligence score” degradation under batching.
   */
  confidence_ratio_vs_1: Record<string, number>;
};

const DEFAULT_STATE =
  "Customer emailed: charged twice last week, tracking shows package stuck, " +
  "login fails with 500 after deploy, and the tone is furious — they threaten to churn today.";

/** Ordered bank — first N questions are used for each scaling point. */
export const MULTI_Q_BANK: Array<{ name: string; question: Question }> = [
  {
    name: "topic",
    question: {
      type: "choice",
      instructions: "Primary issue domain?",
      criteria: {
        billing: "charges, refunds, invoices",
        shipping: "delivery and tracking",
        technical: "bugs, crashes, outages",
        account: "login and access",
      },
    },
  },
  {
    name: "severity",
    question: {
      type: "score",
      instructions: "Urgency?",
      criteria: ["routine", "this week", "today", "immediate"],
    },
  },
  {
    name: "escalate",
    question: {
      type: "noul",
      instructions: "Escalate to a human now?",
    },
  },
  {
    name: "refund",
    question: {
      type: "noul",
      instructions: "Does the customer want a refund?",
    },
  },
  {
    name: "churn_risk",
    question: {
      type: "noul",
      instructions: "Is churn risk high?",
    },
  },
  {
    name: "channel",
    question: {
      type: "choice",
      instructions: "Best reply channel?",
      criteria: {
        email: "async email reply",
        phone: "call the customer",
        chat: "live chat",
      },
    },
  },
  {
    name: "sentiment",
    question: {
      type: "score",
      instructions: "Customer sentiment?",
      criteria: ["positive", "neutral", "frustrated", "furious"],
    },
  },
  {
    name: "spam",
    question: {
      type: "noul",
      instructions: "Is this spam or scam?",
    },
  },
  {
    name: "pii",
    question: {
      type: "noul",
      instructions: "Does the message contain sensitive PII needing redaction?",
    },
  },
  {
    name: "language",
    question: {
      type: "choice",
      instructions: "Language of the message?",
      criteria: {
        en: "English",
        es: "Spanish",
        other: "Other / mixed",
      },
    },
  },
  {
    name: "product_area",
    question: {
      type: "choice",
      instructions: "Product area?",
      criteria: {
        payments: "payments and billing product",
        logistics: "shipping / logistics",
        auth: "authentication",
        other: "unclear",
      },
    },
  },
  {
    name: "needs_docs",
    question: {
      type: "noul",
      instructions: "Should we ask for a receipt or screenshot?",
    },
  },
  {
    name: "priority_queue",
    question: {
      type: "score",
      instructions: "Queue priority?",
      criteria: ["P3", "P2", "P1", "P0"],
    },
  },
  {
    name: "auto_reply_ok",
    question: {
      type: "noul",
      instructions: "Is an automated first reply acceptable?",
    },
  },
  {
    name: "legal_risk",
    question: {
      type: "noul",
      instructions: "Any legal / compliance risk?",
    },
  },
];

async function evaluateOnce(
  mode: MultiQMode,
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
    trace: true,
  });
}

function sliceQuestions(count: number): Record<string, Question> {
  const out: Record<string, Question> = {};
  for (const item of MULTI_Q_BANK.slice(0, count)) {
    out[item.name] = item.question;
  }
  return out;
}

function parseOk(
  questions: Record<string, Question>,
  res: SystemOneResponse,
): boolean {
  for (const [name, q] of Object.entries(questions)) {
    const ans = res.answers[name];
    if (!ans || ans.type !== q.type) return false;
    if (ans.type === "choice" && q.type === "choice") {
      if (!(ans.choice in q.criteria)) return false;
      for (const k of Object.keys(q.criteria)) {
        if (typeof ans.probabilities[k] !== "number") return false;
      }
    }
    if (ans.type === "score" && q.type === "score") {
      for (let i = 0; i < q.criteria.length; i++) {
        if (typeof ans.probabilities[String(i)] !== "number") return false;
      }
    }
  }
  return true;
}

/**
 * Measure latency + confidence as question count grows in a single request.
 * Default counts: 1, 5, 10, 15.
 */
export async function runMultiQSuite(options: {
  mode?: MultiQMode;
  baseUrl?: string;
  state?: string;
  counts?: number[];
  trialsPerCount?: number;
} = {}): Promise<MultiQReport> {
  const mode = options.mode ?? "mock";
  const state = options.state ?? DEFAULT_STATE;
  const counts = options.counts ?? [1, 5, 10, 15];
  const trialsPerCount = options.trialsPerCount ?? 5;

  const points: MultiQPoint[] = [];

  for (const count of counts) {
    if (count < 1 || count > MULTI_Q_BANK.length) {
      throw new Error(
        `question_count ${count} out of range 1..${MULTI_Q_BANK.length}`,
      );
    }
    const questions = sliceQuestions(count);
    const names = Object.keys(questions);
    const wallMs: number[] = [];
    const serverMs: number[] = [];
    const confidences: number[] = [];
    let parseFails = 0;
    const strategy_counts: StrategyCounts = {};

    for (let t = 0; t < trialsPerCount; t++) {
      const started = Date.now();
      try {
        const res = await evaluateOnce(mode, state, questions, options.baseUrl);
        wallMs.push(Date.now() - started);
        if (typeof res.usage.latency_ms === "number") {
          serverMs.push(res.usage.latency_ms);
        }
        if (!parseOk(questions, res)) parseFails += 1;
        else confidences.push(meanConfidence(res));

        if (res.trace) {
          for (const tr of Object.values(res.trace)) {
            bumpStrategy(strategy_counts, tr.strategy);
          }
        } else {
          bumpStrategy(strategy_counts, mode === "mock" ? "mock" : "unknown");
        }
      } catch {
        wallMs.push(Date.now() - started);
        parseFails += 1;
      }
    }

    const latencySamples = serverMs.length ? serverMs : wallMs;
    points.push({
      question_count: count,
      question_names: names,
      trials: trialsPerCount,
      latency: summarizeLatencies(latencySamples),
      mean_confidence: round4(
        confidences.length
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0,
      ),
      parse_fail_rate: round4(parseFails / trialsPerCount),
      parse_fails: parseFails,
      strategy_counts,
    });
  }

  const baseline = points.find((p) => p.question_count === 1) ?? points[0];
  const baseLat = baseline?.latency.mean_ms ?? 0;
  const baseConf = baseline?.mean_confidence ?? 0;

  const latency_ratio_vs_1: Record<string, number> = {};
  const confidence_ratio_vs_1: Record<string, number> = {};
  for (const p of points) {
    latency_ratio_vs_1[String(p.question_count)] =
      baseLat <= 0
        ? 1
        : round4(p.latency.mean_ms / baseLat);
    confidence_ratio_vs_1[String(p.question_count)] =
      baseConf <= 0
        ? 1
        : round4(p.mean_confidence / baseConf);
  }

  return {
    suite: "multi-question-scaling",
    mode,
    state_preview: state.slice(0, 140),
    counts,
    points,
    latency_ratio_vs_1,
    confidence_ratio_vs_1,
  };
}
