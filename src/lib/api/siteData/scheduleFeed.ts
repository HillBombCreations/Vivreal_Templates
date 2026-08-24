import type { PageConfig, SiteData } from '@/types/SiteData';
// Explicit .ts extension (not the `@/` alias): this module is imported directly
// by originConsistency.test.ts under `node --experimental-strip-types --test`,
// which has no tsconfig `paths` resolution. Same convention originSource.ts /
// robotsPolicy.ts / siteMapPolicy.ts already follow.
import { resolveSiteOrigin } from '../../og/siteOrigin.ts';

type ScheduleFeedSiteData = Pick<
  SiteData,
  'canonicalUrl' | 'domainName' | 'domainInformation' | 'lifecycleState'
>;

/** This site's own iCal proxy route (`src/app/feeds/schedule.ics/route.ts`). */
const SCHEDULE_FEED_PATH = '/feeds/schedule.ics';

/**
 * Absolute https URL of this site's schedule feed, or `undefined` when no
 * origin resolves.
 *
 * `durable`, not `deployed`, for the same reason the robots.txt `Sitemap:`
 * directive and every sitemap `<loc>` use it, only more so: the renderer turns
 * this value into a `webcal://` subscription, which then lives in a visitor's
 * calendar client and is re-polled indefinitely (see the route's own caching
 * note). An Amplify build host is never a public identity, and a calendar
 * subscription is the longest-lived artifact in the system that could carry
 * one. `durable` also keeps this URL on the SAME origin the canonical and the
 * sitemap resolve, which is the invariant originConsistency.test.ts pins.
 *
 * `undefined` rather than a best-effort string is deliberate. The renderer
 * rewrites `^https?://` to `webcal://` and does nothing else, so anything that
 * is not already an absolute https origin becomes a broken href rather than a
 * failed one. There is no partial value worth emitting here, which is exactly
 * how the branch already handles a missing route canonical
 * (`resolveCanonicalUrl` ⇒ no `<link rel="canonical">`) and a missing sitemap
 * origin (`buildRobotsPolicy` ⇒ no `Sitemap:` directive).
 */
export function buildScheduleFeedUrl(siteData: ScheduleFeedSiteData): string | undefined {
  const origin = resolveSiteOrigin(siteData, { prefer: 'durable' });
  return origin ? `${origin}${SCHEDULE_FEED_PATH}` : undefined;
}

/**
 * Wire the renderer's Schedule "Subscribe" button by writing
 * `labels.icalFeedUrl` onto every `schedule`-format page in `pages`.
 *
 * MUTATES the page configs in place, which is what the inline loop this
 * replaces did: `getSiteData()` hands the same array straight to its return
 * value.
 *
 * Lives here rather than inline in `getSiteData()` for the reason
 * `buildRobotsPolicy` and `buildSiteMapForSite` do: `src/lib/api/siteData/
 * index.tsx` is `server-only` AND `.tsx`, so the plain-Node test runner cannot
 * import it, and a guard that no test can call is a guard that can be deleted
 * with the suite still green.
 *
 * Two guards are load-bearing and both are pinned by tests:
 *   - no resolved origin ⇒ write NOTHING, not `https://undefined/...` and not
 *     an `icalFeedUrl` key set to `undefined`. The Subscribe button is hidden
 *     by the renderer's own `!!pageConfig.icalFeedUrl` check, which is the
 *     correct degraded state.
 *   - only `schedule`-format pages are touched. Every other page keeps the
 *     labels VR_Client_API returned.
 *
 * The origin resolves ONCE, above the loop, so a site with N schedule pages
 * does N label writes and one resolution.
 */
export function applyScheduleFeedUrl(
  pages: Pick<PageConfig, 'format' | 'labels'>[],
  siteData: ScheduleFeedSiteData,
): void {
  const feedUrl = buildScheduleFeedUrl(siteData);
  if (!feedUrl) return;

  for (const page of pages) {
    if (page?.format !== 'schedule') continue;
    page.labels = { ...(page.labels ?? {}), icalFeedUrl: feedUrl };
  }
}
