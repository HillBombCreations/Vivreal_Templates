/**
 * The page list's two signals (v5 search R4; seo-visibility R4 row):
 *   - `sitemap.built { siteId, urls, items, ms }` on every successful build,
 *     so the size of each site's list (the `SitemapUrls` gauge in the plan) is
 *     readable from the logs;
 *   - `sitemap.refused { siteId, cause }` when the file is refused because an
 *     upstream read was degraded. That one also goes to Sentry from the route
 *     (Templates' alarms are Sentry alert rules): the rule is
 *     `sitemap.refused >= 3 in 15 min` on any site, since one refusal is a
 *     blip the crawler survives (it keeps the last file) and three in a row is
 *     a site whose list search engines can no longer refresh.
 *
 * Pure (console only), so it runs under `node --test`.
 */
export const SITEMAP_BUILT = 'sitemap.built';
export const SITEMAP_REFUSED = 'sitemap.refused';

export interface SitemapBuiltFields {
  siteId: string;
  urls: number;
  items: number;
  ms: number;
}

export function sitemapBuiltLine(fields: SitemapBuiltFields): string {
  return JSON.stringify({ event: SITEMAP_BUILT, ...fields });
}

export function logSitemapBuilt(fields: SitemapBuiltFields): void {
  console.log(sitemapBuiltLine(fields));
}

export function sitemapRefusedLine({ siteId, cause }: { siteId: string; cause: string }): string {
  return JSON.stringify({ event: SITEMAP_REFUSED, siteId, cause });
}
