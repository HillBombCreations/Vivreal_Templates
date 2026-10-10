import type { Metadata } from 'next';
import { isDemoSite } from './demoSafety.ts';
import { resolveCanonicalUrl, resolveSiteOrigin } from '../og/siteOrigin.ts';
// One shared shape, exported by the resolver that consumes it, so this file
// cannot drift from what resolveCanonicalUrl actually reads.
import type { OriginSiteData } from '../og/siteOrigin.ts';

export function resolveRouteCanonical(
  siteData: OriginSiteData,
  routePath: string,
  explicitCanonical?: string,
): string | undefined {
  if (isDemoSite(siteData)) return undefined;
  if (explicitCanonical) return explicitCanonical;
  // The stored canonicalUrl first. v5 (search R4, seo-visibility gap 2): when
  // it is absent, the site's resolved DURABLE origin (env, then live_url,
  // then the domain; an amplifyapp host is refused), so every live page names
  // one address. This used to answer nothing, deliberately, to keep the fleet
  // byte-identical; without a canonical, `www`, the vivreal.io subdomain and
  // the custom domain split one page's signals three ways. A demo still names
  // none (the guard above).
  const origin = resolveCanonicalUrl(siteData) || resolveSiteOrigin(siteData, { surface: 'durable' });
  if (!origin) return undefined;
  const normalizedPath = routePath === '/' ? '' : `/${routePath.replace(/^\/+|\/+$/g, '')}`;
  return `${origin}${normalizedPath}`;
}

export function buildRouteCanonicalMetadata(
  siteData: OriginSiteData,
  routePath: string,
  explicitCanonical?: string,
): Pick<Metadata, 'alternates'> {
  const canonical = resolveRouteCanonical(siteData, routePath, explicitCanonical);
  return canonical ? { alternates: { canonical } } : {};
}
