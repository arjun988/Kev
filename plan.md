# Kev — Open System One Decisions

**Kev** is an open-source System One decision engine: send a `state` and typed `questions`, get back calibrated answers with probabilities — not free-form text.

Compatible with the [System One](https://systemonemodels.org/) contract (`choice` / `score` / `noul`) used by TypeSafe’s Jev, but designed to be **more open, more runnable, and more useful in production**.

License: **Apache-2.0** (already in this repo).

---

## 1. What exists today

| Project | What it is | Gaps |
| --- | --- | --- |
| **Jev** (TypeSafe) | Hosted System One model. Fast (70–500ms), calibrated probs, agent-ready. | Proprietary weights. Closed model. Vendor lock-in. Cost / waitlist / rate limits. |
| **OpenJev** (`openjev/openjev`) | Fine-tuned open weights + letter-token logprob readout. Near Jev accuracy. | Weights are **CC BY-NC** (not commercial). Needs ~80GB GPU for primary recipe. Heavy ops. |
| **OpenJev** (`razorback16`) | DiffusionGemma + vLLM, Jev-compatible API. Apache-2.0. | Needs large NVIDIA GPU + special vLLM build. Fragile serving path. |
| **OpenJev** (chat approx) | Parallel micro-scoring via ordinary chat LLMs. | Slow, expensive, not true logprob readout. License / quality uneven. |

**Shared gaps across all of them:**

- No great self-host story for laptops / small teams
- Weak first-party DX (SDK + CLI + MCP + playground as one product)
- Little open eval / calibration tooling you can run yourself
- Hard to swap backends without rewriting clients
- No clean path from “use any LLM” → “fine-tuned decision model”

---

## 2. What Kev will be (better, not a clone)

### Product thesis

> One Decision API. Many backends. Fully open. Production-grade DX.

Kev speaks the System One wire format so existing Jev clients can point at it, then goes further:

1. **True open source** — Apache-2.0 for server, SDKs, tools. Commercial-friendly by default. Optional fine-tuned weights only under permissive licenses (Apache / MIT / OpenRAIL-acceptable). Never CC BY-NC as the default path.
2. **Backend-agnostic** — same API over:
   - **Logprob readout** (preferred: single-token option letters → calibrated probs)
   - **Structured generation** (constrained JSON / grammar when logprobs unavailable)
   - **Parallel micro-scoring** (fallback for closed APIs)
   - Local runtimes: **llama.cpp / Ollama / MLX / vLLM / Hugging Face TGI**
3. **Runs everywhere** — Docker one-liner on a laptop (7B–14B quantized) up to multi-GPU clusters. CPU and Apple Silicon first-class, not afterthoughts.
4. **DX that agents actually use** — Python + TypeScript SDKs, CLI, MCP server, LangChain / LlamaIndex adapters, OpenAI-compatible *decision* surface.
5. **Calibrated & measurable** — built-in eval harness, calibration fits, confidence bands, decision traces.
6. **Production primitives** — batch endpoint, prefix/state caching, idempotency, rate limits, OpenTelemetry, decision audit log.
7. **Extensions beyond Jev** (opt-in, versioned) — `rank`, `multi` (multi-label), hierarchical cascades, schema-validated `state`, multi-image / document inputs.

### Non-goals (v1)

- Competing with general chat / coding models
- Shipping a giant private training cluster on day one
- Breaking System One compatibility for vanity APIs

---

## 3. Core API (v1)

### Endpoint

```
POST /v1/systemone
```

Jev-compatible request / response so TypeSafe SDKs and recipes work when pointed at Kev (`KEV_BASE_URL` / `TYPESAFE_BASE_URL`).

### Request

```json
{
  "model": "kev-latest",
  "state": "Customer: I was charged twice and I am furious.",
  "questions": {
    "topic": {
      "type": "choice",
      "instructions": "What is the issue about?",
      "criteria": {
        "billing": "money / charges",
        "bug": "product broken",
        "account": "login or access"
      }
    },
    "severity": {
      "type": "score",
      "instructions": "How urgent is this?",
      "criteria": ["routine", "today", "urgent", "about to churn"]
    },
    "escalate": {
      "type": "noul",
      "instructions": "Escalate to a human now?"
    }
  }
}
```

### Response

```json
{
  "model": "kev-0.1.0",
  "answers": {
    "topic": {
      "type": "choice",
      "choice": "billing",
      "confidence": 0.97,
      "probabilities": { "billing": 0.97, "bug": 0.02, "account": 0.01 }
    },
    "severity": {
      "type": "score",
      "score": 2.4,
      "confidence": 0.81,
      "legend": { "0": "routine", "3": "about to churn" },
      "probabilities": { "0": 0.02, "1": 0.1, "2": 0.4, "3": 0.48 }
    },
    "escalate": { "type": "noul", "noul": 0.86 }
  },
  "usage": {
    "input_tokens": 412,
    "output_tokens": 0,
    "latency_ms": 94
  }
}
```

### Primitives

| Type | Input | Output |
| --- | --- | --- |
| `choice` | map of up to 255 labelled options | winning key + probs + confidence |
| `score` | ordered 2–10 level descriptions | weighted mean score + probs + confidence |
| `noul` | yes/no instructions (optional true/false criteria) | P(yes) ∈ [0, 1] |

Kev extras (under `/v1` with feature flags or `x-kev-*` fields, documented separately so Jev clients stay happy):

- `POST /v1/systemone/batch`
- `rank` / `multi` question types
- `trace: true` → per-question backend method + raw logits / scores
- OpenAPI 3.1 + JSON Schema published in-repo

---

## 4. How decisions are computed

Priority order (automatic fallback):

```
1. Logprob readout   → map options to tokens (A–Z, a–z, …),
                       one forward pass, read first-position scores,
                       temperature/calibration → probabilities
2. Constrained decode → grammar / JSON schema forces a valid answer shape
3. Parallel score     → one tiny {p:0..1} call per option, softmax normalize
```

**Calibration:** temperature scaling + optional Platt / isotonic fits stored per model profile. Confidence derived from distribution concentration (not model “vibes”).

**Stability:** option-order shuffle tests in CI; target flip rate ≪ untuned base model.

---

## 5. Tech stack

### Monorepo

| Layer | Choice | Why |
| --- | --- | --- |
| Package manager | **pnpm** + workspaces | Fast, strict, standard for TS monorepos |
| Build / tasks | **Turborepo** | Cacheable builds/tests across packages |
| Language (core) | **TypeScript** (Node 22+) | One language for server, SDK, MCP, CLI |
| Language (ML / eval) | **Python 3.12+** | Training, calibration, HF, notebooks |
| API framework | **Hono** | Tiny, fast, typed, works on Node / Bun |
| Validation | **Zod** (TS) + **Pydantic v2** (Python) | Shared mental model, OpenAPI generation |
| Runtime (dev) | **Bun** optional; **Node** primary | Portability for contributors |
| Inference clients | OpenAI SDK + native adapters | Talk to vLLM, Ollama, llama.cpp, cloud |
| Local inference | **llama.cpp** / **Ollama** / **MLX** / **vLLM** | Cover CPU, Mac, NVIDIA |
| Container | **Docker** + compose | One-command self-host |
| Observability | **OpenTelemetry** | Traces/metrics without vendor lock-in |
| Docs | **Mintlify** or Starlight | Clean API + guides |
| CI | **GitHub Actions** | Lint, test, eval smoke, Docker publish |
| Registry | npm (`kev`, `@kev-ai/*`) + PyPI (`kev`) | Dual-ecosystem |

### Packages (planned layout)

```
kev/
├── apps/
│   ├── server/          # Decision API (Hono)
│   ├── playground/      # Local web UI to try questions
│   └── mcp/             # MCP server for Cursor / agents
├── packages/
│   ├── schema/          # Shared Zod schemas + OpenAPI
│   ├── core/            # Readout, calibration, question runners
│   ├── backends/        # vLLM, Ollama, OpenAI-compatible, llama.cpp
│   ├── sdk-ts/          # TypeScript client
│   └── cli/             # `kev ask` / `kev serve` / `kev eval`
├── python/
│   ├── kev/             # Python SDK
│   ├── kev_eval/        # Benchmarks & calibration
│   └── kev_train/       # Optional fine-tune recipes (later)
├── models/              # Model cards, calibration profiles (git-lfs or HF)
├── examples/            # Routing, moderation, agent step, RAG judge
├── docker/              # Dockerfile + compose
├── plan.md
├── LICENSE              # Apache-2.0
└── README.md
```

### Model strategy (phased)

| Phase | Model | Notes |
| --- | --- | --- |
| **v0** | Any OpenAI-compatible chat / instruct model via backends | Ship API + DX first |
| **v1** | Curated readout profiles for Qwen2.5 / Llama 3.x / Gemma (7B–14B) | Quantized GGUF + MLX recipes |
| **v2** | Optional **Kev-tuned** checkpoint (permissive license) | RLCD / preference data for decision stability |
| Always | Bring-your-own model | First-class |

---

## 6. Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  SDK / CLI  │   │  MCP / UI   │   │ Jev clients │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └────────────┬────┴─────────────────┘
                    ▼
            ┌───────────────┐
            │  Kev Server   │  POST /v1/systemone
            │  (Hono + Zod) │
            └───────┬───────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Readout │ │ Constr. │ │ Parallel│
   │ engine  │ │ decode  │ │ score   │
   └────┬────┘ └────┬────┘ └────┬────┘
        └───────────┼───────────┘
                    ▼
         ┌─────────────────────┐
         │ Backend adapters    │
         │ Ollama / vLLM /     │
         │ llama.cpp / OpenAI  │
         └─────────────────────┘
```

**Request path:** validate → expand questions → choose strategy per backend capabilities → run in parallel (shared state / prefix cache) → calibrate → confidence → usage + latency.

---

## 7. How we beat Jev / OpenJev

| Dimension | Jev | OpenJev | **Kev** |
| --- | --- | --- | --- |
| License | Proprietary | Often NC or GPU-heavy | **Apache-2.0 end-to-end** |
| Self-host | No | Yes, hard | **Yes, easy (Docker + Ollama)** |
| Consumer hardware | N/A | Weak | **First-class** |
| Backend choice | One | One family | **Pluggable** |
| SDKs / MCP / CLI | Partial | Thin | **Full DX** |
| Eval & calibration | Opaque | Partial | **Open harness** |
| API compatibility | Source | Mostly | **Compatible + extensions** |
| Observability | Vendor | DIY | **OTel built-in** |
| Cost control | Pay per token | Own GPU | **Local or any provider** |

---

## 8. Implementation roadmap

### Phase 0 — Foundations (week 1)

- [x] Repo structure (pnpm monorepo + Python package stubs)
- [x] Shared schemas (`choice` / `score` / `noul`) + OpenAPI
- [x] Minimal Hono server: `POST /v1/systemone` with **mock / deterministic** backend
- [x] TypeScript SDK + CLI `kev ask`
- [x] Docker compose (server only)
- [x] README: vision, quickstart, compatibility notes
- [x] CI: typecheck, unit tests, OpenAPI lint

### Phase 1 — Real decisions (weeks 2–3)

- [x] OpenAI-compatible backend (logprobs when available)
- [x] Ollama backend (local default)
- [x] Readout engine (letter-token mapping, softmax, temperature)
- [x] Parallel micro-score fallback
- [x] Calibration profiles (config YAML / JSON)
- [x] Python SDK (`pip install kev`)
- [x] Examples: ticket routing, moderation gate, RAG groundedness

### Phase 2 — Production DX (weeks 4–5)

- [x] Batch endpoint
- [x] Prefix / state caching where backends support it
- [x] MCP server for agent IDEs
- [x] Playground UI (single composition, brand-first — **Kev**)
- [x] OpenTelemetry hooks + decision audit log
- [x] Rate limiting / API keys (optional self-host auth)
- [x] LangChain + LlamaIndex adapters

### Phase 3 — Quality & models (weeks 6–8)

- [x] Eval harness (`kev eval`) on public classification / NLI / routing sets
- [x] Option-order stability tests
- [x] Recommended model cards (GGUF / MLX / FP8)
- [x] Multi-image / screenshot questions (agent steps)
- [x] Hierarchical cascade helper for >255 options
- [x] Dataset format for evaluation (Apache-friendly) — **no training in-repo**

### Phase 4 — Ecosystem

- [ ] Hosted demo (optional, not required for OSS)
- [x] Benchmarks published vs OpenJev / chat baselines (honest, reproducible)
- [x] Awesome-kev recipes, VS Code / Cursor snippets
- [x] v1.0: stable API, semver, migration guide from Jev

---

## 9. Success metrics

| Metric | Target (v1) |
| --- | --- |
| Cold path latency (local 8B Q4, short text, 1 question) | &lt; 200ms median on modern laptop GPU / Apple Silicon |
| API compatibility | Pass Jev client smoke tests against Kev |
| Option-order flip rate | &lt; 5% on stability suite |
| Time to first decision | &lt; 5 minutes (`docker compose up` or `kev serve --ollama`) |
| License clarity | Apache-2.0 on all first-party code; no NC default |

---

## 10. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Can’t match hosted Jev accuracy early | Ship multi-backend + honest evals; improve models iteratively |
| Logprobs unavailable on many providers | Automatic fallback to constrained / parallel score |
| Trademark / naming confusion with Jev | Clear README: independent, not affiliated with TypeSafe |
| Scope creep (training too early) | Phase 0–2 = product & API; Phase 3 = models |
| GPU barrier for contributors | Ollama / GGUF path as default contributor experience |

---

## 11. Immediate next steps

After this plan is accepted:

1. Scaffold monorepo + `apps/server` with Zod-validated `/v1/systemone`
2. Implement mock backend + TS SDK + one end-to-end example
3. Wire Ollama backend and prove a real `choice` + `noul` on a local model
4. Expand README and cut a `v0.1.0-alpha` tag

---

## 12. References

- [System One — Choice / Score / Noul](https://systemonemodels.org/guides/choice-score-noul/)
- [Jev by TypeSafe AI](https://www.jevtypesafeai.com/)
- [OpenJev (HF)](https://huggingface.co/openjev/openjev)
- [Codiv OpenJev docs](https://codiv.ai/docs/models)

---

*Kev is independent and not affiliated with TypeSafe AI or OpenJev projects. “System One” describes the decision-model pattern; Kev implements an open, compatible engine.*
