import type { SiteData } from '@/types/SiteData';

/**
 * Resolve the origin for the site's INDEXED, crawler-cached surfaces: JSON-LD
 * `url`, `robots.txt` `Sitemap:`, and sitemap `<loc>` entries. Deliberately a
 * separate resolver from `resolveSiteOrigin` (`@/lib/og/ogImage`, which
 * OG/metadata use), with one precedence flip: a `domainName`, once set, wins
 * over `domainInformation.live_url`.
 *
 * Why: `live_url` is written by Vivreal_EventHandler's site-deploy pipeline
 * and briefly holds the raw `*.amplifyapp.com` host during the `getDefaultUrl`
 * step — `checkDomainAssociaion`/`markSiteLive` overwrite it with the real
 * domain moments later, once Amplify's custom-domain association completes
 * (`Vivreal_EventHandler/src/handlers/siteDeploy/{getDefaultUrl,
 * checkDomainAssociaion,markSiteLive}/index.js`). `domainName` is the durable,
 * customer-authored value and is never written as an amplifyapp host. A
 * fleet read on 2026-08-23 confirmed the two agree once a site is live: three
 * custom-apex sites (wavesofgrainco.com, dougs-kitchen.com,
 * comedycollectivechi.com) all carry `domainInformation.live_url` identical to
 * `https://${domainName}`; the only divergence window is the brief
 * pre-domain-association period at initial site creation. For OG/canonical
 * metadata that window is a low-consequence cosmetic blip (accepted already —
 * see `resolveSiteOrigin`'s `live_url`-first precedence); for JSON-LD/sitemap
 * it would put an amplifyapp URL in front of a crawler that caches pages for
 * days, so this resolver prefers the durable value instead.
 *
 * `.vivreal.io` subdomain-only sites never populate `domainName` (VR_Client_API
 * only returns it for a custom domain — see the `sitemap` comment in
 * `robots.tsx`), so they still resolve through `live_url`.
 *
 * No `import 'server-only'` here (unlike `ogImage.ts`, which re-exports this):
 * that sentinel is a Next.js build-time module, not a real npm package, so a
 * file that imports it can't be exercised under plain `node --test`. Every
 * real caller reaches this only via `@/lib/og/ogImage`'s re-export, which
 * keeps the server-only guard on the public import path.
 */
export function resolveIndexedOrigin(
  siteData?: Pick<SiteData, 'domainName' | 'domainInformation'> | null,
): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const domain = siteData?.domainName?.trim();
  if (domain) return `https://${domain.replace(/\/+$/, '')}`;
  const liveUrl = siteData?.domainInformation?.live_url?.trim();
  return liveUrl ? liveUrl.replace(/\/+$/, '') : '';
}

/**
 * Build a content-detail page's absolute URL for JSON-LD `url` fields, via
 * {@link resolveIndexedOrigin}. Returns `undefined` when no origin is known —
 * every JSON-LD `url` call site already omits the field rather than emit a
 * broken relative/`undefined` URL.
 */
export function buildDetailUrl(
  siteData: Pick<SiteData, 'domainName' | 'domainInformation'>,
  slug: string,
  itemId: string,
): string | undefined {
  const origin = resolveIndexedOrigin(siteData);
  return origin ? `${origin}/${slug}/${itemId}` : undefined;
}
