import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: true,
    target: "node20",
    outDir: "dist",
    treeshake: true,
    noExternal: [/^@kev-ai\/(eval|schema|core|backends)$/],
    external: ["@kev-ai/sdk", "zod", "@modelcontextprotocol/sdk"],
  },
  {
    entry: { mcp: "src/mcp.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: false,
    target: "node20",
    outDir: "dist",
    treeshake: true,
    external: ["@kev-ai/sdk", "zod", "@modelcontextprotocol/sdk"],
  },
]);
