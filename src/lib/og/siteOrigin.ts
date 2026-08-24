import type { SiteData } from '@/types/SiteData';

export type OriginPreference = 'durable' | 'deployed';

const AMPLIFYAPP_HOST_RE = /(^|\.)amplifyapp\.com$/i;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizedUrl(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed ? stripTrailingSlash(trimmed) : '';
}

function domainOrigin(domainName: string | undefined | null): string {
  const domain = domainName?.trim();
  return domain ? `https://${stripTrailingSlash(domain)}` : '';
}

function isAmplifyAppOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    return AMPLIFYAPP_HOST_RE.test(new URL(origin).hostname);
  } catch {
    // Not a parseable absolute URL. Currently unreachable, but NOT because it
    // is structurally impossible: `domainOrigin()` always prefixes
    // `domainName` with `https://`, but `siteData.domainInformation.live_url`
    // (below, in `resolveOrigin`) is passed through UNVALIDATED. A
    // scheme-less, protocol-relative, or trailing-dot amplifyapp `live_url`
    // would land here and be treated as "not amplifyapp" — not refused, not
    // caught by the regex either (it anchors on an exact `.com` end). It's
    // unreachable today only because every current writer of `live_url`
    // (Vivreal_EventHandler's `getDefaultUrl`, `markSiteLive`,
    // `checkDomainAssociaion` — see the JSDoc above) unconditionally emits an
    // `https://` scheme. That is an external invariant this function relies
    // on, not one it enforces.
    return false;
  }
}

/**
 * Resolve the site's origin (protocol + host, no trailing slash) with an
 * EXPLICIT, REQUIRED `prefer` discriminant, instead of two separately-named
 * functions a caller could swap without a compiler or lint signal.
 *
 * `resolveIndexedOrigin` and `resolveSiteOrigin` used to be two functions with
 * identical parameter and return types, reachable from the same import path
 * (`@/lib/og/ogImage`) — swapping one for the other compiled clean, passed
 * `tsc --noEmit`, passed lint, and produced a plausible-looking URL every
 * time. Collapsing them here makes the precedence choice a value the caller
 * must type out (`{ prefer: 'durable' }` vs `{ prefer: 'deployed' }`), not a
 * function name they can misremember.
 *
 * Precedence, both modes:
 *   1. `NEXT_PUBLIC_SITE_URL` (env override — not currently set by the deploy
 *      pipeline; see `createAmplifyApp/index.js` in Vivreal_EventHandler).
 *   2. `durable`: `domainName` first, then `domainInformation.live_url`.
 *      `deployed`: `domainInformation.live_url` first, then `domainName`.
 *
 * One deliberate behavior change vs. the pre-collapse pair, in BOTH modes
 * (not just `durable` — corrected from an earlier, false "deployed is
 * unaffected" claim): a slash-only `NEXT_PUBLIC_SITE_URL` (e.g. `"/"`) now
 * falls through to `domainName`/`live_url` instead of short-circuiting to
 * `''`. The old code tested the trimmed-but-unstripped value (`"/"`,
 * truthy) and returned the stripped one (`''`); this version strips before
 * testing, so the already-empty result is falsy and the env override is
 * correctly treated as absent. The new behavior is the intended one: a
 * slash-only env var isn't a real origin, and silently blanking a site's
 * known-good `domainName`/`live_url` because of it (the old behavior) is
 * strictly worse than falling back to them. `NEXT_PUBLIC_SITE_URL` is never
 * actually set to `"/"` by the deploy pipeline, so this has no fleet impact.
 *
 * Why two orders exist at all — for JSON-LD `url`, `robots.txt` `Sitemap:`,
 * and sitemap `<loc>` (crawler-cached for days), `durable` prefers the
 * customer-authored `domainName` over `live_url`. For OG/canonical metadata
 * (`deployed`, short-lived per-request rendering), `live_url` is preferred
 * because it is populated for every deployed site (including subdomain-only
 * sites, which never get a `domainName`), whereas `domainName` is absent for
 * those.
 *
 * What `live_url` actually is (corrected from an earlier, false claim in this
 * doc and in the commit that introduced `durable`): `live_url` is NOT a value
 * that is reliably overwritten shortly after deploy. Vivreal_EventHandler's
 * `getDefaultUrl` unconditionally writes the raw `*.amplifyapp.com` host.
 * Both later writers are CONDITIONAL, not automatic corrections:
 *   - `checkDomainAssociaion/index.js:90-104` writes the real domain only
 *     `if (domainStatus === "SUCCEEDED" && domain)` — a `FAILED` or still-
 *     `RUNNING` association writes nothing, so `live_url` keeps the
 *     amplifyapp host for as long as the domain stays unassociated (days,
 *     for a customer with broken DNS, not a brief window).
 *   - `markSiteLive/index.js:31-35,48` defaults `activeDomain` to the
 *     amplifyapp `defaultUrl` and writes it as the TERMINAL `live_url` value
 *     whenever `domain` is falsy.
 *   - The deploy state machine proves this path is real and permanent, not
 *     hypothetical: `Vivreal_EventHandler/docs/ops/deploy-site-state-machine.asl.json`'s
 *     `AssociateDomain?` state routes `$.domain === ""` straight to
 *     `MarkLive` (an End state), skipping association entirely. A site
 *     created with neither a subdomain nor a custom domain
 *     (`VR_Secure_API/src/createSites/services/deploySite.js:53`,
 *     `createSiteCollectionData.js:134`) takes exactly this path.
 *
 * The real argument for `durable` preferring `domainName`, then, is not "the
 * window is brief" — it is that `domainName`-first precedence makes
 * `live_url` STRUCTURALLY UNREACHABLE for any site that has a `domainName`,
 * regardless of what `live_url` durably holds. That is a stronger guarantee
 * than a timing argument, and it is proven directly: a fixture with
 * `domainName` set and `live_url` explicitly a durable amplifyapp host
 * resolves identically to a fixture where the two agree (see
 * `siteOrigin.test.ts`).
 *
 * The gap that guarantee does NOT close: top-level `site.domainName` has no
 * writer anywhere in the current codebase (searched VR_Secure_API,
 * Vivreal_EventHandler, Vivreal_Portal_Mobile, and the migrator's
 * site-loader). `Vivreal-Schemas/schemas/siteSchema.js` declares
 * `domainName` only NESTED, under `purchasedDomain` and `transferredDomain` —
 * never at the root — and it survives on read only because
 * `VR_Client_API/src/services/tenant/getSiteDetails.js` queries with
 * `.lean()`, which passes undeclared fields through. It is vestigial: legacy
 * data on a handful of existing custom-apex sites, absent on every site
 * `domainInformation`/`live_url` alone now provisions. So the `durable`
 * precedence flip protects only sites carrying that legacy field — it is a
 * DECAYING guarantee, not a durable structural one, for anything created
 * going forward. Do not treat it as load-bearing for new sites.
 *
 * The amplifyapp guard below is the defensive floor for exactly that gap: a
 * site with no `domainName` and a durably-amplifyapp `live_url` (the
 * `$.domain === ""` path above) would otherwise leak
 * `https://<branch>.<appId>.amplifyapp.com` into `durable`-mode surfaces.
 * The root cause belongs in Vivreal_EventHandler (tracked separately, not
 * fixed here); this refuses the value at the resolver instead of papering
 * over the pipeline gap. Emitting nothing on that refusal is the same
 * behavior these surfaces had before this resolver existed, so it is a safe
 * floor, not a new failure mode.
 *
 * No `import 'server-only'` here (unlike `ogImage.ts`, which re-exports
 * this): that sentinel is a Next.js build-time module, not a real npm
 * package, so a file that imports it can't be exercised under plain
 * `node --test`. Every real caller reaches this only via `@/lib/og/ogImage`'s
 * re-export, which keeps the server-only guard on the public import path.
 */
