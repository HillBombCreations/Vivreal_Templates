import 'server-only';
import * as Sentry from '@sentry/nextjs';
import type { MetadataRoute } from 'next';
import { getSiteMap } from '@/lib/api/siteData';
import { DegradedUpstreamError } from '@/lib/api/siteData/degraded';
import { withDomainsSitemapEntry } from '@/lib/domains/publicSearch';
import { SITEMAP_REFUSED, sitemapRefusedLine } from './sitemapSignals';

/**
 * Every address the page list names, for `/sitemap.xml` and its parts.
 *
 * A refusal (a degraded upstream read, #149) is logged as `sitemap.refused`
 * and sent to Sentry, where the alert rule `sitemap.refused >= 3 in 15 min`
 * reads it, then re-thrown so the route answers 5xx and the crawler keeps the
 * list it already has. An empty list is never served in its place.
 */
export async function loadSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const siteId = process.env.SITE_ID || '';
  try {
    const siteMap = await getSiteMap();
    // `/domains` is a route, not a CMS page, so the CMS-built map never lists
    // it. Gated to the Vivreal marketing deployment like the page itself.
    return withDomainsSitemapEntry(siteMap, siteId, (url) => ({
      url,
      changeFrequency: 'monthly',
      priority: 0.8,
    }));
  } catch (err) {
    if (err instanceof DegradedUpstreamError) {
      console.error(sitemapRefusedLine({ siteId, cause: err.whatIsUnknown }));
      Sentry.captureMessage(SITEMAP_REFUSED, {
        level: 'error',
        fingerprint: ['templates.sitemap.refused', siteId || 'unknown'],
        tags: { siteId: siteId || 'unknown', cause: err.whatIsUnknown },
      });
    }
    throw err;
  }
}
