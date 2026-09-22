# Kev

**Typed decisions for software.**  
Send context. Ask `choice`, `score`, or `noul`. Get calibrated probabilities back — not a paragraph to parse.

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

Then your code does the simple thing:

```ts
if (answers.escalate.noul > 0.7) routeToHuman();
else assign(answers.topic.choice);
```

Kev is an open-source **System One** decision engine: Apache-2.0, self-hosted, compatible with the Jev-style wire format. Bring your own model (Ollama, vLLM, OpenAI-compatible) — or start with the built-in mock for offline demos.

> Independent project. Not affiliated with TypeSafe AI or OpenJev.

---

## Why Kev

| You want… | Chat LLMs give you… | Kev gives you… |
| --- | --- | --- |
| A label | Prose you must parse | A typed key + distribution |
| A gate | “Yes, I think so…” | `noul` ∈ [0, 1] you can threshold |
| Confidence | Vibes | Concentration of the distribution |
| Many judgments | N serial prompts | One round trip, questions in parallel |
| Control | Vendor lock-in | Your GPU / your API key / your laptop |

---

## Install

**Requirements:** Node 20+, [pnpm](https://pnpm.io) 9.

```bash
git clone https://github.com/arjun988/Kev.git
cd Kev
pnpm install
pnpm build
cp .env.example .env
pnpm --filter @kev-ai/server start
```

Open the playground: [http://127.0.0.1:3000/playground/](http://127.0.0.1:3000/playground/)

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

## 60-second TypeScript

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

console.log(res.answers);
```

## 60-second Python

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

---

## How it works

```text
┌────────────┐     POST /v1/systemone      ┌──────────────┐
│  Your app  │  ─────────────────────────► │  Kev server  │
│  SDK / CLI │  state + questions          │  validate    │
└────────────┘  ◄───────────────────────── │  decide      │
                   typed answers + probs   └──────┬───────┘
                                                  │
                         ┌────────────────────────┼────────────────────────┐
                         ▼                        ▼                        ▼
                   logprob readout          constrained JSON         parallel micro-score
                   (when available)         (JSON mode)              (fallback)
                         └────────────────────────┬────────────────────────┘
                                                  ▼
                                        Ollama · vLLM · OpenAI-compatible · mock
```

**Strategies** (`KEV_STRATEGY=auto` by default):

1. **Readout** — map options to letters, read first-token logprobs, calibrate with softmax  
2. **Constrained** — force a valid JSON choice  
3. **Parallel** — score each option with a tiny `{ "p": 0..1 }` call, then normalize  

---

## Features

- **System One primitives** — `choice` (≤255), `score` (2–10 levels), `noul` (yes probability)
- **Batch API** — `POST /v1/systemone/batch`
- **Self-host DX** — Docker, playground UI, OpenAPI at `/openapi.json`
- **Production knobs** — optional API keys, rate limits, LRU cache, audit log, OTel-style spans
- **Agent-ready** — MCP server, LangChain / LlamaIndex adapters, screenshot `images[]` in state
- **Scale taxonomies** — `cascadeChoice()` for &gt;255 options
- **Measure it** — eval harness, option-order stability, published benchmark fixture

---

## Backends

| `KEV_BACKEND` | Use when |
| --- | --- |
| `mock` | Offline demos & CI (default) |
| `ollama` | Local models (`ollama pull llama3.2`) |
| `openai` | OpenAI, vLLM, Groq, Together, MLX servers, … |

Model recipes: [`models/cards/`](models/cards/README.md)

```env
KEV_BACKEND=ollama
KEV_OLLAMA_MODEL=llama3.2
```

---

## Clients & tools

| Thing | Package / path |
| --- | --- |
| HTTP API | `@kev-ai/server` |
| TypeScript SDK | `@kev-ai/sdk` |
| CLI | `@kev-ai/cli` → `kev ask` · `kev demo` · `kev eval` |
| Python | `python/kev` |
| MCP | `@kev-ai/mcp` |
| Adapters | `@kev-ai/adapters` |
| Recipes | [`awesome-kev/`](awesome-kev/README.md) |
| Snippets | [`.vscode/kev.code-snippets`](.vscode/kev.code-snippets) |

```bash
pnpm --filter @kev-ai/cli exec kev demo
pnpm --filter @kev-ai/cli exec kev eval stability --trials 20
```

---

## Benchmarks

Honest, reproducible fixtures — not marketing slides.

```bash
pnpm bench
# or: pnpm exec tsx benchmarks/run.ts --mode api --base-url http://127.0.0.1:3000
```

- Methodology (how to compare with OpenJev / chat / hosted Jev): [`benchmarks/METHODOLOGY.md`](benchmarks/METHODOLOGY.md)
- Published reference table: [`benchmarks/RESULTS.md`](benchmarks/RESULTS.md)

Same questions. One attempt. Pin your commit and model id.

---

## Migrating from Jev

Change the base URL. Re-tune thresholds on your labels.

Full guide: [`MIGRATION.md`](MIGRATION.md)

```bash
export TYPESAFE_BASE_URL=http://127.0.0.1:3000   # TypeSafe SDKs
# or
export KEV_BASE_URL=http://127.0.0.1:3000
```

---

## Project layout

```text
apps/server       Decision API
apps/playground   Local UI
apps/mcp          MCP server
packages/*        schema · core · backends · sdk · cli · eval · adapters
python/kev        Python client
benchmarks/       Frozen fixtures + runner
awesome-kev/      Curated recipes
models/           Calibration profiles · model cards · dataset schema
```

---

## Versioning

**Kev 1.0** freezes the System One HTTP shape in `GET /openapi.json`.

- **MAJOR** — breaking wire changes  
- **MINOR** — additive endpoints / fields  
- **PATCH** — fixes and docs  

See [`CHANGELOG.md`](CHANGELOG.md).

---

## License

[Apache-2.0](LICENSE)

---

<p align="center">
  <b>Kev</b> — decisions software can trust.<br/>
  <sub>Ask for a label. Get a distribution.</sub>
</p>
