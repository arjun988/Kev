# Published results

## Mock baseline (CI reference)

| Field | Value |
| --- | --- |
| Date | 2026-09-22 |
| Fixture | `benchmarks/fixtures/routing-bench.json` |
| Backend | Kev **mock** heuristics (no LLM) |
| Command | `pnpm exec tsx benchmarks/run.ts` |
| Accuracy | **1.00** (8/8) on the frozen suite |
| Wall latency | ~5 ms (mock, this machine) |
| Purpose | Regression / smoke — **not** a claim vs OpenJev or hosted Jev |

Re-run locally after any scorer change. If accuracy drops, treat it as a breaking change to the mock baseline.

## Live model baselines (fill in when you measure)

| System | Model | Hardware | Accuracy | Mean latency | Commit / notes |
| --- | --- | --- | --- | --- | --- |
| Kev + Ollama | _your tag_ | _your machine_ | — | — | `pnpm exec tsx benchmarks/run.ts --mode api` |
| Kev + OpenAI-compatible | _model id_ | — | — | — | Set `KEV_BACKEND=openai` |
| OpenJev | _weight id_ | — | — | — | Same fixture JSON |
| Chat JSON classifier | _model id_ | — | — | — | Parse failures = wrong |
| Hosted Jev | _version_ | TypeSafe | — | — | Same fixture JSON |

Paste rows into a PR when you have numbers. Keep methodology from [METHODOLOGY.md](./METHODOLOGY.md).

## Stability companion

```bash
pnpm --filter @kev-ai/cli exec kev eval stability --trials 20
```

Target flip rate on the billing smoke suite: **&lt; 0.05**.
