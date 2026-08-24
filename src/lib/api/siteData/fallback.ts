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
  // `robots.tsx` is `force-dynamic`, so this is re-evaluated on EVERY request.
  // Without an explicit lifecycleState the key is absent, `isDemoSite()` takes
  // its existing-fleet default of "not a demo", and a sustained Client API
  // outage silently un-gates every demo site in the fleet: full permissive
  // robots policy and no noindex on a near-duplicate of a prospect's real
  // website (review-templates-106.md, "The demo gate is fail-open on an
  // upstream outage").
  //
  // The trade this makes, deliberately: during that same outage a LIVE site
  // also serves `Disallow: /` and `noindex, nofollow`. That is the right side
  // to fail on. The page being served on this path has no nav, no content and
  // no logo (see the Sentry capture in getSiteData), so the real choice is
  // between "a prospect's demo gets indexed" plus "an empty page gets indexed"
  // versus "a broken page is withheld until the next successful read."
  // Indexability recovers on that read; a demo indexed against the prospect we
  // are courting does not.
  lifecycleState: 'demo',
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
