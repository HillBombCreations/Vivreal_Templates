import type { SiteData } from '@/types/SiteData';
// Relative + explicit `.ts` extension (not the `@/` alias): this module is
// imported directly by ogImage.test.ts/routeMetadata.test.ts under
// `node --experimental-strip-types --test`, which has no tsconfig `paths`
// resolution — same convention routeMetadata.ts already follows.
import { isDemoSite } from '../seo/demoSafety.ts';

/**
 * Which SURFACE CLASS is asking for the origin, and therefore HOW STRICT the
 * resolver must be about the answer.
 *
 * This selects STRICTNESS, not order. Both values walk the SAME precedence
 * chain in the same sequence (see {@link resolveSiteOrigin}); design.md
 * specifies exactly one order and this resolver ships exactly one. The only
 * difference between the two values is which parsed candidates are acceptable:
 *
 *   'durable'  = crawler-cached surfaces (JSON-LD `url`, robots.txt `Sitemap:`,
 *                sitemap `<loc>`, the webcal schedule feed). A
 *                `*.amplifyapp.com` candidate is REFUSED here, because those
 *                surfaces live in crawler caches (and calendar clients) for
 *                days and an Amplify build host is never a public identity.
 *   'deployed' = per-request metadata (`metadataBase`, `og:image`). Accepts an
 *                amplifyapp candidate, which is exactly what these surfaces did
 *                before this resolver existed, so nothing regresses.
 *
 * The parameter was called `prefer` while a since-dropped design had the two
 * values reordering the chain. It no longer does, and `prefer` actively misled
 * a reader into expecting a reordering, so it is named for what it selects.
 *
 * It is REQUIRED (no default) on purpose. Two identically-typed resolvers
 * reachable from one import path is a swap waiting to happen with no compiler
 * or lint signal, so the caller has to type the choice out.
 */
export type OriginSurface = 'durable' | 'deployed';

/**
 * The precedence level a candidate was read from.
 *
 * Deliberately the level NAME and never the value: this is emitted as a Sentry
 * tag by the reporting call site, and a tag carrying the host itself would mint
 * one Issue per tenant and destroy the fleet-wide signal (the grouping rule
 * `src/lib/api/errorCapture.ts` already documents).
 */
export type OriginCandidateLevel =
  | 'canonicalUrl'
  | 'NEXT_PUBLIC_SITE_URL'
  | 'live_url'
  | 'domainName';

/**
 * Why a candidate that WAS authored did not become the origin.
 *
 *   'malformed'    = failed the HTTPS-origin allowlist ({@link parseHttpsOrigin}):
 *                    a path/query/fragment, credentials, a port, a non-https
 *                    scheme, a non-public host, or a non-string value out of the
 *                    free-form `siteDetails.values` Mixed field.
 *   'amplify-host' = parsed cleanly, but is an Amplify build host and the caller
 *                    asked for a `durable` surface.
 *
 * "Absent" is NOT a cause. A level nothing was ever authored at produces no
 * entry at all, which is what lets a caller tell a MISCONFIGURED site apart
 * from a site that simply has no custom domain yet.
 */
export type OriginRefusalCause = 'malformed' | 'amplify-host';

export interface RefusedOriginCandidate {
  readonly level: OriginCandidateLevel;
  readonly cause: OriginRefusalCause;
}

/**
 * What {@link resolveSiteOriginResult} decided, and why.
 *
 * `origin` is the resolved origin or `''`. `refused` lists every authored
 * candidate the resolver walked past, in precedence order, so the refusal is
 * REPORTABLE by a caller that can reach Sentry.
 *
 * This module must stay importable by `node --experimental-strip-types --test`,
 * which cannot load the Sentry SDK, so the resolver cannot report the refusal
 * itself. Trading its behavioural suite for a log line would be a bad deal:
 * that suite is the only thing standing between the demo gates and silent
 * deletion (review-templates-106.md B2). Returning the reason as DATA keeps
 * both — the resolver stays pure and testable, and
 * `src/lib/api/siteData/index.tsx` (which already imports Sentry) reports it.
 *
 * `refused` is populated on SUCCESS too: a `live_url` refused as an amplifyapp
 * host while `domainName` carried the day is a real and currently invisible
 * misconfiguration, and callers that only care about total failure use
 * {@link isRefusedOrigin}.
 */
export interface OriginResolution {
  readonly origin: string;
  readonly refused: readonly RefusedOriginCandidate[];
}

export type OriginSiteData = Pick<
  SiteData,
  'canonicalUrl' | 'domainName' | 'domainInformation' | 'lifecycleState'
