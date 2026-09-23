# Benchmark methodology

## Principles

1. **Same questions.** Both systems see identical `state`, `instructions`, and `criteria` (including option order unless you are measuring stability).
2. **One attempt.** No retries, no temperature sampling loops, no “best of N” unless every baseline gets the same budget.
3. **Pinned versions.** Record Kev commit, backend (`mock` / Ollama model tag / OpenAI model id), and the other system’s model id or weight hash.
4. **Separate accuracy from latency.** A faster wrong answer is still wrong.
5. **Say what you measured.** Mock heuristics are useful for CI; they are not model quality.
6. **Split format failure from decision error.** A parseable wrong answer is not a “hallucination” of structure.

## Baselines we care about

| Baseline | What it is | Fair comparison |
| --- | --- | --- |
| **Kev mock** | Deterministic keyword heuristics | CI smoke / regression only |
| **Kev + chat model** | Constrained / parallel / readout over an instruct model | Primary open self-host path |
| **OpenJev** | Open weights + System One-style readout | Same fixture JSON; note license (some builds are NC) |
| **Chat-as-classifier** | Free-form or JSON chat without calibrated readout | Same labels; parse failures count as wrong |
| **Hosted Jev** | TypeSafe API | Same fixture; expect API key + cost |

Kev is **API-compatible** with the System One contract. That does **not** mean identical probabilities to proprietary or third-party weights.

## Primary public suite

**Dataset:** [s1lv3rj1nx/openjev-heldout](https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout)

This is the public held-out set used around OpenJev (Banking77, CLINC, MASSIVE, AG News, SST-5, Civil Comments, …). OpenJev’s **10k / 34-source** leaderboard numbers are aggregates only — cite them as reference, do not claim you re-ran that private mix unless you have the questions.

```bash
pnpm bench:heldout
```

Held-out reports now include per-task **p50 / p95 latency**, **parse_fail_rate** (format hallucination), and **strategy_counts** (`readout` / `constrained` / `parallel` / `mock`).

## Ops suite (latency, agreement, multi-Q)

Answers the production questions: how fast, how often is output unusable, how stable are probs, how many questions per request.

```bash
pnpm bench:ops                          # mock (CI)
pnpm bench:ops -- --mode api --base-url http://127.0.0.1:3000
pnpm bench:agreement
pnpm bench:multiq
```

| Metric | Definition |
| --- | --- |
| **p50 / p95 / p99** | Percentiles of `usage.latency_ms` (falls back to wall clock) |
| **parse_fail_rate** / **format_hallucination_rate** | Missing answer, type mismatch, invented choice label, bad noul, or request error — **first shot**, no retries |
| **probabilistic agreement** | Same request × N trials: argmax flip rate + mean KL(trial ‖ mean distribution) + max-prob delta |
| **option-order stability** | Shuffle criteria order (`kev eval stability`); target flip &lt; 5% |
| **multi-question scaling** | 1 / 5 / 10 / 15 questions sharing one `state`: latency ratio vs 1-Q + mean confidence ratio |

## Scoring (accuracy)

For each example with `expected.choice`, the top choice key must match.  
For `expected.score`, argmax of the score distribution must match the integer label.  
For `expected.noul` / boolean toxicity labels, treat `noul ≥ 0.5` as positive unless a range is given.

Accuracy = `#correct / #examples with expectations`.  
Parse fails are counted separately and **do not** inflate accuracy (they are neither correct nor scored as label errors when structure is invalid).

## Stability (optional companion)

Option-order flip rate should be measured with `kev eval stability` on the same backend. Target: **&lt; 5%** flip rate on the billing routing smoke suite.

## Publishing a result

Include at least:

```text
date: ISO-8601
kev_commit: <sha>
backend: mock | ollama/<tag> | openai/<model>
fixture: benchmarks/fixtures/routing-bench.json | openjev-heldout/<task>
accuracy: 0.xx (N/N)
parse_fail_rate: 0.xx
latency_ms_p50: …
latency_ms_p95: …
strategy_counts: { readout: … }
hardware: …
notes: …
```

Artifacts: `benchmarks/out/ops-latest.{json,md}` · `benchmarks/out/openjev-heldout-latest.{json,md}`
