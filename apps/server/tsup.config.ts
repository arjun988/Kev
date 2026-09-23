import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node20",
    outDir: "dist",
    treeshake: true,
    noExternal: [/^@kev-ai\//],
    external: ["hono", "@hono/node-server", "dotenv", "zod"],
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: false,
    target: "node20",
    outDir: "dist",
    treeshake: true,
    noExternal: [/^@kev-ai\//],
    external: ["hono", "@hono/node-server", "dotenv", "zod"],
  },
]);
