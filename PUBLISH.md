# Publishing NotJev : Kev

Public registries (only these):

| Registry | Package | Install |
| --- | --- | --- |
| npm | `@kev-ai/sdk` | `npm i @kev-ai/sdk` |
| npm | `@kev-ai/server` | `npm i -g @kev-ai/server` |
| npm | `@kev-ai/cli` | `npm i -g @kev-ai/cli` |
| PyPI | `kev` | `pip install kev` |

Internal (`schema`, `core`, `backends`, `eval`, `adapters`, `mcp`) stay **private** and are bundled into the three npm packages.

## One-time setup

1. npm account + join org **`kev-ai`** (Owner/Publish).
2. `npm login` (OTP if 2FA).
3. Confirm scope: `npm org ls kev-ai`
4. PyPI account (+ API token). Optional: `pip install build twine`

## Publish npm (order matters)

Working tree can be dirty — scripts use `--no-git-checks`. Prefer committing the publish prep first when you can.

```bash
cd Kev
pnpm install
pnpm build

# 1) SDK first (CLI depends on it)
pnpm publish:sdk

# 2) Server
pnpm publish:server

# 3) CLI (+ kev-mcp bin)
pnpm publish:cli
```

Or all three after a successful build:

```bash
pnpm publish:npm
```

`pnpm publish` rewrites `workspace:*` → real versions in the tarball.

Dry-run first:

```bash
pnpm --filter @kev-ai/sdk pack
pnpm --filter @kev-ai/server pack
pnpm --filter @kev-ai/cli pack
```

## Publish PyPI

```bash
cd python
python -m pip install build twine
python -m build
twine upload dist/*
```

Use a PyPI API token when prompted. If the name `kev` is taken, change `[project].name` in `python/pyproject.toml` (e.g. `kev-ai`) before building.

## After publish — smoke test

```bash
npm i -g @kev-ai/server @kev-ai/cli @kev-ai/sdk
kev-server          # other terminal
kev health
kev demo
pip install kev
python -c "from kev import KevClient; print(KevClient().health())"
```

## Version bumps

Bump `version` in:

- `packages/sdk-ts/package.json`
- `apps/server/package.json`
- `packages/cli/package.json` (and keep `@kev-ai/sdk` range compatible)
- `python/pyproject.toml`

Then rebuild and publish again.
