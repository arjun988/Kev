/**
 * Lightweight OpenTelemetry-style hooks without a hard OTEL dependency.
 * Emits span-like JSON when KEV_OTEL=1; otherwise no-ops aside from callback.
 */
export type SpanAttrs = Record<string, string | number | boolean | undefined>;

export type Telemetry = {
  startSpan: (name: string, attrs?: SpanAttrs) => {
    end: (attrs?: SpanAttrs) => void;
    setError: (err: unknown) => void;
  };
};

export function createTelemetry(enabled: boolean, log: (line: object) => void): Telemetry {
  if (!enabled) {
    return {
      startSpan: () => ({
        end: () => undefined,
        setError: () => undefined,
      }),
    };
  }

  return {
    startSpan(name, attrs) {
      const start = Date.now();
      let error: string | undefined;
      log({
        otel: "span_start",
        name,
        ...attrs,
        ts: new Date().toISOString(),
      });
      return {
        end(endAttrs) {
          log({
            otel: "span_end",
            name,
            duration_ms: Date.now() - start,
            error,
            ...attrs,
            ...endAttrs,
            ts: new Date().toISOString(),
          });
        },
        setError(err) {
          error = err instanceof Error ? err.message : String(err);
        },
      };
    },
  };
}
