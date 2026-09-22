# Migrating from Jev (TypeSafe) to Kev

Kev speaks the same System One contract: `state` + typed `questions` → calibrated `answers`. Most clients work by changing the base URL.

## 1. Point the client at Kev

| TypeSafe / Jev | Kev |
| --- | --- |
| `https://api.typesafe.ai` | `http://127.0.0.1:3000` (or your host) |
| `TYPESAFE_API_KEY` | `KEV_API_KEY` (optional; only if you set it on the server) |
| `TYPESAFE_BASE_URL` | also read by the Kev SDK as a fallback |

```bash
export TYPESAFE_BASE_URL=http://127.0.0.1:3000
# or
export KEV_BASE_URL=http://127.0.0.1:3000
```

Official TypeSafe SDKs that only need a base URL + Bearer token can target Kev’s `POST /v1/systemone`.

## 2. Request / response parity

Supported on both:

- `choice` — criteria map, returns `choice`, `probabilities`, `confidence`
- `score` — ordered criteria array, returns weighted `score`, `probabilities`, `confidence`
- `noul` — yes probability in `[0, 1]`

Kev accepts `model: "jev-latest"` as an alias and resolves it to the configured backend model id.

## 3. Differences to expect

| Topic | Jev | Kev |
| --- | --- | --- |
| Weights | Hosted proprietary model | Bring your own (Ollama, vLLM, OpenAI-compatible) or mock |
| Latency / accuracy | Vendor SLA | Depends on your model + hardware |
| Auth | Required API key | Optional `KEV_API_KEY` |
| Extensions | — | `trace`, `no_cache`, `POST /v1/systemone/batch`, `images[]` in state |
| License | Proprietary service | Apache-2.0 software |

Probabilities will **not** match Jev bit-for-bit. Re-tune thresholds on your labels.

## 4. Suggested cutover

1. Run Kev with `KEV_BACKEND=mock` and replay a few production payloads.
2. Switch to Ollama or your OpenAI-compatible endpoint.
3. Run `benchmarks/run.ts` and `kev eval stability` on a held-out set.
4. Shadow traffic: send copies to Kev, compare disagreement rate.
5. Flip `BASE_URL` when disagreement + latency are acceptable.

## 5. TypeScript

```ts
import { KevClient, Choice, Noul } from "@kev-ai/sdk";

const client = new KevClient({ baseUrl: process.env.KEV_BASE_URL });
```

## 6. Python

```python
from kev import KevClient, Choice, Noul

client = KevClient(base_url="http://127.0.0.1:3000")
```

## 7. Versioning

Kev **1.0** freezes the System One wire shape described in OpenAPI (`GET /openapi.json`). Semver:

- **MAJOR** — breaking request/response changes
- **MINOR** — additive fields / endpoints
- **PATCH** — fixes, docs, non-wire changes
