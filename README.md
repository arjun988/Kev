# Kev

**Open-source System One decisions.**  
Send a `state` and typed `questions` — get calibrated answers with probabilities. No free-form text to parse.

Kev speaks the same decision contract as TypeSafe’s Jev (`choice` / `score` / `noul`) so existing recipes work when pointed at your own server. Fully **Apache-2.0**. No model training required — plug in Ollama, vLLM, or any OpenAI-compatible API.

> Independent project. Not affiliated with TypeSafe AI or OpenJev.

---

## What you get (Phase 0 + 1)

| Piece | Package | Role |
| --- | --- | --- |
| Decision API | `@kev-ai/server` | `POST /v1/systemone` |
| Schemas | `@kev-ai/schema` | Zod types + OpenAPI |
| Engine | `@kev-ai/core` | Logprob readout, constrained JSON, parallel micro-score |
| Backends | `@kev-ai/backends` | `mock`, `ollama`, `openai` (compatible) |
| TS SDK | `@kev-ai/sdk` | Typed client |
| CLI | `@kev-ai/cli` | `kev health` / `kev demo` / `kev ask` |
| Python SDK | `kev` | `pip install -e ./python` |

---

## Quick start

### 1. Install

Requires **Node 20+** and **pnpm 9**.

```bash
# from repo root
pnpm install
pnpm build
```

**If `corepack enable` fails on Windows** (`EPERM` under `C:\Program Files\nodejs`):

```powershell
# Option A — install pnpm into your user profile (no admin)
iwr https://get.pnpm.io/install.ps1 -useb | iex
# then restart the terminal and continue with pnpm install

# Option B — one-off without a global install
npx pnpm@9.15.0 install
npx pnpm@9.15.0 build
```

Do **not** need `corepack enable` if pnpm is already on your PATH.
Optional Python SDK:

```bash
cd python
pip install -e .
cd ..
```

Copy env defaults:

```bash
cp .env.example .env
```

### 2. Run the server (mock — no GPU, no API key)

```bash
# mock backend is the default
pnpm --filter @kev-ai/server start
# or during development:
pnpm --filter @kev-ai/server dev
```

Server listens on `http://127.0.0.1:3000`.

Check health:

```bash
curl http://127.0.0.1:3000/health
```

### 3. Make a decision

```bash
curl -s http://127.0.0.1:3000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{
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
      "escalate": {
        "type": "noul",
        "instructions": "Escalate to a human now?"
      }
    }
  }'
```

Or use the CLI (after build):

```bash
pnpm --filter @kev-ai/cli exec kev demo
# or once linked: kev demo
```

---

## Real models (Phase 1 backends)

### Option A — Ollama (local, recommended)

