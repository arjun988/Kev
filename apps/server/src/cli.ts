#!/usr/bin/env node
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function loadNearestEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      config({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to default dotenv lookup
  config();
}

loadNearestEnv();

const { main } = await import("./index.js");
main();