>;

// Matches VR_Secure_API's cutover Joi validator (`setSiteCutoverState`
// `validators.js` — `Joi.string().uri({ scheme: ['https'] }).max(2048)`).
// Templates is the fleet-wide READER of this field and must not depend on any
// one producer having enforced this — enforce it here too.
const MAX_CANONICAL_URL_LENGTH = 2048;

// RFC 1035 §3.1: a full domain name is capped at 253 octets and each
// dot-separated label at 63. Nothing longer can exist in DNS — a canonical
// pointing at a host that cannot resolve is a de-index risk for a page that
// is otherwise fine (canonical-emission-review.md Pass 3 CONCERN K).
const MAX_HOSTNAME_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

// Amplify's own build host (`<branch>.<appId>.amplifyapp.com`). Vivreal_EventHandler
// writes it into `domainInformation.live_url` unconditionally at deploy, and both
// later writers that would replace it are CONDITIONAL: `checkDomainAssociaion`
// only writes the real domain on `SUCCEEDED`, and `markSiteLive` writes the
// amplifyapp default as the TERMINAL value whenever no domain was requested (the
// deploy state machine routes `$.domain === ""` straight to MarkLive). So a live
// site can durably carry an amplifyapp `live_url`. The root cause belongs in
// Vivreal_EventHandler; this is the resolver-level floor that stops it leaking
// into crawler caches. Anchored on an exact `.com` end, which is safe here only
// because every candidate reaching it has already been through
// `parseCandidateOrigin` (a trailing-dot or scheme-less host is rejected there,
// closing the three bypasses review-templates-106.md C3 documented).
const AMPLIFYAPP_HOST_RE = /(^|\.)amplifyapp\.com$/i;

/**
 * The WHATWG URL parser silently trims leading/trailing C0-control-or-space
 * and strips embedded ASCII tab/CR/LF from the input before validating it —
 * so a value containing a literal tab or newline would otherwise parse
 * "successfully" even though it is not a clean origin. Reject any C0 control
 * character, DEL, or space up front (char-code check, not a regex class, to
 * keep the check obviously correct rather than relying on an escape-heavy
 * pattern) so nothing the parser would have quietly sanitized can pass this
 * gate.
 */
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
 * `localhost`/`*.localhost`, and a name/label that exceeds RFC 1035's DNS
 * length caps (Pass 3 CONCERN K) — nothing that long can ever resolve.
 * Requires at least one dot so a bare single-label host is rejected too.
 */
function isPublicHostname(hostname: string): boolean {
  if (hostname.startsWith('[')) return false; // bracketed IPv6 literal
  if (isBareIPv4(hostname)) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (hostname.startsWith('.') || hostname.endsWith('.') || hostname.includes('..')) return false;
  if (!hostname.includes('.')) return false;
  // Two independent RFC 1035 §3.1 bounds, checked separately (not folded
  // into one compound condition) so each has its own dedicated failing
  // test — a single test that only trips when BOTH are removed is a false
  // pin (canonical-emission-review.md Pass 3 findings on the `:65` compound
  // guard).
  if (hostname.length > MAX_HOSTNAME_LENGTH) return false;
  if (hostname.split('.').some((label) => label.length > MAX_LABEL_LENGTH)) return false;
  return true;
}

/**
 * Parse `value` as a strict https ORIGIN — no path, query, fragment,
 * credentials, explicit port, or non-public host — per design.md's
 * "HTTPS-origin allowlisted (no path, query, fragment, credentials, or
 * arbitrary host)" requirement (OWASP ASVS 5.1 input validation).
 *
 * Returns the parsed `URL`, so callers read the normalized `.origin` (e.g.
 * `https://example.com`) and never the raw input. A caller that emitted the
 * raw value instead would be string-concatenating onto operator-controlled
 * input (canonical-emission-review.md BLOCK 2/3). Callers also read
 * `.hostname` off the same parse for the amplifyapp check, so no candidate is
 * ever parsed twice.
 */
function parseHttpsOrigin(value: string): URL | null {
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
  return parsed;
}

/**
 * Trim, drop trailing slashes, then allowlist. The trailing-slash strip runs
 * BEFORE parsing so this stays byte-for-byte compatible with the pre-change
 * resolver, which normalised every candidate with `.replace(/\/+$/, '')`:
 * `https://acme.test/` and `https://acme.test//` both resolved to
 * `https://acme.test` then and still do now.
 *
 * `unknown` rather than `string | undefined` because every candidate this
 * resolver reads originates in `siteDetails.values`, a free-form Mongo Mixed
 * field that can carry ANY JSON type (canonical-emission-review.md Pass 2
 * CONCERN A: a number reaching `.trim()` threw inside `generateMetadata()`
 * and silently stripped every meta tag from every page with an HTTP 200).
 * A non-string is treated exactly like "nothing authored".
 */
