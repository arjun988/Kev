# Published results

## 1. OpenJev held-out (Kev + qwen3.5:9b · Ollama · 100% GPU)

**Dataset:** [s1lv3rj1nx/openjev-heldout](https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout)  
**Model:** `qwen3.5:9b` · confirmed `100% GPU` via `ollama ps`

| Task | Primitive | n | Kev accuracy | Chance | Date |
| --- | --- | ---: | ---: | ---: | --- |
| **Banking77** | choice (77) | 600 | **78.8%** (473/600) | 1.3% | 2026-09-22 |
| **CLINC OOS** | choice (151) | 600 | **86%** (516/600) | 0.7% | 2026-09-23 |
| **AG News** | choice (4) | 600 | **86.5%** (519/600) | 25.0% | 2026-09-23 |
| **Civil Comments toxicity** | noul | 600 | **73.5%** (441/600) | 50.0% | 2026-09-23 |

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
pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks civil_comments_toxicity
```

Artifact: `benchmarks/out/openjev-heldout-latest.{json,md}`

---

## 2. Smoke fixture (CI)

| Field | Value |
| --- | --- |
| Fixture | `benchmarks/fixtures/routing-bench.json` |
| Backend | mock |
| Command | `pnpm bench` |
| Accuracy | **1.00** (8/8) |

---

## 3. Stability companion

```bash
pnpm --filter @kev-ai/cli exec kev eval stability --trials 20
```

Target flip rate on billing smoke: **&lt; 5%**.
