import type { SiteData } from '@/types/SiteData';
// Relative + explicit `.ts` extension (not the `@/` alias): this module is
// imported directly by ogImage.test.ts/routeMetadata.test.ts under
// `node --experimental-strip-types --test`, which has no tsconfig `paths`
// resolution — same convention routeMetadata.ts already follows.
import { isDemoSite } from '../seo/demoSafety.ts';

type OriginSiteData = Pick<SiteData, 'canonicalUrl' | 'domainName' | 'domainInformation' | 'lifecycleState'>;

// Matches VR_Secure_API's cutover Joi validator (`setSiteCutoverState`
// `validators.js` — `Joi.string().uri({ scheme: ['https'] }).max(2048)`).
// Templates is the fleet-wide READER of this field and must not depend on any
// one producer having enforced this — enforce it here too.
const MAX_CANONICAL_URL_LENGTH = 2048;

// The WHATWG URL parser silently trims leading/trailing C0-control-or-space
// and strips embedded ASCII tab/CR/LF from the input before validating it —
// so a value containing a literal tab or newline would otherwise parse
// "successfully" even though it is not a clean origin. Reject any C0 control
// character, DEL, or space up front (char-code check, not a regex class, to
// keep the check obviously correct rather than relying on an escape-heavy
// pattern) so nothing the parser would have quietly sanitized can pass this
// gate.
function hasControlOrWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

// Bare IPv4 literal (e.g. `192.0.2.1`) — not a stable public canonical host.
function isBareIPv4(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Reject host forms the WHATWG URL parser accepts as syntactically valid but
 * that cannot be a legitimate PUBLIC canonical origin (design.md
 * "no...arbitrary host"): a trailing-dot FQDN (a distinct origin to crawlers
 * that normally fails TLS SNI — canonical-emission-review.md Pass 2 CONCERN
 * C), an empty/dot-only host, a bracketed IPv6 literal, a bare IPv4 literal,
 * and `localhost`/`*.localhost`. Requires at least one dot so a bare
 * single-label host is rejected too.
 */
function isPublicHostname(hostname: string): boolean {
  if (hostname.startsWith('[')) return false; // bracketed IPv6 literal
  if (isBareIPv4(hostname)) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (hostname.startsWith('.') || hostname.endsWith('.') || hostname.includes('..')) return false;
  return hostname.includes('.');
}

/**
 * Parse `value` as a strict https ORIGIN — no path, query, fragment,
 * credentials, explicit port, or non-public host — per design.md's
 * "HTTPS-origin allowlisted (no path, query, fragment, credentials, or
 * arbitrary host)" requirement (OWASP ASVS 5.1 input validation). Returns the
 * normalized `origin` (e.g. `https://example.com`), NEVER the raw input — a
 * caller that emits the raw value instead of this return would
 * string-concatenate onto operator-controlled input (see
 * canonical-emission-review.md BLOCK 2/3).
 */
function parseHttpsOrigin(value: string): string | null {
  if (value.length > MAX_CANONICAL_URL_LENGTH || hasControlOrWhitespace(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.host.length === 0) return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
  // The default https port (443) already normalizes to '' — anything left
  // here is an explicit non-default port, which a public canonical apex
  // never legitimately carries.
  if (parsed.port) return null;
  if (!isPublicHostname(parsed.hostname)) return null;
  return parsed.origin;
}

/**
 * Resolve JUST the operator-authored `canonicalUrl` — demo-gated and
 * validated, with NO env/live_url/domainName fallback. `''` means "nothing
 * authored" (or a demo, or a malformed value), not "resolve me an origin
 * some other way."
 *
 * This is deliberately narrower than {@link resolveSiteOrigin}: callers that
 * decide whether to EMIT a `<link rel="canonical">` tag (routeMetadata.ts)
 * must default-absent when canonicalUrl itself is unset — every existing
 * fleet site has a domainName, so falling back to the general origin chain
 * here would synthesize a brand-new canonical tag on every page of every
 * site that never had one, which is exactly the fleet-wide regression this
 * field must not cause.
 */
export function resolveCanonicalUrl(siteData?: OriginSiteData | null): string {
  // SEO demo-safety: VR_Secure_API's cutover endpoint can persist canonicalUrl
  // BEFORE lifecycleState flips to 'live' (write-ahead so Stage 6 can confirm
  // it before the mutation). Never resolve it while the site is still a demo
  // — that would tell crawlers the demo IS the production apex. Same gate
  // that already governs noindex (see demoSafety.ts).
  if (isDemoSite(siteData)) return '';
  // `siteDetails.values` is a loose Mongo Mixed field (see the module doc
  // above) — a producer bug or malformed write can persist ANY JSON type
  // under `canonicalUrl`, not just a string. `?.trim()` guards null/undefined
  // but not type: a number/boolean/object/array throws inside
  // generateMetadata() and silently strips <title>/description/every og:*
  // tag from EVERY page (HTTP 200, swallowed TypeError) — see
  // canonical-emission-review.md Pass 2 CONCERN A. Treat a non-string exactly
  // like "nothing authored", not a crash.
  const rawCanonicalUrl: unknown = siteData?.canonicalUrl;
  const persistedUrl = typeof rawCanonicalUrl === 'string' ? rawCanonicalUrl.trim() : '';
  if (!persistedUrl) return '';
  return parseHttpsOrigin(persistedUrl) ?? '';
}

export function resolveSiteOrigin(
  siteData?: OriginSiteData | null,
): string {
  const persistedUrl = resolveCanonicalUrl(siteData);
  if (persistedUrl) return persistedUrl;
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const liveUrl = siteData?.domainInformation?.live_url?.trim();
  if (liveUrl) return liveUrl.replace(/\/+$/, '');
  const domain = siteData?.domainName?.trim();
  return domain ? `https://${domain.replace(/\/+$/, '')}` : '';
}