function parseCandidateOrigin(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return parseHttpsOrigin(trimmed);
}

/**
 * Did the site actually AUTHOR something at this level?
 *
 * The mirror image of the two `parseCandidate*` normalisations above: anything
 * they reduce to an empty string was never authored, so a whitespace-only or
 * slash-only value is "absent", not "malformed". That distinction is what keeps
 * `NEXT_PUBLIC_SITE_URL='/'` (a real fixture — see siteOrigin.test.ts) out of
 * the refusal report.
 *
 * A NON-string is treated as authored-and-malformed on purpose. `siteDetails.
 * values` is a free-form Mongo Mixed field, so a number or object landing in
 * `canonicalUrl` is a genuine write defect worth reporting, not an empty field.
 */
function isAuthoredCandidate(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'string') return true;
  return value.trim().replace(/\/+$/, '') !== '';
}

/**
 * `domainName` is a bare host (`acme.com`), not a URL, so it gets the same
 * `https://` prefix it always has, then the identical allowlist.
 */
function parseDomainNameOrigin(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return parseHttpsOrigin(`https://${trimmed}`);
}

/**
 * Resolve JUST the operator-authored `canonicalUrl` — demo-gated and
 * validated, with NO env/live_url/domainName fallback. `null` means "nothing
 * authored" (or a demo, or a malformed value), not "resolve me an origin
 * some other way."
 */
function parseCanonicalUrl(siteData?: OriginSiteData | null): URL | null {
  // SEO demo-safety: VR_Secure_API's cutover endpoint can persist canonicalUrl
  // BEFORE lifecycleState flips to 'live' (write-ahead so Stage 6 can confirm
  // it before the mutation). Never resolve it while the site is still a demo
  // — that would tell crawlers the demo IS the production apex. Gating here,
  // inside the resolver, is a stronger invariant than trusting each of the
  // four call sites to gate correctly (review-templates-106.md, section (b)
  // "Demo interaction").
  if (isDemoSite(siteData)) return null;
  return parseCandidateOrigin(siteData?.canonicalUrl);
}

/**
 * String form of {@link parseCanonicalUrl}. `''` means "nothing authored".
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
  return parseCanonicalUrl(siteData)?.origin ?? '';
}

/**
 * Resolve the site's public origin AND why any authored candidate was refused.
 *
 * ONE precedence chain, exactly as design.md's Option A specifies, walked
 * identically for both `surface` values:
 *
 *   1. `siteData.canonicalUrl`            (owned runtime state, demo-gated)
 *   2. `NEXT_PUBLIC_SITE_URL`             (existing fleet compatibility)
 *   3. `domainInformation.live_url`       (physical site origin)
 *   4. `domainName`                       (legacy directly attached domain)
 *
 * `canonicalUrl` is resolved ABOVE the `surface` strictness check, never inside
 * it, so it is structurally impossible to apply it to only one surface class.
 * Applying it to one and not the other would put `og:url`/`metadataBase` on one
 * host while JSON-LD and the sitemap named another: split-brain on the exact
 * site the cutover exists for (review-templates-106.md, Trap 2).
 *
 * EVERY candidate goes through the same HTTPS-origin allowlist
 * ({@link parseHttpsOrigin}), not just the first. A `live_url` carrying a
 * path, a query string, credentials, a port or a non-resolving host reaches
 * `robots.txt` and sitemap `<loc>` otherwise, and both are crawler-cached
 * (review-templates-106.md C2). A useful side effect: the returned origin is
 * always either `''` or something `new URL()` can parse, so the
 * `metadataBase: new URL(origin)` call sites cannot throw (C13).
 *
 * Filtering happens PER CANDIDATE, not after resolution: a site whose
 * `live_url` is refused still resolves through to its perfectly good
 * `domainName` rather than discarding a valid origin (C4).
 *
 * Evaluation short-circuits at the first accepted candidate, exactly as the
 * `??` chain this replaced did — a site whose `canonicalUrl` answers never
 * parses the other three.
 *
 * Backward compatibility: every well-formed fleet input resolves to the same
 * bytes as before. `live_url = https://sub.vivreal.io` ⇒ unchanged,
 * `domainName = acme.com` ⇒ `https://acme.com` unchanged, neither present ⇒
 * `''` unchanged. `NEXT_PUBLIC_SITE_URL` is set on zero of the 20 fleet
 * Amplify apps, so level 2 is currently inert in production either way.
 */