export function resolveOrigin(
  siteData: Pick<SiteData, 'domainName' | 'domainInformation'> | null | undefined,
  { prefer }: { prefer: OriginPreference },
): string {
  const envUrl = normalizedUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (envUrl) return envUrl;

  const domain = domainOrigin(siteData?.domainName);
  const liveUrl = normalizedUrl(siteData?.domainInformation?.live_url);

  // Test positively for 'deployed' (rather than 'durable') so that any value
  // TypeScript's `OriginPreference` union didn't catch — an omitted options
  // object, a typo'd literal reaching this JS at runtime — falls to the
  // SAFER `durable` path, both for resolution order and for the amplifyapp
  // guard below. The prior positive-test-for-'durable' form let an
  // unrecognized value silently take the 'deployed' branch, including the
  // amplifyapp host the guard exists to refuse. No behavior change for
  // either valid literal.
  const isDeployed = prefer === 'deployed';
  const resolved = isDeployed ? liveUrl || domain : domain || liveUrl;

  // Defensive floor (see doc comment above) — only the `durable` surfaces
  // (JSON-LD, robots, sitemap) are crawler-cached long enough for a leaked
  // amplifyapp host to matter; `deployed` (OG/metadata) already accepted
  // `live_url` as-is before this resolver existed and is unchanged here.
  if (!isDeployed && isAmplifyAppOrigin(resolved)) return '';

  return resolved;
}

/**
 * Build a content-detail page's absolute URL for JSON-LD `url` fields, via
 * {@link resolveOrigin} in `durable` mode. Returns `undefined` when no origin
 * is known (or the only known origin was refused as an amplifyapp host) —
 * every JSON-LD `url` call site already omits the field rather than emit a
 * broken relative/`undefined` URL.
 */
export function buildDetailUrl(
  siteData: Pick<SiteData, 'domainName' | 'domainInformation'>,
  slug: string,
  itemId: string,
): string | undefined {
  const origin = resolveOrigin(siteData, { prefer: 'durable' });
  return origin ? `${origin}/${slug}/${itemId}` : undefined;
}
