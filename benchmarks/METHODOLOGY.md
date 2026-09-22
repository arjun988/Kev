# Benchmark methodology

## Principles

1. **Same questions.** Both systems see identical `state`, `instructions`, and `criteria` (including option order unless you are measuring stability).
2. **One attempt.** No retries, no temperature sampling loops, no “best of N” unless every baseline gets the same budget.
3. **Pinned versions.** Record Kev commit, backend (`mock` / Ollama model tag / OpenAI model id), and the other system’s model id or weight hash.
4. **Separate accuracy from latency.** A faster wrong answer is still wrong.
5. **Say what you measured.** Mock heuristics are useful for CI; they are not model quality.

## Baselines we care about

| Baseline | What it is | Fair comparison |
| --- | --- | --- |
| **Kev mock** | Deterministic keyword heuristics | CI smoke / regression only |
| **Kev + chat model** | Constrained / parallel / readout over an instruct model | Primary open self-host path |
| **OpenJev** | Open weights + System One-style readout | Same fixture JSON; note license (some builds are NC) |
| **Chat-as-classifier** | Free-form or JSON chat without calibrated readout | Same labels; parse failures count as wrong |
| **Hosted Jev** | TypeSafe API | Same fixture; expect API key + cost |

Kev is **API-compatible** with the System One contract. That does **not** mean identical probabilities to proprietary or third-party weights.

## Scoring

For each example with `expected.choice`, the top choice key must match.  
For `expected.noul`, the probability must fall in `[min, max]` when provided.

Accuracy = `#correct / #examples with expectations`.

## Stability (optional companion)

Option-order flip rate should be measured with `kev eval stability` on the same backend. Target: **&lt; 5%** flip rate on the billing routing smoke suite.

## Publishing a result

Include at least:

```text
date: ISO-8601
kev_commit: <sha>
backend: mock | ollama/<tag> | openai/<model>
fixture: benchmarks/fixtures/routing-bench.json
accuracy: 0.xx (N/N)
latency_ms_mean: …
hardware: …
notes: …
```
