import type { SiteData } from '@/types/SiteData';

/**
 * What `getSiteData()` returns when VR_Client_API gives us nothing.
 *
 * Lives in its own plain `.ts` module (not `./index.tsx`, which is `server-only`
 * and carries JSX and so cannot be loaded by the plain-Node test runner) purely
 * so the demo-safety contract below is testable. See demoSafety.test.ts.
 */
export const FALLBACK_SITE_DATA: SiteData = {
  // FAIL CLOSED on an upstream outage.
  //
  // ISR migration Phase 3 changed the blast radius of this constant on a site
  // that has opted into `SITE_RENDER_MODE=isr`, and the change is worth stating
  // rather than discovering. `robots.tsx` used to be `force-dynamic`, so this
  // was re-evaluated on EVERY request and an outage's effect ended the moment
  // the outage did. Under ISR a render built from this fallback used to be
  // cached like any other.
  //
  // CORRECTION, Phase 4. An earlier version of this comment said that cache was
  // "for up to `revalidate` (300s) at the origin and at CloudFront". The origin
  // half was right. The CloudFront half was wrong, and it was measured wrong on
  // 2026-08-31: an `s-maxage=300` object was served from the edge at `Age: 599`
  // as an ordinary `X-Cache: Hit`, and two POPs served two different versions of
  // the same URL at the same moment. CloudFront honours the
  // `stale-while-revalidate` Next appends, so edge staleness was bounded by
  // `300s + time to the next request at that POP + one more request`, not by
  // 300s. Worse, the Amplify-managed distribution is in AWS's account, so there
  // is no `create-invalidation` and `revalidateTag` cannot reach it (Spike B).
  // Both halves of that are now bounded rather than described:
  //
  //   - `getSiteData()` calls `bailOutOfCachingDegradedRender()` before it
  //     returns this constant, so a render built from it enters NEITHER cache.
  //     `robots.txt` is an app ROUTE, so it simply serves uncached and an
  //     outage's effect on a live site's robots policy once again ends when the
  //     outage does. An app PAGE takes a different route through the framework
  //     to the same guarantee; see `optOutOfCachingDegradedRender` in
  //     `src/lib/renderMode.ts`. (Phase 4 blocker 1.)
  //   - `expireTime` in `next.config.ts` is set to 3600, so the
  //     `stale-while-revalidate` window on a HEALTHY render is one hour rather
  //     than Next's default one year. (Phase 4 blocker 2.)
  //
  // Full measurements: `docs/projects/isr-migration/phase-4-result.md` and
  // `phase4-blockers-result.md` in `vivreal-hq`.
  //
  // THIS CONSTANT MAKES NO LIFECYCLE CLAIM. That is the whole point of the
  // `degraded` marker below, and it is a correction of what this comment used
  // to say.
  //
  // It used to set `lifecycleState: 'demo'`, and the reasoning was sound as far
  // as it went. Leaving the key absent makes `isDemoSite()` take its
  // existing-fleet default of "not a demo", so a sustained Client API outage
  // silently un-gates every demo site in the fleet: a full permissive robots
  // policy and no noindex on a near-duplicate of a prospect's real website
  // (review-templates-106.md, "The demo gate is fail-open on an upstream
  // outage"). That failure is real and it is not undone by the upstream
  // recovering.
  //
  // What the old comment got wrong was believing this was a two-sided trade
  // with no third option. It said the choice was between "a prospect's demo
  // gets indexed" and "a broken page is withheld until the next successful
  // read", and picked the second. But claiming `demo` means that during any
  // upstream wobble a LIVE site serves `Disallow: /` and `noindex, nofollow`
  // across every page, which is precisely how `vivreal.io` lost ten days of
  // indexing once already (a `lifecycleState` reading `demo` when it should
  // have read `live`). The degraded path reproduced that incident by itself,
  // under load, with nobody touching anything, and it did so invisibly: the
  // Sentry capture at the swallow in `client.ts` reaches nothing while org-wide
  // error ingestion is down.
  //
  // The third option is to claim NEITHER, and let the four surfaces that make
  // durable machine-read claims refuse to answer instead. A 5xx withholds the
  // page from indexing, so an un-gated demo cannot be indexed either (there is
  // no 200 to index), AND removes nothing already indexed, because crawlers
  // read 5xx as "come back later" rather than "this is gone". Both halves of
  // the old trade are satisfied at once. See `./degraded.ts` for the full
  // argument, and `src/lib/seo/degradedRender.test.ts` for the pins.
  //
  // `isDemoSite()` still fails CLOSED on this object, so any consumer this
  // change did not reach keeps the old conservative behaviour rather than
  // regressing to fail-open. Nothing about a REAL demo site changes.
  degraded: true,
  primary: '#000000',
  secondary: '#333333',
  hover: '#555555',
  surface: '#ffffff',
  'surface-alt': '#f5f5f5',
  'text-primary': '#000000',
  'text-secondary': '#666666',
  'text-inverse': '#ffffff',
  border: '#e0e0e0',
  pages: {},
  pageConfigs: [],
  siteMap: [],
  logo: {
    name: '',
    key: '',
    type: '',
    currentFile: { source: '' },
  },
};
