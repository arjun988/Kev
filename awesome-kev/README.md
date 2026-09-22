# Awesome Kev

Curated recipes for shipping System One decisions with **Kev**.

## Recipes

| Recipe | Path | Idea |
| --- | --- | --- |
| Ticket routing | [`recipes/ticket-routing.md`](./recipes/ticket-routing.md) | choice + score + noul in one call |
| Moderation gate | [`recipes/moderation-gate.md`](./recipes/moderation-gate.md) | allow / hold / block with thresholds |
| RAG groundedness | [`recipes/rag-groundedness.md`](./recipes/rag-groundedness.md) | judge answers against retrieved context |
| Agent next step | [`recipes/agent-step.md`](./recipes/agent-step.md) | click / done from text + screenshots |
| Batch triage | [`recipes/batch-triage.md`](./recipes/batch-triage.md) | `POST /v1/systemone/batch` |
| Cascade taxonomy | [`recipes/cascade-taxonomy.md`](./recipes/cascade-taxonomy.md) | &gt;255 options |

## Editor snippets

- VS Code / Cursor: [`.vscode/kev.code-snippets`](../.vscode/kev.code-snippets)
- Cursor rules hint: [`.cursor/rules/kev.mdc`](../.cursor/rules/kev.mdc)

## Integrations

- TypeScript SDK — `@kev-ai/sdk`
- Python SDK — `pip install -e ./python`
- MCP — `apps/mcp` (`kev_systemone`)
- LangChain / LlamaIndex — `@kev-ai/adapters`

## Contributing a recipe

1. Add a short markdown file under `awesome-kev/recipes/`.
2. Include a minimal request JSON and the threshold logic in code.
3. Link it from this table.
