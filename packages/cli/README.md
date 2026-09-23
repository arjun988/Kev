# @kev-ai/cli

CLI and MCP server for **NotJev : Kev**.

```bash
npm install -g @kev-ai/cli
kev health
kev demo
kev-mcp   # MCP stdio server (needs @kev-ai/server running)
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
