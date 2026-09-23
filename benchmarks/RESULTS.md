# Published results

## 1. OpenJev held-out (Kev + qwen3.5:9b · Ollama · 100% GPU)

**Dataset:** [s1lv3rj1nx/openjev-heldout](https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout)  
**Model:** `qwen3.5:9b` · confirmed `100% GPU` via `ollama ps`

| Task | Primitive | n | Kev accuracy | Chance | Date |
| --- | --- | ---: | ---: | ---: | --- |
| **Banking77** | choice (77) | 600 | **83%** (498/600) | 1.3% | 2026-09-22 |
| **CLINC OOS** | choice (151) | 600 | **86%** (516/600) | 0.7% | 2026-09-23 |
| **AG News** | choice (4) | 600 | **86.5%** (519/600) | 25.0% | 2026-09-23 |
| **SST-5** | score (5) | 600 | **89.5%** within-1 (537/600) | 20.0% | 2026-09-23 |
| **Civil Comments toxicity** | noul | 600 | **81%** (486/600) | 50.0% | 2026-09-23 |

SST-5 uses ordinal **within-1** scoring (`|pred−gold|≤1`); other tasks stay exact-match.

> Re-run with the upgraded reporter to fill **p50 / p95**, **parse_fail_rate**, and **strategy_counts** columns:
>
> ```bash
> pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks banking77
> ```
>
> Paste per-task latency / parse-fail from `benchmarks/out/openjev-heldout-latest.md`.

### Published references (not our run)

| Claim | Accuracy | Source |
| --- | ---: | --- |
| Jev on Banking77 held-out subset | **~82.0%** | `banking77/task.json` |
| Jev 1.13 Banking77 full test (n=3,080) | **80.3%** | [JevBench](https://jevbench.xyz/methodology) |
| Jev / OpenJev private 10k | **85.4%** / **84.0%** | [HF card](https://huggingface.co/openjev/openjev) |

```bash
KEV_BACKEND=ollama
KEV_OLLAMA_MODEL=qwen3.5:9b
pnpm --filter @kev-ai/server start
pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks banking77
pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks clinc_oos
pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks ag_news
pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks sst5
pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks civil_comments_toxicity
```

Artifact: `benchmarks/out/openjev-heldout-latest.{json,md}`

---

## 2. Ops suite (latency · parse-fail · agreement · multi-Q)

Answers: *how fast*, *how often is output unusable*, *do probs drift*, *how many questions per request*.

### 2a. Mock (CI / reproducible structure)

Run: `pnpm bench:ops` (2026-09-23)  
Artifact: `benchmarks/out/ops-latest.{json,md}`

| Metric | Mock value | Notes |
| --- | ---: | --- |
| **p50 / p95 / p99** | **0 / 0.1 / 0.8 ms** | Heuristic path — not model latency |
| **Format hallucination / parse-fail** | **0%** | Mock always returns valid System One answers |
| **Probabilistic agreement (mean flip)** | **0%** | Deterministic mock |
| **Mean KL (trial ‖ mean)** | **0** | Identical distributions across trials |
| **Multi-Q 1→15 parse-fail** | **0%** | All 15 questions valid in one request |
| **Multi-Q latency × @15 vs @1** | **~2×** | Still sub-ms on mock |
| Routing fixture accuracy | **1.00** (8/8) | Same as smoke |

### 2b. Live model — `qwen3.5:9b` · Ollama · **100% GPU**

**Date:** 2026-09-23 · **Commit:** `7af4227`  
**Setup:** `KEV_BACKEND=ollama` · `KEV_OLLAMA_MODEL=qwen3.5:9b` · `KEV_CACHE_SIZE=0` · model pinned (`keep_alive=-1`, `ollama ps` → `100% GPU`)  
**Strategy:** `constrained` (Ollama chat has no top-logprobs; readout used when the backend exposes them)  
**Command:** `pnpm bench:ops -- --mode api --base-url http://127.0.0.1:3000 --trials 10 --multi-trials 3`  
**Artifact:** `benchmarks/out/ops-latest.{json,md}`

| Metric | Value |
| --- | ---: |
| **p50 latency** (2-Q smoke) | **888 ms** |
| **p95 latency** | **1022 ms** |
| **p99 latency** | **1084 ms** |
| **Format hallucination / parse-fail** | **0%** (0/10 agreement + multi-Q) |
| **Probabilistic agreement (mean flip)** | **0%** (10 identical re-runs) |
| **Mean KL (trial ‖ mean)** | **0** |
| Routing fixture accuracy | **100%** (8/8) |
| Multi-Q latency @1 / @5 / @10 / @15 (p50) | **443 / 2592 / 5409 / 8011 ms** |
| Multi-Q latency × @15 vs @1 | **~15.8×** (near-linear; questions run in parallel but Ollama serializes) |
| Multi-Q confidence × @15 vs @1 | **~1.17×** (no collapse) |
| Multi-Q parse-fail @1…15 | **0%** |

Latency smoke = one `choice` + one `noul` per request, warm GPU, no cache.

---

## 3. Smoke fixture (CI)

| Field | Value |
| --- | --- |
| Fixture | `benchmarks/fixtures/routing-bench.json` |
| Backend | mock |
| Command | `pnpm bench` |
| Accuracy | **1.00** (8/8) |

---

## 4. Stability companion

```bash
pnpm --filter @kev-ai/cli exec kev eval stability --trials 20
pnpm --filter @kev-ai/cli exec kev eval agreement --trials 20
pnpm --filter @kev-ai/cli exec kev eval multiq --multi-trials 5
```

| Suite | Target |
| --- | --- |
| Option-order flip (billing smoke) | **&lt; 5%** |
| Rerun agreement flip (same prompt) | **&lt; 5%** on readout backends |
| Parse-fail / format hallucination | **0%** on readout / mock |
