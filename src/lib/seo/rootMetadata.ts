import type { Metadata } from 'next';
import type { SiteData } from '@/types/SiteData';
// Explicit .ts extension (not the `@/` alias): imported directly by
// rootMetadata.test.ts under `node --experimental-strip-types --test`, which
// has no tsconfig `paths` resolution — same convention routeMetadata.ts /
// siteOrigin.ts already follow.
import { isDemoSite, getDemoSourceUrl } from './demoSafety.ts';
import { resolveSiteOrigin } from '../og/siteOrigin.ts';

/**
 * Compose the root layout's `generateMetadata()` result from an already-
 * fetched `siteData`. Extracted out of `layout.tsx` (which contains JSX and
 * so cannot be `import`ed by the plain-Node test runner) so this composition
 * is genuinely unit-testable — see rootMetadata.test.ts.
 *
 * Deliberately does NOT set a route canonical here. `page.tsx` (home) already
 * emits its own via `buildRouteCanonicalMetadata(siteData, '/')`, so doing it
 * again at the layout level was redundant on every route that sets its own
 * `alternates` and harmful on every route that doesn't — every 404/error
 * boundary (`not-found.tsx`, `[...segments]/page.tsx`, `error.tsx`) inherited
 * a canonical pointing at the homepage, a soft-404/URL-consolidation signal
 * to Google. See canonical-emission-review.md CONCERN 1.
 *
 * Brand-asset hardening: `icons` is set from `siteData.favicon` ONLY when
 * present. Absent `favicon` ⇒ no `icons` key at all — byte-identical to
 * before this field existed.
 *
 * SEO demo-safety: a pre-cutover demo emits `noindex, nofollow` on every
 * page, and points its canonical at the prospect's ORIGINAL site so any
 * crawler that still reaches the demo attributes the content there. Absent a
 * known source URL, the noindex alone protects them. A non-demo (every
 * existing site) adds neither key and is byte-identical to before.
 */
export function buildRootMetadata(siteData: SiteData): Metadata {
  const origin = resolveSiteOrigin(siteData, { surface: 'deployed' });
  const demo = isDemoSite(siteData);
  const demoSource = demo ? getDemoSourceUrl(siteData) : '';
  return {
    ...(origin && { metadataBase: new URL(origin) }),
    ...(siteData.favicon && { icons: { icon: siteData.favicon } }),
    ...(demo && { robots: { index: false, follow: false } }),
    ...(demo && demoSource && { alternates: { canonical: demoSource } }),
  };
}
