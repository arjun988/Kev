export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(level: LogLevel) {
  const min = LEVEL_ORDER[level];

  function write(lvl: LogLevel, msg: string, extra?: Record<string, unknown>) {
    if (LEVEL_ORDER[lvl] < min) return;
    const line = {
      ts: new Date().toISOString(),
      level: lvl,
      msg,
      ...extra,
    };
    const out = JSON.stringify(line);
    if (lvl === "error") console.error(out);
    else console.log(out);
  }

  return {
    debug: (msg: string, extra?: Record<string, unknown>) =>
      write("debug", msg, extra),
    info: (msg: string, extra?: Record<string, unknown>) =>
      write("info", msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) =>
      write("warn", msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) =>
      write("error", msg, extra),
  };
}

export type Logger = ReturnType<typeof createLogger>;
