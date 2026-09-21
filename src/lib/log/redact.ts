/**
 * Redaction for anything on its way to a server log.
 *
 * H37: the edge checkout route logged the upstream response body, and on
 * success that body carries the HOSTED CHECKOUT URL. That URL is a bearer
 * capability, not an identifier: anyone who can read the log can open that
 * shopper's checkout session. Site logs are not a secrets store.
 *
 * Everything here matches on the SHAPE OF THE VALUE, never on the name of the
 * variable holding it. A name-based filter is the one that fails: this fleet
 * has already leaked a database cluster URL, password and all, past a filter
 * that was looking for names containing KEY or SECRET. The credential does not
 * know what it was called.
 *
 * The safest thing to log is a KEY NAME. `topLevelKeys` exists so a caller can
 * say what came back without saying what was in it.
 */

/**
 * Value shapes that must never appear in a log, most specific first.
 *
 * The URL rule is deliberately total. A hosted checkout URL, a signed media
 * URL and a presigned upload URL are all capabilities, and a rule narrow
 * enough to spare "our own harmless URL" is a rule that misses the next one.
 */
const SECRET_SHAPES: ReadonlyArray<RegExp> = [
  // Any absolute URL, including everything after it on the line.
  /\bhttps?:\/\/[^\s"'<>]+/gi,
  // JSON Web Tokens (three dot-joined base64url runs).
  /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+/g,
  // Stripe live/test keys, session ids, webhook secrets.
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+/gi,
  /\bcs_(?:live|test)_[A-Za-z0-9]+/gi,
  /\bwhsec_[A-Za-z0-9]+/gi,
  // Square access and refresh tokens.
  /\bEAAA[A-Za-z0-9_-]{8,}/g,
  /\bsq0[a-z]{3}-[A-Za-z0-9_-]{8,}/gi,
  // A bare credential pair in a connection string or query (user:pass@, =secret).
  /\b[A-Za-z0-9_.-]+:[^\s:@/]{6,}@/g,
  // Any long opaque run. Last, so the named shapes above label themselves
  // first. 24 is above every word in English and below every real token.
  /\b[A-Za-z0-9_-]{24,}\b/g,
];

export const REDACTED = "[redacted]";

/**
 * Replace every secret-shaped run in a string. Never throws, and never returns
 * a longer string than it was given plus the markers.
 */
export function redactSecrets(value: string): string {
  if (typeof value !== "string" || value === "") return value;
  let out = value;
  for (const shape of SECRET_SHAPES) {
    // Fresh lastIndex each call: these are module-level /g regexes.
    shape.lastIndex = 0;
    out = out.replace(shape, REDACTED);
  }
  return out;
}

/**
 * The top-level key names of a parsed body, for logging WHAT came back without
 * logging what was in it. Returns a stable, bounded, sorted list.
 */
export function topLevelKeys(value: unknown, limit = 20): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return [`[${value.length} items]`];
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .slice(0, limit);
}
