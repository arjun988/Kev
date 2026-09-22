# Benchmarks

Honest, reproducible System One benchmarks for **Kev**.

## What OpenJev / Jev actually used

| Suite | Public? | What it is |
| --- | --- | --- |
| **OpenJev 10k text** (34 sources) | Aggregates only | Jev **85.4%** · OpenJev **84.0%** on [HF card](https://huggingface.co/openjev/openjev) |
| **openjev-heldout** | **Yes** | Banking77, CLINC, MASSIVE, AG News, SST-5, Civil Comments, … |
| **JevBench Banking77** | Protocol public | Jev 1.13 **80.3%** on full test (n=3,080) |

We re-run the **public held-out suite** so anyone can reproduce. We cite the 10k / JevBench numbers as reference — we do not invent a fake “Kev = 84%” claim against a private set.

## Quick commands

```bash
# CI smoke (8 examples)
pnpm bench

# Same suite OpenJev uses for held-out generalization
pnpm exec tsx benchmarks/suites/openjev-heldout/run.ts
```

Details: [`suites/openjev-heldout/README.md`](./suites/openjev-heldout/README.md) · methodology: [`METHODOLOGY.md`](./METHODOLOGY.md) · numbers: [`RESULTS.md`](./RESULTS.md)
