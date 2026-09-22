import { serve } from "@hono/node-server";
import { createApp, VERSION } from "./app.js";
import { loadEnv } from "./config.js";
import { createLogger } from "./logger.js";

export function main(): void {
  const env = loadEnv();
  const logger = createLogger(env.KEV_LOG_LEVEL);
  const app = createApp({ env, logger });

  logger.info("kev_starting", {
    version: VERSION,
    host: env.KEV_HOST,
    port: env.KEV_PORT,
    backend: env.KEV_BACKEND,
  });

  serve(
    {
      fetch: app.fetch,
      hostname: env.KEV_HOST,
      port: env.KEV_PORT,
    },
    (info) => {
      logger.info("kev_listening", {
        url: `http://${info.address}:${info.port}`,
        health: `http://${info.address}:${info.port}/health`,
        systemone: `http://${info.address}:${info.port}/v1/systemone`,
      });
    },
  );
}

export { createApp, VERSION } from "./app.js";
export { loadEnv } from "./config.js";
