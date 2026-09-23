<p align="center">
  <img src="https://img.shields.io/badge/license-Apache--2.0-black?style=flat-square" alt="Apache-2.0" />
  <img src="https://img.shields.io/badge/version-1.0.0-111111?style=flat-square" alt="v1.0.0" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-222?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/System%20One-choice%20%7C%20score%20%7C%20noul-0a0a0a?style=flat-square" alt="System One" />
  <a href="https://www.npmjs.com/package/@kev-ai/sdk"><img src="https://img.shields.io/npm/v/@kev-ai/sdk?style=flat-square&label=%40kev-ai%2Fsdk" alt="@kev-ai/sdk" /></a>
  <a href="https://www.npmjs.com/package/@kev-ai/server"><img src="https://img.shields.io/npm/v/@kev-ai/server?style=flat-square&label=%40kev-ai%2Fserver" alt="@kev-ai/server" /></a>
  <a href="https://www.npmjs.com/package/@kev-ai/cli"><img src="https://img.shields.io/npm/v/@kev-ai/cli?style=flat-square&label=%40kev-ai%2Fcli" alt="@kev-ai/cli" /></a>
</p>

<h1 align="center">NotJev : Kev</h1>

<p align="center">
  <b>Typed decisions for software.</b><br/>
  Send context. Ask <code>choice</code>, <code>score</code>, or <code>noul</code>.<br/>
  Get calibrated probabilities — not a paragraph to parse.
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#docs--website">Docs site</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#benchmarks">Benchmarks</a> ·
  <a href="#why-notjev--kev">Why Kev</a> ·
  <a href="#playground">Playground</a> ·
  <a href="#clients--tools">SDKs</a> ·
  <a href="MIGRATION.md">Migrate from Jev</a>
</p>

---

## Install

```bash
npm install @kev-ai/sdk
npm install -g @kev-ai/server @kev-ai/cli
```

