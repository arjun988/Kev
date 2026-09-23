import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    langchain: "src/langchain.ts",
    llamaindex: "src/llamaindex.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  outDir: "dist",
  treeshake: true,
  noExternal: ["@kev-ai/schema"],
  external: ["zod"],
});
