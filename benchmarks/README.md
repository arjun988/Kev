# Benchmarks

Honest, reproducible System One decision benchmarks for **Kev**.

These numbers measure **your** stack (mock heuristics, Ollama, or an OpenAI-compatible model). They are **not** a claim that Kev matches hosted Jev or OpenJev weights on every task. When you compare against another system, run the **same fixture file** on both sides and publish both the command and the git commit.

## What’s in the box

| Path | Purpose |
| --- | --- |
| `fixtures/routing-bench.json` | Routing + urgency + light NLI-style gates |
| `run.ts` | Reproducible runner (mock by default; `--mode api` for a live server) |
| `RESULTS.md` | Published reference numbers for the mock baseline in this repo |
| `METHODOLOGY.md` | How to compare fairly with OpenJev / chat / Jev |

## Quick run

```bash
# from repo root (after pnpm build)
pnpm exec tsx benchmarks/run.ts
pnpm exec tsx benchmarks/run.ts --mode api --base-url http://127.0.0.1:3000
```

Exit code is non-zero if accuracy falls below the threshold (default `0.75` for mock).

## Comparing to OpenJev / chat baselines

1. Freeze `fixtures/routing-bench.json` (do not edit mid-run).
2. Run Kev → save `benchmarks/out/kev.json`.
3. Run the other system on the **same** `state` + `questions` → save its answers in the same shape (or map into ours).
4. Score both with the same `expected` keys in the fixture.
5. Report: model id, hardware, commit SHA, timestamp, accuracy, mean latency, flip-rate if you also run `kev eval stability`.

See [METHODOLOGY.md](./METHODOLOGY.md).
