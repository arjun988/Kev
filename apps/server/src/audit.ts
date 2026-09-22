import type { Logger } from "./logger.js";

export type AuditEvent = {
  ts: string;
  type: "systemone" | "batch" | "error";
  model?: string;
  backend?: string;
  questions?: number;
  items?: number;
  latency_ms?: number;
  cache_hit?: boolean;
  error?: string;
  request_id?: string;
};

/**
 * Append-only decision audit log (JSONL to stdout or a sink).
 */
export function createAuditLog(logger: Logger, enabled: boolean) {
  return {
    record(event: Omit<AuditEvent, "ts">): void {
      if (!enabled) return;
      const full: AuditEvent = { ts: new Date().toISOString(), ...event };
      logger.info("audit", full as unknown as Record<string, unknown>);
    },
  };
}

export type AuditLog = ReturnType<typeof createAuditLog>;
