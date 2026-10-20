/**
 * Scanner probe paths, answered 404 by middleware so an upstream outage
 * cannot turn them into 5xx.
 *
 * WHY: during a VR_Client_API outage `getSiteData()` holds
 * `FALLBACK_SITE_DATA`, and the page layer deliberately answers 5xx rather
 * than 404 (`./api/siteData/degraded.ts`), so an outage can never deindex a
 * live page. Correct for a plausible slug. For a scanner probe such as
 * `/ebkid.php` it turns a harmless miss into a 500: on 2026-10-17 two customer
 * sites answered 131 probes with 500 in one 17 minute outage
 * (vivreal-hq docs/projects/next-release-v7/research-site-5xx-2026-10-17.md).
 *
 * TWO RULES, because only one of them is data-free:
 *   - `isNeverAPagePath`: directory and dot-file names. These can never be a
 *     page or a redirect worth keeping, so middleware 404s them before any
 *     site data is read.
 *   - `hasProbeExtension`: a segment ending `.php/.asp/.aspx/.jsp/.cgi`. This
 *     is NOT data-free. Site_Migrator's `buildRedirectMap` writes
 *     `{ from: '/about.php', to: '/about' }` for a migrated legacy site, the
 *     301 that keeps its inbound links, so middleware reads the edge map's
 *     redirects first and 404s only when none matches (or the map is
 *     unavailable). See `middleware.ts`.
 *
 * WHAT IS SAFE TO LIST, and why every rule is exact rather than a substring:
 * neither the site schema (`slug: String`), VR_Secure_API (`slug:
 * Joi.string()`) nor the portal's manual slug field constrains a slug's
 * characters, so the guarantee comes from this list being narrow, not from
 * validation upstream. Hence:
 *   - Extensions match the END of a segment, any segment, because probes put
 *     the script mid-path too (`/magento/index.php/admin` was one of the
 *     2026-10-17 500s). No Templates route has a segment ending in one
 *     (`robots.txt`, `sitemap.xml`, `sitemaps/<n>.xml`, `llms.txt`,
 *     `favicon.ico`, `feeds/schedule.ics`, `.well-known/*`), and no stored
 *     page slug contains one (census 2026-10-19: 511 slugs across all 24 site
 *     documents, zero with a `.` at all).
 *   - Directory names match the WHOLE first segment, so a page slugged
 *     `wp-engine-review` or `cgi-bin-guide` still renders. `/wp-*` is
 *     deliberately not a blanket prefix: `nameToSlug("WP Engine")` is
 *     `wp-engine`, a slug the portal will produce. A page named exactly
 *     "WP Admin" or "cgi-bin" would also produce a listed name; the fleet has
 *     none (same census), and that trade is accepted, not impossible.
 *   - Prefixes match the START of the first segment and each ends in or
 *     starts with a `.`, which the portal's `nameToSlug` never emits (it
 *     emits `[a-z0-9-]` only). Hence `wp-config.` with the dot: bare
 *     `wp-config` would catch `/wp-configuration-guide`. `.well-known` is not
 *     listed, it is a real route.
 *   - A percent-encoded probe (`/x%2Ephp`) matches neither rule and keeps the
 *     page layer's behaviour. That fails safe.
 *
 * Plain `.ts`, no Next import, so the node test runner loads it directly.
 */

const PROBE_EXTENSIONS: readonly string[] = Object.freeze(['.php', '.asp', '.aspx', '.jsp', '.cgi']);

const PROBE_FIRST_SEGMENTS: ReadonlySet<string> = new Set([
  'wp-admin',
  'wp-content',
  'wp-includes',
  'wp-json',
  'cgi-bin',
  'phpmyadmin',
  '.aws',
  '.ssh',
  '.svn',
  '.hg',
  '.htaccess',
  '.htpasswd',
  '.ds_store',
]);

// `.env` covers `.env.local`, `.env.production`, `.envrc`; `.git` covers
// `.git/config`, `.gitignore`, `.github`; `wp-config.` covers
// `wp-config.php.bak` and the other backup suffixes scanners try.
const PROBE_FIRST_SEGMENT_PREFIXES: readonly string[] = Object.freeze(['.env', '.git', 'wp-config.']);

function pathSegments(pathname: string): string[] {
  return pathname.toLowerCase().split('/').filter(Boolean);
}

/**
 * True when `pathname` (a URL pathname, as `request.nextUrl.pathname` gives
 * it) starts with a probe directory or dot-file name, which no page, code
 * route or authored redirect can need. Data-free. Case-insensitive, since
 * scanners vary case and no real route depends on it.
 */
export function isNeverAPagePath(pathname: string): boolean {
  const segments = pathSegments(pathname);
  if (segments.length === 0) return false;

  const first = segments[0];
  if (PROBE_FIRST_SEGMENTS.has(first)) return true;
  return PROBE_FIRST_SEGMENT_PREFIXES.some((prefix) => first.startsWith(prefix));
}

/**
 * True when any segment of `pathname` ends in a server-script extension. Not
 * a page, but possibly an authored redirect's `from`, so the caller must
 * check the site's redirects before answering 404.
 */
export function hasProbeExtension(pathname: string): boolean {
  return pathSegments(pathname).some((segment) =>
    PROBE_EXTENSIONS.some((extension) => segment.endsWith(extension)),
  );
}

export const NEVER_A_PAGE_STATUS = 404;

/**
 * Byte for byte the `Cache-Control` the healthy not-found page carries on the
 * live fleet (measured 2026-10-19, comedycollectivechi.com `/ebkid.php` and
 * `/no-such-page-zz9`, both `private, no-cache, no-store, max-age=0,
 * must-revalidate`). Matching it keeps this 404 out of the Amplify CDN
 * exactly as the healthy one is, so a probe answer can never be served to
 * anyone else from cache.
 */
export const NEVER_A_PAGE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
});

export const NEVER_A_PAGE_BODY = 'Not found';
