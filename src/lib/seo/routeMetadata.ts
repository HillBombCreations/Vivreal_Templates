import type { Metadata } from 'next';
import { isDemoSite } from './demoSafety.ts';
import { resolveCanonicalUrl } from '../og/siteOrigin.ts';
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
  // Deliberately the narrow canonicalUrl-ONLY resolver, not the general
  // resolveSiteOrigin (env/live_url/domainName) chain — every existing fleet
  // site already has a domainName, so falling back to it here would emit a
  // brand-new canonical tag on every page of every site that never had one.
  // Default-absent: no authored canonicalUrl ⇒ no tag, byte-identical to today.
  const origin = resolveCanonicalUrl(siteData);
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