| Package | What | npm |
| --- | --- | --- |
| **`@kev-ai/sdk`** | TypeScript client (`choice` / `score` / `noul`) | [npmjs.com/package/@kev-ai/sdk](https://www.npmjs.com/package/@kev-ai/sdk) |
| **`@kev-ai/server`** | Decision API + playground → `kev-server` | [npmjs.com/package/@kev-ai/server](https://www.npmjs.com/package/@kev-ai/server) |
| **`@kev-ai/cli`** | CLI + MCP → `kev` / `kev-mcp` | [npmjs.com/package/@kev-ai/cli](https://www.npmjs.com/package/@kev-ai/cli) |

```bash
kev-server    # http://127.0.0.1:3000  (+ /playground/)
kev demo
kev health
```

LangChain / LlamaIndex: `@kev-ai/sdk/langchain` · `@kev-ai/sdk/llamaindex`  
PyPI coming later.

---

```bash
curl -s http://127.0.0.1:3000/v1/systemone \
  -H 'Content-Type: application/json' \
  -d '{
    "state": "Charged twice. I am furious.",
    "questions": {
      "topic": {
        "type": "choice",
        "instructions": "Which team?",
        "criteria": {
          "billing": "charges and refunds",
          "technical": "bugs and outages"
        }
      },
      "escalate": {
        "type": "noul",
        "instructions": "Escalate to a human now?"
      }
    }
  }'
```

```json
{
  "answers": {
    "topic": {
      "type": "choice",
      "choice": "billing",
      "confidence": 0.97,
      "probabilities": { "billing": 0.97, "technical": 0.03 }
    },
    "escalate": { "type": "noul", "noul": 0.86 }
  }
}
```

```ts
if (answers.escalate.noul > 0.7) routeToHuman();
else assign(answers.topic.choice);
```

**NotJev : Kev** is an open-source **System One** decision engine: Apache-2.0, self-hosted, Jev-style wire format. Bring your own model (Ollama, vLLM, OpenAI-compatible) — or start with the built-in mock.

> Independent project. Not affiliated with TypeSafe AI or OpenJev.

---

## Docs & website

Product docs, benchmark write-ups, and a fixed **Try it** workbench live in the companion Next.js site (sibling repo / folder **`NotJev-Kev-Website`**):

```bash
cd ../NotJev-Kev-Website   # or clone your website repo
npm install && npm run dev
```

Routes: `/` · `/docs` · `/docs/benchmarks` · `/docs/why` · `/try` (showcase workbench).  
**GitHub** on that site always points here — engine source stays in this repo.

---

## What NotJev : Kev is

NotJev : Kev turns an LLM into a **typed classifier / gate / scorer** your app can trust:

| Primitive | Returns | Use for |
| --- | --- | --- |
| **`choice`** | Winning key + full distribution | Routing, intent, triage (≤255 options; cascade for larger) |
| **`score`** | Ordinal level + distribution | Urgency, quality, sentiment |
| **`noul`** | Probability in `[0, 1]` | Escalate? Toxic? Block? Page on-call? |

You do **not** train models. You do **not** parse chat. You threshold numbers.

---

## Why NotJev : Kev

### vs chat LLMs

| You need | Chat gives you | Kev gives you |
| --- | --- | --- |
| A label | Prose you must regex | A typed key + probabilities |
| A gate | “I think so…” | `noul` you can threshold |
| Confidence | Vibes | Concentration of the distribution |
| Many judgments | N serial prompts | One request, questions in parallel |
| Control | Vendor lock-in | Your GPU / API / laptop |

### What makes NotJev : Kev different

| | Hosted Jev / OpenJev | **NotJev : Kev** |
| --- | --- | --- |
| License | Proprietary / mixed | **Apache-2.0** |
| Deploy | Their cloud / their weights | **Self-host** anywhere |
| Models | Fixed stack | **BYO** — Ollama, vLLM, OpenAI, Gemini-compat, … |
| Wire format | System One | **Same shape** (`choice` / `score` / `noul`) |
| Offline | No | **Mock backend** for CI & demos |
| DX | API key | Playground · SDK · CLI · MCP · LangChain / LlamaIndex |
| Training | N/A for you | **None** — inference + API only |

NotJev : Kev is the open control plane. The intelligence is whatever model you point it at.

---

## Benchmarks

Same **public** held-out suite used around OpenJev: [`s1lv3rj1nx/openjev-heldout`](https://huggingface.co/datasets/s1lv3rj1nx/openjev-heldout).  
Model: **`qwen3.5:9b`** via Ollama · **100% GPU**.

| Task | Primitive | Kev | Chance | Reference |
| --- | --- | ---: | ---: | --- |
| **Banking77** | choice (77) · n=600 | **83%** | 1.3% | Jev ~**82%** held-out · JevBench **80.3%** |
| **CLINC OOS** | choice (151) · n=600 | **86%** | 0.7% | — |
| **AG News** | choice (4) · n=600 | **86.5%** | 25.0% | — |
| **SST-5** | score (5) · n=600 | **89.5%** within-1 | 20.0% | ordinal ±1 |
| **Civil Comments** | noul · n=600 | **81%** | 50.0% | — |

OpenJev’s private 10k mix (cite only): Jev **85.4%** · OpenJev **84.0%** — questions not fully public, so we don’t invent a fake score against it.

```bash
pnpm bench:heldout -- --mode api --base-url http://127.0.0.1:3000 \
  --tasks banking77,clinc_oos,ag_news,sst5,civil_comments_toxicity
```

Details: [`benchmarks/RESULTS.md`](benchmarks/RESULTS.md) · [`benchmarks/METHODOLOGY.md`](benchmarks/METHODOLOGY.md)

---

## Quick start

**Requirements:** Node 20+, [pnpm](https://pnpm.io) 9.

```bash
git clone https://github.com/arjun988/Kev.git
cd Kev
pnpm install
pnpm build
cp .env.example .env
pnpm --filter @kev-ai/server start
```

| Open | URL |
| --- | --- |
| Playground | [http://127.0.0.1:3000/playground/](http://127.0.0.1:3000/playground/) |
| Health | [http://127.0.0.1:3000/health](http://127.0.0.1:3000/health) |
| OpenAPI | [http://127.0.0.1:3000/openapi.json](http://127.0.0.1:3000/openapi.json) |

<details>
<summary>Use a real local model (Ollama)</summary>

```bash
ollama pull qwen3.5:9b   # or llama3.2, etc.
```

```env
KEV_BACKEND=ollama
KEV_OLLAMA_MODEL=qwen3.5:9b
```

Restart the server. Confirm GPU with `ollama ps` → `100% GPU`.

</details>

<details>
<summary>Windows: <code>corepack enable</code> fails with EPERM?</summary>

```powershell
iwr https://get.pnpm.io/install.ps1 -useb | iex
# restart the terminal, then pnpm install && pnpm build
```

</details>

<details>
<summary>Python SDK</summary>

```bash
cd python && pip install -e . && cd ..
```

</details>

---

## Playground

A built-in UI for support routing, moderation, content scoring, vision triage, and intent — with probability bars and raw JSON.

**→ [http://127.0.0.1:3000/playground/](http://127.0.0.1:3000/playground/)**

---

## Use it in code

Published packages (npm org **`@kev-ai`** · PyPI **`kev`**):

```bash
npm install @kev-ai/sdk
npm install -g @kev-ai/server @kev-ai/cli   # API + playground + CLI/MCP
pip install kev
```

See [`PUBLISH.md`](PUBLISH.md) if you maintain the packages.

### TypeScript

```ts
import { Choice, KevClient, Noul, Score } from "@kev-ai/sdk";

const client = new KevClient({ baseUrl: "http://127.0.0.1:3000" });

const res = await client.systemOne({
  state: "Package stuck in transit for a week. Tracking frozen.",
  questions: {
    topic: Choice("Which team?", {
      billing: "charges",
      shipping: "delivery / tracking",
      technical: "bugs",
    }),
    severity: Score("How urgent?", [
      "can wait",
      "this week",
      "today",
      "right now",
    ]),
    escalate: Noul("Page a human?"),
  },
});

console.log(res.answers.topic.choice, res.answers.escalate.noul);
```

LangChain / LlamaIndex (same package):

```ts
import { createLangChainKevTool } from "@kev-ai/sdk/langchain";
import { createLlamaIndexKevTool } from "@kev-ai/sdk/llamaindex";
```

### Python

```python
from kev import KevClient, Choice, Noul

client = KevClient(base_url="http://127.0.0.1:3000")
res = client.system_one(
    state="Charged twice. Furious.",
    questions={
        "topic": Choice("Which team?", {"billing": "charges", "technical": "bugs"}),
        "escalate": Noul("Escalate now?"),
    },
)
print(res.answers["topic"].choice, res.answers["escalate"].noul)
```

### CLI & MCP

```bash
kev-server          # Decision API + playground
kev health
kev demo
kev ask --state "Charged twice" --trace
kev-mcp             # MCP stdio (Cursor / agents)
```

```json
{
  "mcpServers": {
    "kev": {
      "command": "kev-mcp",
      "env": { "KEV_BASE_URL": "http://127.0.0.1:3000" }
    }
  }
}
```

From a clone (without global install):

```bash
pnpm --filter @kev-ai/cli exec kev demo
pnpm --filter @kev-ai/cli exec kev eval stability --trials 20
```

---

## How it works

```text
Your app  ──POST /v1/systemone──►  Kev server
   ▲         state + questions         │
   │                                   ├─ validate (schema)
   │                                   ├─ decide (strategy)
   └──── typed answers + probs ────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
        logprob readout           constrained JSON          parallel micro-score
        (when available)          (JSON mode)               (fallback)
              └──────────────────────────┬──────────────────────────┘
                                         ▼
                           Ollama · vLLM · OpenAI-compatible · mock
```

`KEV_STRATEGY=auto` picks the best path for your backend. Large choice sets cascade when needed. Optional: batch API, cache, rate limits, audit, traces.

---

## Features

- **System One primitives** — `choice` · `score` · `noul` with calibrated distributions  
- **Self-host first** — Docker-friendly, playground, OpenAPI  
- **BYO model** — mock · Ollama · any OpenAI-compatible endpoint  
- **Production knobs** — API keys, rate limits, LRU cache, audit log, OTel-style spans  
- **Agent-ready** — MCP server, LangChain / LlamaIndex adapters, `images[]` in state  
- **Scale** — `cascadeChoice()` for big taxonomies  
- **Honest eval** — held-out suite runner, stability tests, published fixtures  

---

## Backends

| `KEV_BACKEND` | When |
| --- | --- |
| `mock` | Offline demos & CI |
| `ollama` | Local GPU/CPU models |
| `openai` | OpenAI, vLLM, Groq, Together, Gemini OpenAI-compat, MLX, … |

```env
KEV_BACKEND=ollama
KEV_OLLAMA_MODEL=qwen3.5:9b
```

Model recipes: [`models/cards/`](models/cards/README.md)

---

## Clients & tools

| | Install |
| --- | --- |
| TypeScript SDK | `npm i @kev-ai/sdk` |
| Server + playground | `npm i -g @kev-ai/server` → `kev-server` |
| CLI + MCP | `npm i -g @kev-ai/cli` → `kev` / `kev-mcp` |
| Python | `pip install kev` |
| LangChain / LlamaIndex | `@kev-ai/sdk/langchain` · `@kev-ai/sdk/llamaindex` |
| Recipes | [`awesome-kev/`](awesome-kev/README.md) |
| Snippets | [`.vscode/kev.code-snippets`](.vscode/kev.code-snippets) |

Publish notes: [`PUBLISH.md`](PUBLISH.md)

---

## Migrating from Jev

Point the base URL at NotJev : Kev. Re-tune thresholds on **your** labels.

```bash
export TYPESAFE_BASE_URL=http://127.0.0.1:3000
# or
export KEV_BASE_URL=http://127.0.0.1:3000
```

Full guide: [`MIGRATION.md`](MIGRATION.md)

---

## Project layout

```text
apps/server        Decision API + playground host
apps/playground    Local workbench UI
apps/mcp           MCP server
packages/*         schema · core · backends · sdk · cli · eval · adapters
python/kev         Python client
benchmarks/        Held-out suite + fixtures
awesome-kev/       Recipes
models/            Model cards · calibration · dataset notes
```

---

## Versioning

**Kev 1.0** freezes the System One HTTP contract in `GET /openapi.json`.

| | |
| --- | --- |
| **MAJOR** | Breaking wire changes |
| **MINOR** | Additive endpoints / fields |
| **PATCH** | Fixes and docs |

See [`CHANGELOG.md`](CHANGELOG.md).

---

## License

[Apache-2.0](LICENSE)

---

<p align="center">
  <b>Kev</b> — decisions software can trust.<br/>
  <sub>Ask for a label. Get a distribution.</sub>
</p>
