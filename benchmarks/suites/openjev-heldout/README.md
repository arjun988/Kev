# OpenJev held-out suite (public)

This is the **same public held-out generalization suite** used around OpenJev:

**Dataset:** [s1lv3rj1nx/openjev-heldout](https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout)

| Task | Primitive | Options | Rows |
| --- | --- | ---: | ---: |
| `banking77` | choice | 77 | 600 |
| `clinc_oos` | choice | 151 | 600 |
| `massive_intent` | choice | 60 | 600 |
| `ag_news` | choice | 4 | 600 |
| `sst5` | score | 5 | 600 |
| `civil_comments_toxicity` | noul | 2 | 600 |
| `helpsteer_helpfulness` | score | 5 | 600 |

OpenJev’s famous **10,000-question / 34-source** table is **not fully public** (only aggregate scores). This held-out suite is what you can actually re-run.

## Published reference (not our run)

| Claim | Number | Source |
| --- | --- | --- |
| Jev hosted on OpenJev’s private 10k text set | **85.4%** | [openjev/openjev](https://huggingface.co/openjev/openjev) |
| OpenJev on that same 10k set | **84.0%** | same |
| Jev 1.13 on full Banking77 test (n=3,080) | **80.3%** | [JevBench methodology](https://jevbench.xyz/methodology) |
| Jev on 300-row Banking77 subset of this held-out sample | **~82.0%** | noted in `banking77/task.json` |

## Kev measured (this repo)

| Backend | Banking77 | Date |
| --- | ---: | --- |
| **qwen3.5:9b · Ollama · 100% GPU** | **78.8%** (473/600) | 2026-09-22 |
| llama3.2:1b · Ollama GPU | 2.2% | 2026-09-22 |
| mock | 49.5% | 2026-09-22 |

Full breakdown: [`../../RESULTS.md`](../../RESULTS.md) · artifact: `benchmarks/out/openjev-heldout-latest.json`

## Download raw files

```bash
python -c "from huggingface_hub import hf_hub_download; import shutil,os
repo='s1lv3rj1nx/openjev-heldout'
root='benchmarks/suites/openjev-heldout/raw'
tasks=['banking77','ag_news','sst5','civil_comments_toxicity','clinc_oos','massive_intent','helpsteer_helpfulness']
for t in tasks:
  os.makedirs(f'{root}/{t}', exist_ok=True)
  for f in ['task.json','test.jsonl']:
    p=hf_hub_download(repo_id=repo, repo_type='dataset', filename=f'{t}/{f}')
    shutil.copy(p, f'{root}/{t}/{f}')
print('ok')"
```

## Run Kev

```bash
pnpm build
pnpm exec tsx benchmarks/suites/openjev-heldout/run.ts
# live model:
pnpm exec tsx benchmarks/suites/openjev-heldout/run.ts --mode api --base-url http://127.0.0.1:3000
# subset:
pnpm exec tsx benchmarks/suites/openjev-heldout/run.ts --tasks ag_news,sst5 --limit 100
```

Results write to `benchmarks/out/openjev-heldout-latest.json` and `.md`.
