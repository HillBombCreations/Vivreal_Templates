import type { SiteData } from '@/types/SiteData';

/**
 * "The upstream did not answer" as a first-class state, distinct from every
 * answer it could have given.
 *
 * WHY THIS EXISTS
 * ───────────────
 * `getSiteData()` cannot fail loudly on its own: `clientFetchCached` swallows
 * the upstream error by design and hands back `FALLBACK_SITE_DATA` so the app
 * has SOMETHING to render. That is a reasonable posture for most of the page.
 * It is the wrong posture for the four surfaces that make DURABLE, MACHINE-READ
 * claims about the site: `robots.txt`, `sitemap.xml`, the indexing meta, and
 * the "this page does not exist" 404.
 *
 * Those four turn missing data into a positive assertion. Before this module,
 * a degraded render told every crawler that the whole site was `Disallow: /`,
 * `noindex, nofollow`, and 404. Three untruths manufactured out of an absence,
 * for as long as the wobble lasted. `vivreal.io` has already lost ten days of
 * indexing to a `lifecycleState` reading `demo` when it should have read
 * `live`; the degraded path reproduced that shape automatically, under load,
 * with nobody touching anything.
 *
 * WHY A THROW AND NOT A BETTER DEFAULT
 * ───────────────────────────────────
 * There is no better default, and that is the whole point. The comment this
 * module replaces framed it as a forced binary: either the fallback claims
 * `demo` (and an outage deindexes every LIVE site) or it claims nothing (and an
 * outage un-gates every DEMO site onto a prospect's duplicate content). Both
 * sides of that trade are real, and both were accepted because the third option
 * was not considered.
 *
 * The third option is to serve neither claim. A 5xx withholds the page from
 * indexing (nothing to index protects the demo) AND removes nothing already
 * indexed (a 5xx is "come back later", not "this is gone"), so it satisfies
 * both constraints at once instead of choosing a side. Crawlers have an
 * explicit, documented contract for it; they have no contract at all for "a
 * successful 200 that happens to be wrong".
 *
 * This is the same call `frozenGate.ts` already made for the same reason, in
 * the same repo: a frozen site answers 503 rather than 404, and its `robots.txt`
 * and `sitemap.xml` are deliberately left serving so a transient billing
 * problem can never deindex a customer. A transient upstream wobble deserves
 * exactly the same treatment, and until now it got the opposite.
 *
 * WHY A PLAIN `.ts` MODULE WITH NO NEXT IMPORT
 * ────────────────────────────────────────────
 * Same two reasons as `frozenGate.ts` and `clientFetchCore.ts`: `node
 * --experimental-strip-types --test` can drive it directly, and mutation
 * testing has already proved once in this codebase that a deleted SEO gate
 * leaves the whole suite green (review-templates-106.md B2). Every claim this
 * module makes is exercised by `src/lib/seo/degradedRender.test.ts`.
 */

/**
 * Thrown by any surface asked to make a durable claim about a site whose data
 * could not be read.
 *
 * Deliberately a plain `Error` subclass carrying NO `digest`. Next tags its own
 * control-flow throws (`notFound()`, `redirect()`) with a `digest` string and
 * converts them into HTTP statuses; a digest here would let the framework turn
 * this refusal back into the 404 it exists to prevent. Uncaught, it reaches
 * `error.tsx` and the response is a 5xx, which is the intent.
 *
 * The message names the surface, because these arrive in Sentry with no
 * upstream error attached to identify them. `clientFetchCached` already
 * swallowed and captured that one layer down (see the capture at the swallow in
 * `client.ts`).
 */
export class DegradedUpstreamError extends Error {
  readonly surface: string;

  constructor(surface: string) {
    super(
      `Refusing to serve ${surface} from degraded site data. ` +
        'VR_Client_API did not answer, so the site lifecycle and page list are UNKNOWN. ' +
        'Serving a durable SEO claim from this state is how a transient outage deindexes a live site.',
    );
    this.name = 'DegradedUpstreamError';
    this.surface = surface;
  }
}

/**
 * The marker `FALLBACK_SITE_DATA` carries, and the ONLY thing that identifies a
 * degraded render.
 *
 * An explicit boolean rather than an inference (`pageConfigs.length === 0`, a
 * missing `name`, an empty logo): every one of those is also a legitimate shape
 * for a real, healthy site. A brand-new site with one home page genuinely has
 * an empty `pageConfigs`, and 404ing it would be correct. Only the fallback
 * constant sets this, so it can never be true of data that was actually read.
 */
export const DEGRADED_MARKER = 'degraded' as const;

/** True only for `FALLBACK_SITE_DATA`, data that was never successfully read. */
export const isDegradedSiteData = (
  siteData?: Pick<SiteData, 'degraded'> | null,
): boolean => siteData?.degraded === true;

/**
 * Refuse to answer, from a surface that would otherwise make a durable claim.
 *
 * Callers should use this rather than throwing inline so every refusal in the
 * app is the same type and names its surface.
 */
export function refuseDegradedClaim(surface: string): never {
  throw new DegradedUpstreamError(surface);
}

/**
 * Guard for a route about to conclude that a page does not exist.
 *
 * Call it BEFORE `notFound()` on any path whose "missing" verdict is derived
 * from `siteData.pageConfigs`. With a degraded read that list is empty because
 * nothing was read, not because the site has no pages, so every healthy URL on
 * the site would otherwise answer 404 for the duration of the wobble, the
 * single most damaging thing this app can tell a crawler.
 *
 * A no-op on healthy data, including a genuinely empty site, so a real 404 is
 * completely unaffected.
 */
export function assertUpstreamHealthy(
  siteData?: Pick<SiteData, 'degraded'> | null,
): void {
  if (isDegradedSiteData(siteData)) {
    refuseDegradedClaim('a page-missing (404) verdict');
  }
}
