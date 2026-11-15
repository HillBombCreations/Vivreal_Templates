/**
 * F173 (release A T-2; owner decision ND-29 a; plan SW-A21): the allowed-sites
 * script policy, sent REPORT-ONLY on every route.
 *
 * WHY A HOST LIST AND NOT A NONCE. Content pages are ISR: they are rendered
 * with no request, and Next reads a nonce only from the request's own policy
 * header, so a cached page carries none. A nonce policy would report (and,
 * once enforced, block) Next's own inline scripts on every cached page. A
 * host list travels with the cached HTML. It stops outside script hosts,
 * `<base>` and plugin tricks, and form posts to other sites; it does NOT stop
 * an inline injected script, which is why the renderer's sanitizer stays the
 * first layer (its corpus test, renderer REN-4).
 *
 * WHERE THE REPORTS GO. Sentry's security endpoint for this site's project,
 * built at build time from `NEXT_PUBLIC_SENTRY_DSN`. No DSN means no header:
 * a policy with nowhere to report teaches nobody anything. The enforce step
 * (release A R-A11, on an owner GO) renames the header to
 * `Content-Security-Policy`; hosts are added only by the owners at that GO.
 *
 * Pure (no `next/*`), so `next.config.ts` and the plain-Node runner both load it.
 */

export const SCRIPT_POLICY_REPORT_ONLY_HEADER = 'Content-Security-Policy-Report-Only';

/** SW-A21's directives, byte for byte, up to the report endpoint. */
const SCRIPT_POLICY_DIRECTIVES =
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.clarity.ms https://*.clarity.ms https://plausible.io https://cdn.usefathom.com https://www.instagram.com; object-src 'none'; base-uri 'none'; form-action 'self'";

/** A Sentry public key: letters and digits only, so it can never break out of the header value. */
const PUBLIC_KEY = /^[A-Za-z0-9]+$/;
/** The DSN's path is exactly `/<project id>`; a path prefix would point the endpoint somewhere else. */
const PROJECT_PATH = /^\/(\d+)$/;

/**
 * `https://<dsn host>/api/<project id>/security/?sentry_key=<public key>`, or
 * null for a missing or malformed DSN. Only the PUBLIC key is ever read: a
 * legacy DSN's secret part (`https://public:secret@host/1`) never reaches a
 * header every visitor can read.
 */
export function sentrySecurityEndpoint(dsn: string | undefined): string | null {
  const raw = dsn?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not a URL, so not a DSN: the same answer as no DSN, no header.
    return null;
  }
  if (url.protocol !== 'https:' || !PUBLIC_KEY.test(url.username) || url.search || url.hash) return null;
  const project = PROJECT_PATH.exec(url.pathname);
  if (!project) return null;
  return `https://${url.host}/api/${project[1]}/security/?sentry_key=${url.username}`;
}

/** The header list `next.config.ts` adds on every route: the policy, or nothing without a DSN. */
export function scriptPolicyHeaders(dsn: string | undefined): Array<{ key: string; value: string }> {
  const endpoint = sentrySecurityEndpoint(dsn);
  if (!endpoint) return [];
  return [{ key: SCRIPT_POLICY_REPORT_ONLY_HEADER, value: `${SCRIPT_POLICY_DIRECTIVES}; report-uri ${endpoint}` }];
}
