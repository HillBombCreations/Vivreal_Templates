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
 * VIVREAL'S OWN SITES GET A STRONGER VALUE (SEC-1 F455, vivreal-hq
 * plan-sec-1.md section 5, value SEC-W2). On vivreal.io and help.vivreal.io
 * only (`isVivrealOwnSite`, the same site id gate as the consent banner and
 * the beacon), the Google tag source narrows to the one script the tag needs,
 * `/gtag/js`, so the Tag Manager loader `/gtm.js` is refused, and a
 * `connect-src` lists every address our own pages send to, so a hostile
 * script cannot upload to its own server. Every other site keeps SW-A21 byte
 * for byte: `headers()` runs before any site data is read, so a customer's
 * own vendors cannot be known here, and a list that guessed would break them.
 * Still report-only; release A R-A11 enforces it on our own sites once it has
 * seven report-only days with every report explained.
 *
 * WHERE THE REPORTS GO. Sentry's security endpoint for this site's project,
 * built at build time from `NEXT_PUBLIC_SENTRY_DSN`. No DSN means no header:
 * a policy with nowhere to report teaches nobody anything. The enforce step
 * (release A R-A11, on an owner GO) renames the header to
 * `Content-Security-Policy`; hosts are added only by the owners at that GO.
 *
 * Pure (no `next/*`), so `next.config.ts` and the plain-Node runner both load
 * it, and so is everything it imports.
 */

import { beaconEndpoint } from './beaconEndpoint.ts';
import { domainSearchApiBase } from './domains/publicSearch.ts';
import { isVivrealOwnSite } from './vivrealApex.ts';

export const SCRIPT_POLICY_REPORT_ONLY_HEADER = 'Content-Security-Policy-Report-Only';

/** SW-A21's directives, byte for byte, up to the report endpoint. Every customer site sends exactly this. */
const SCRIPT_POLICY_DIRECTIVES =
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.clarity.ms https://*.clarity.ms https://plausible.io https://cdn.usefathom.com https://www.instagram.com; object-src 'none'; base-uri 'none'; form-action 'self'";

/**
 * SEC-W2's script sources: SW-A21's, with the Google tag narrowed to the exact
 * path `/gtag/js` (plan 5.1: the served tag needs nothing else; the directory
 * form `/gtag/` is the fallback if the report-only days show otherwise).
 */
const OWN_SCRIPT_SOURCES: readonly string[] = Object.freeze([
  "'self'",
  "'unsafe-inline'",
  'https://www.googletagmanager.com/gtag/js',
  'https://*.google-analytics.com',
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://www.clarity.ms',
  'https://*.clarity.ms',
  'https://plausible.io',
  'https://cdn.usefathom.com',
  'https://www.instagram.com',
]);

/**
 * SEC-W2's outside send addresses, after `'self'`, the beacon, domain search
 * and Sentry (plan 5.2 gives the evidence for each). Google's tag and Ads,
 * then Clarity. Deliberately never `*.google.com`, which admits anyone's Apps
 * Script and Forms endpoints; a Google host this misses is what the
 * report-only days find.
 */
const OWN_VENDOR_CONNECT_SOURCES: readonly string[] = Object.freeze([
  'https://www.googletagmanager.com',
  'https://*.google-analytics.com',
  'https://analytics.google.com',
  'https://*.analytics.google.com',
  'https://stats.g.doubleclick.net',
  'https://www.google.com',
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://pagead2.googlesyndication.com',
  'https://ad.doubleclick.net',
  'https://adservice.google.com',
  'https://*.clarity.ms',
  'https://c.bing.com',
]);

/** The directives after script and connect, the same on every site. */
const SHARED_TAIL_DIRECTIVES = "object-src 'none'; base-uri 'none'; form-action 'self'";

/** A Sentry public key: letters and digits only, so it can never break out of the header value. */
const PUBLIC_KEY = /^[A-Za-z0-9]+$/;
/** The DSN's path is exactly `/<project id>`; a path prefix would point the endpoint somewhere else. */
const PROJECT_PATH = /^\/(\d+)$/;
/** An origin safe to write into the header: https, a plain host name, an optional port. */
const HEADER_SAFE_HTTPS_ORIGIN = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::\d+)?$/;

type SentryDsn = { host: string; project: string; publicKey: string };

/** The DSN's host, project and PUBLIC key, or null for a missing or malformed DSN. */
function parseSentryDsn(dsn: string | undefined): SentryDsn | null {
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
  return { host: url.host, project: project[1], publicKey: url.username };
}

/** The report endpoint for a parsed DSN. */
function securityEndpoint(sentry: SentryDsn): string {
  return `https://${sentry.host}/api/${sentry.project}/security/?sentry_key=${sentry.publicKey}`;
}

/**
 * `https://<dsn host>/api/<project id>/security/?sentry_key=<public key>`, or
 * null for a missing or malformed DSN. Only the PUBLIC key is ever read: a
 * legacy DSN's secret part (`https://public:secret@host/1`) never reaches a
 * header every visitor can read.
 */
export function sentrySecurityEndpoint(dsn: string | undefined): string | null {
  const sentry = parseSentryDsn(dsn);
  return sentry ? securityEndpoint(sentry) : null;
}

/**
 * The origin of an address the browser code sends to, for `connect-src`.
 * Throws when it is not an absolute https address with a plain host: that
 * fails the own site's build when the config is evaluated, which beats a
 * policy that silently names an address the code does not use. Only an
 * override can reach the throw; the defaults are fixed https addresses.
 */
function connectOrigin(setting: string, address: string): string {
  const refusal = `${setting} is not an absolute https address (${JSON.stringify(address)}), so the own-site script policy cannot name it`;
  let origin: string;
  try {
    origin = new URL(address).origin;
  } catch (error) {
    throw new Error(refusal, { cause: error });
  }
  if (!HEADER_SAFE_HTTPS_ORIGIN.test(origin)) throw new Error(refusal);
  return origin;
}

/** SEC-W2 up to the report endpoint, its Sentry source the same host the reports go to. */
function ownSiteDirectives(sentryHost: string): string {
  const connectSources = [
    "'self'",
    connectOrigin('NEXT_PUBLIC_ANALYTICS_ENDPOINT', beaconEndpoint()),
    connectOrigin('NEXT_PUBLIC_DOMAINS_API', domainSearchApiBase()),
    `https://${sentryHost}`,
    ...OWN_VENDOR_CONNECT_SOURCES,
  ];
  return `script-src ${OWN_SCRIPT_SOURCES.join(' ')}; connect-src ${connectSources.join(' ')}; ${SHARED_TAIL_DIRECTIVES}`;
}

/**
 * The header list `next.config.ts` adds on every route: the policy, or nothing
 * without a DSN. `siteId` is the build's `SITE_ID`: Vivreal's own two sites get
 * SEC-W2, anything else (unset, `preview`, any customer id) gets SW-A21.
 * Required, so a caller that forgets it does not compile.
 */
export function scriptPolicyHeaders(
  dsn: string | undefined,
  siteId: string | undefined,
): Array<{ key: string; value: string }> {
  const sentry = parseSentryDsn(dsn);
  if (!sentry) return [];
  const directives = isVivrealOwnSite(siteId) ? ownSiteDirectives(sentry.host) : SCRIPT_POLICY_DIRECTIVES;
  return [{ key: SCRIPT_POLICY_REPORT_ONLY_HEADER, value: `${directives}; report-uri ${securityEndpoint(sentry)}` }];
}
