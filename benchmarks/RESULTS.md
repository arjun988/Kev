# Published results

## 1. OpenJev held-out · Banking77 (headline)

**Dataset:** [s1lv3rj1nx/openjev-heldout](https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout) · Banking77 · n=600  
**Command:** `pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks banking77`

| System | Backend | Accuracy | Notes |
| --- | --- | ---: | --- |
| **Kev + qwen3.5:9b** | Ollama · **100% GPU** | **78.8%** (473/600) | This repo · 2026-09-22 · wall ~23.5 min |
| Jev (held-out subset note) | hosted | **~82.0%** | 300-row subset cited in `task.json` |
| Jev 1.13 | JevBench full test | **80.3%** | n=3,080 · [methodology](https://jevbench.xyz/methodology) |
| Kev mock | heuristics | 49.5% | CI only |

OpenJev private 10k (not re-runnable here): Jev **85.4%** · OpenJev **84.0%** ([HF card](https://huggingface.co/openjev/openjev)).

Artifact: `benchmarks/out/openjev-heldout-latest.{json,md}`

```bash
# Reproduce
KEV_BACKEND=ollama
KEV_OLLAMA_MODEL=qwen3.5:9b
pnpm --filter @kev-ai/server start
pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 --tasks banking77
```

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
