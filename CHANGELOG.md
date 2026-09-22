# Changelog

## 1.0.0

First stable release of the Kev Decision API and tooling.

### API

- `POST /v1/systemone` — System One decisions (`choice` / `score` / `noul`)
- `POST /v1/systemone/batch` — concurrent multi-item evaluation
- `GET /health`, `GET /openapi.json`, playground at `/playground/`
- Optional Bearer auth, rate limiting, LRU response cache, audit + OTel-style spans

### Packages

- `@kev-ai/server`, `@kev-ai/schema`, `@kev-ai/core`, `@kev-ai/backends`
- `@kev-ai/sdk`, `@kev-ai/cli`, `@kev-ai/eval`, `@kev-ai/adapters`, `@kev-ai/mcp`
- Python package `kev`

### Quality

- Eval harness + option-order stability suite
- Published benchmark fixture + methodology (`benchmarks/`)
- Model cards, awesome recipes, VS Code / Cursor snippets
- Migration guide from TypeSafe Jev (`MIGRATION.md`)

Kev does not train or ship model weights. Bring your own backend.
