/** Structured JSON logger that redacts likely secrets. No deps. */
const SECRET_KEY = /(key|token|secret|password|authorization|cookie)/i;

function redact(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") {
    // redact long opaque strings that look like credentials
    return v.length > 24 && /^[A-Za-z0-9._-]+$/.test(v) ? `${v.slice(0, 4)}…[redacted]` : v;
  }
  if (Array.isArray(v)) return v.map(redact);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(val);
    }
    return out;
  }
  return v;
}

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(service: string, level: Level = "info") {
  const min = ORDER[level];
  const emit = (lvl: Level, msg: string, meta?: Record<string, unknown>) => {
    if (ORDER[lvl] < min) return;
    const line = { ts: new Date().toISOString(), level: lvl, service, msg, ...(meta ? { meta: redact(meta) } : {}) };
    const s = JSON.stringify(line);
    if (lvl === "error") console.error(s);
    else if (lvl === "warn") console.warn(s);
    else console.log(s);
  };
  return {
    debug: (m: string, meta?: Record<string, unknown>) => emit("debug", m, meta),
    info: (m: string, meta?: Record<string, unknown>) => emit("info", m, meta),
    warn: (m: string, meta?: Record<string, unknown>) => emit("warn", m, meta),
    error: (m: string, meta?: Record<string, unknown>) => emit("error", m, meta),
  };
}
export type Logger = ReturnType<typeof createLogger>;