1. Install [Ollama](https://ollama.com) and pull a model:

```bash
ollama pull llama3.2
```

2. Configure and start Kev:

```bash
# .env
KEV_BACKEND=ollama
KEV_OLLAMA_BASE_URL=http://127.0.0.1:11434
KEV_OLLAMA_MODEL=llama3.2
KEV_STRATEGY=auto
```

```bash
pnpm --filter @kev-ai/server start
```

Ollama does not expose OpenAI-style token logprobs, so Kev auto-selects **constrained JSON** (or **parallel micro-score**). You still get typed probabilities you can threshold in code.

### Option B — OpenAI-compatible API

Works with OpenAI, vLLM, Together, Groq, Fireworks, etc.

```bash
# .env
KEV_BACKEND=openai
KEV_OPENAI_BASE_URL=https://api.openai.com/v1
KEV_OPENAI_API_KEY=sk-...
KEV_OPENAI_MODEL=gpt-4o-mini
KEV_STRATEGY=auto
```

When the provider returns `top_logprobs`, Kev uses **letter-token readout** (one forward pass per question). If logprobs are rejected, it falls back automatically.

### Option C — Docker

```bash
# mock (default)
docker compose -f docker/docker-compose.yml up --build

# Ollama on the host (Docker Desktop)
KEV_BACKEND=ollama docker compose -f docker/docker-compose.yml up --build
```

---

## Decision primitives

| Type | When to use | Returns |
| --- | --- | --- |
| `choice` | Pick one labelled option (≤255) | `choice`, `probabilities`, `confidence` |
| `score` | Ordered scale, 2–10 levels | weighted `score`, `probabilities`, `confidence` |
| `noul` | Yes / no gate | `noul` ∈ [0, 1] (P(yes)) |

Ask many questions in one request — they run in parallel and share the state.

### Strategies (`KEV_STRATEGY`)

| Value | Behavior |
| --- | --- |
| `auto` (default) | Prefer readout → constrained → parallel based on backend caps |
| `readout` | Single-token letter scores + calibration softmax |
| `constrained` | Force JSON `{"choice","confidence"}` |
| `parallel` | One micro `{p}` call per option, then softmax |
| `mock` | Deterministic heuristics (no LLM) |

Calibration profiles live in `models/calibration/` (`default`, `sharp`, `soft`). Set `KEV_CALIBRATION_PROFILE=sharp` and/or tune `KEV_READOUT_TEMPERATURE` / `KEV_NOUL_TEMPERATURE`.

---

## SDKs

### TypeScript

```ts
import { Choice, KevClient, Noul, Score } from "@kev-ai/sdk";

const client = new KevClient({ baseUrl: "http://127.0.0.1:3000" });

const res = await client.systemOne({
  state: "Charged twice, furious.",
  questions: {
    topic: Choice("Team?", {
      billing: "charges",
      technical: "bugs",
    }),
    escalate: Noul("Escalate now?"),
  },
});

if (res.answers.topic?.type === "choice") {
  console.log(res.answers.topic.choice, res.answers.topic.confidence);
}
```

Env vars the client understands: `KEV_BASE_URL`, `KEV_API_KEY`, `KEV_MODEL`  
(also reads `TYPESAFE_BASE_URL` / `TYPESAFE_API_KEY` for Jev-client compatibility).

### Python

```python
from kev import KevClient, Choice, Noul

client = KevClient(base_url="http://127.0.0.1:3000")
res = client.system_one(
    state="Charged twice, furious.",
    questions={
        "topic": Choice("Team?", {"billing": "charges", "technical": "bugs"}),
        "escalate": Noul("Escalate now?"),
    },
)
print(res.answers["topic"].choice)
print(res.answers["escalate"].noul)
```

---

## Examples

With the server running (`KEV_BACKEND=mock` is enough to smoke-test):

```bash
# TypeScript (needs pnpm build first)
pnpm exec tsx examples/ticket-routing/run.ts
pnpm exec tsx examples/moderation-gate/run.ts
pnpm exec tsx examples/rag-groundedness/run.ts

# Python
python examples/ticket-routing/run.py
```

| Example | Idea |
| --- | --- |
| `examples/ticket-routing` | Route + severity + escalate |
| `examples/moderation-gate` | Spam/scam gate with allow/hold/block |
| `examples/rag-groundedness` | Judge whether an answer is grounded in context |

---

## API reference

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness + backend info |
| `GET` | `/openapi.json` | OpenAPI 3.1 document |
| `POST` | `/v1/systemone` | Evaluate questions |

Optional auth: set `KEV_API_KEY` on the server and send `Authorization: Bearer <key>`.

Full field docs: open `http://127.0.0.1:3000/openapi.json` or see `packages/schema/src/openapi.ts`.

---

## Repo layout

```
apps/server          Hono Decision API
packages/schema      Zod schemas + OpenAPI
packages/core        Readout / calibration / engine
packages/backends    mock · ollama · openai-compatible
packages/sdk-ts      TypeScript client (@kev-ai/sdk)
packages/cli         kev CLI
python/kev           Python SDK
models/calibration   Calibration JSON profiles
examples/            End-to-end recipes
docker/              Dockerfile + compose
plan.md              Product / roadmap
```

---

## Scripts

```bash
pnpm install          # install workspace deps
pnpm build            # build all packages
pnpm typecheck        # TypeScript check
pnpm test             # unit tests (schema, core, backends)
pnpm dev              # server in watch mode
```

Load config from a root `.env` (copy from `.env.example`). The server walks up from the current directory to find it.

---

## Environment variables

See [`.env.example`](.env.example).

| Variable | Default | Meaning |
| --- | --- | --- |
| `KEV_BACKEND` | `mock` | `mock` \| `ollama` \| `openai` |
| `KEV_HOST` / `KEV_PORT` | `0.0.0.0` / `3000` | Bind address |
| `KEV_STRATEGY` | `auto` | Decision strategy |
| `KEV_OLLAMA_*` | — | Local Ollama |
| `KEV_OPENAI_*` | — | OpenAI-compatible provider |
| `KEV_API_KEY` | empty | If set, require Bearer auth |
| `KEV_CALIBRATION_PROFILE` | `default` | `default` \| `sharp` \| `soft` |

---

## Compatibility notes

- Request/response shapes follow the System One / Jev Decision API (`state` + `questions` → `answers` + `usage`).
- Point Jev-oriented clients at Kev with `TYPESAFE_BASE_URL=http://127.0.0.1:3000` (and optional `TYPESAFE_API_KEY`).
- Kev extensions: `trace: true` on the request returns per-question strategy/backend metadata.
- **No training** in this release. Kev is inference + API only.

---

## License

Apache-2.0 — see [LICENSE](LICENSE).

---

## Roadmap

Phase 0–1 are implemented in this tree. Next (see [`plan.md`](plan.md)): batch API, MCP server, playground UI, deeper eval harness.