export function resolveSiteOriginResult(
  siteData: OriginSiteData | null | undefined,
  { surface }: { surface: OriginSurface },
): OriginResolution {
  // Test positively for 'deployed' so any value TypeScript's OriginSurface
  // union did not catch (an omitted options object, a typo'd literal reaching
  // this JS at runtime) falls to the STRICTER 'durable' path rather than the
  // one that would pass an amplifyapp host straight through.
  const isDeployed = surface === 'deployed';

  // A demo's canonicalUrl is WITHHELD, not refused (see parseCanonicalUrl for
  // why it is withheld). Passing `undefined` here rather than the raw value is
  // what stops every demo site in the fleet from reporting a refusal it did
  // not cause — the highest-severity false positive this diagnostic could have.
  const canonicalCandidate = isDemoSite(siteData) ? undefined : siteData?.canonicalUrl;

  // Raw values + their parser, so parsing stays LAZY: the loop below stops at
  // the first accepted candidate and never touches the rest.
  const candidates: ReadonlyArray<
    readonly [OriginCandidateLevel, unknown, (value: unknown) => URL | null]
  > = [
    ['canonicalUrl', canonicalCandidate, parseCandidateOrigin],
    ['NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL, parseCandidateOrigin],
    ['live_url', siteData?.domainInformation?.live_url, parseCandidateOrigin],
    ['domainName', siteData?.domainName, parseDomainNameOrigin],
  ];

  const refused: RefusedOriginCandidate[] = [];
  for (const [level, raw, parse] of candidates) {
    const parsed = parse(raw);
    if (!parsed) {
      // Absent ⇒ no entry. Only an authored-but-unusable value is a refusal.
      if (isAuthoredCandidate(raw)) refused.push({ level, cause: 'malformed' });
      continue;
    }
    if (!isDeployed && AMPLIFYAPP_HOST_RE.test(parsed.hostname)) {
      refused.push({ level, cause: 'amplify-host' });
      continue;
    }
    return { origin: parsed.origin, refused };
  }
  return { origin: '', refused };
}

/**
 * Resolve the site's public origin (protocol + host, no trailing slash), or
 * `''` when none is known. The string form of {@link resolveSiteOriginResult},
 * which every existing caller uses.
 *
 * It delegates rather than re-implementing so the two can never disagree: a
 * second copy of the precedence chain is exactly the divergence
 * `toOriginSource` was created to make impossible one layer up.
 */
export function resolveSiteOrigin(
  siteData: OriginSiteData | null | undefined,
  { surface }: { surface: OriginSurface },
): string {
  return resolveSiteOriginResult(siteData, { surface }).origin;
}

/**
 * Did the resolver come back with NOTHING despite the site having authored at
 * least one candidate?
 *
 * This is the alertable condition, and it is deliberately narrower than
 * `origin === ''`. A site with no `canonicalUrl`, no `live_url` and no
 * `domainName` is not misconfigured; it is un-deployed (or the local/preview
 * build, where `SITE_ID` is `'preview'`), and paging on it would bury the real
 * signal. A site that authored something the resolver then refused is a
 * misconfiguration whose only symptom is ABSENCE — no canonical, no robots.txt
 * `Sitemap:` directive, no sitemap `<loc>`, no schedule feed — which is the
 * same silent-absence class as the empty-sitemap defect (review-templates-106.md
 * C5).
 */
export function isRefusedOrigin(resolution: OriginResolution): boolean {
  return resolution.origin === '' && resolution.refused.length > 0;
}

/**
 * Build a content-detail page's absolute URL for JSON-LD `url` fields, via
 * {@link resolveSiteOrigin} in `durable` mode. Returns `undefined` when no
 * origin is known (or the only known origin was refused as an amplifyapp
 * host) — every JSON-LD `url` call site already omits the field rather than
 * emit a broken relative/`undefined` URL.
 *
 * `slug` is stripped of leading slashes for the same reason
 * `buildSitemapEntries` does it: a `pageConfig.slug` is stored WITH a leading
 * slash, so a future caller passing one straight through would emit
 * `https://host//shows/id` (review-templates-106.md C11).
 */
export function buildDetailUrl(
  siteData: OriginSiteData,
  slug: string,
  itemId: string,
): string | undefined {
  const origin = resolveSiteOrigin(siteData, { surface: 'durable' });
  return origin ? `${origin}/${slug.replace(/^\/+/, '')}/${itemId}` : undefined;
}
