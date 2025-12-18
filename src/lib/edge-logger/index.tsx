type Fields = Record<string, unknown>;

function write(level: "debug" | "info" | "warn" | "error", msg: string, fields: Fields = {}) {
  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  };
  console.log(JSON.stringify(entry));
}

export const edgeLogger = {
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  info:  (msg: string, fields?: Fields) => write("info", msg, fields),
  warn:  (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};