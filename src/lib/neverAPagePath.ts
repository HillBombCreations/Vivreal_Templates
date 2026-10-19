/**
 * Paths that can never be a Vivreal page, answered 404 by middleware before
 * any site data is read.
 *
 * WHY: during a VR_Client_API outage `getSiteData()` holds
 * `FALLBACK_SITE_DATA`, and the page layer deliberately answers 5xx rather
 * than 404 (`./api/siteData/degraded.ts`), so an outage can never deindex a
 * live page. Correct for a plausible slug. For a scanner probe such as
 * `/ebkid.php` it turns a harmless miss into a 500: on 2026-10-17 two customer
 * sites answered 131 probes with 500 in one 17 minute outage
 * (vivreal-hq docs/projects/next-release-v7/research-site-5xx-2026-10-17.md).
 * A path in this list cannot be a page whatever the data says, so its 404
 * needs no data.
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
 *     page slug or authored redirect `from` contains one (census
 *     2026-10-19: 511 slugs and 366 redirects across all 24 site documents,
 *     zero matches, zero slugs with a `.` at all).
 *   - Directory names match the WHOLE first segment, so a page slugged
 *     `wp-engine-review` or `cgi-bin-guide` still renders. `/wp-*` is
 *     deliberately not a blanket prefix: `nameToSlug("WP Engine")` is
 *     `wp-engine`, a slug the portal will produce.
 *   - Prefixes match the START of the first segment and are limited to
 *     dot-files and `wp-config`, none of which the portal's `nameToSlug` can
 *     produce (it emits `[a-z0-9-]` only). `.well-known` is not listed, it is
 *     a real route.
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
// `.git/config`, `.gitignore`, `.github`; `wp-config` covers
// `wp-config.php.bak` and the other backup suffixes scanners try.
const PROBE_FIRST_SEGMENT_PREFIXES: readonly string[] = Object.freeze(['.env', '.git', 'wp-config']);

/**
 * True when `pathname` (a URL pathname, as `request.nextUrl.pathname` gives
 * it) can never be served by a Vivreal page or code route. Case-insensitive,
 * since scanners vary case and no real route depends on it.
 */
export function isNeverAPagePath(pathname: string): boolean {
  const segments = pathname.toLowerCase().split('/').filter(Boolean);
  if (segments.length === 0) return false;

  const first = segments[0];
  if (PROBE_FIRST_SEGMENTS.has(first)) return true;
  if (PROBE_FIRST_SEGMENT_PREFIXES.some((prefix) => first.startsWith(prefix))) return true;

  return segments.some((segment) =>
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
