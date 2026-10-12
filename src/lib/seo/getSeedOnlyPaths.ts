import 'server-only';
import { cache } from 'react';
import { unstable_rethrow } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { isSeedOnlyPage, mayBeSeedOnlyPage } from '@hillbombcreations/site-renderer';
import type { PageConfig as RendererPageConfig } from '@hillbombcreations/site-renderer';
import { getSiteData } from '@/lib/api/siteData';
import { isDegradedSiteData } from '@/lib/api/siteData/degraded';
import { buildPageContext } from '@/lib/api/composition/buildPageContext';
import type { PageConfig } from '@/types/SiteData';
import { findSeedOnlyPaths, type SeedOnlyErrorReport, type SeedOnlyRules } from './seedOnlyPaths';

// Casts: Templates' PageConfig and the renderer's are the same stored page under two
// declarations (buildPageContext casts the same way); the rule reads it raw.
const RULES: SeedOnlyRules = {
  mayBeSeedOnlyPage: (page) => mayBeSeedOnlyPage(page as unknown as RendererPageConfig),
  isSeedOnlyPage: (page, data) =>
    isSeedOnlyPage(page as unknown as RendererPageConfig, data as Parameters<typeof isSeedOnlyPage>[1]),
};

/**
 * The seed-only page paths of this site (see `seedOnlyPaths.ts`), once per
 * request: the page route, its metadata, the Navbar and the Footer all ask,
 * and `cache` makes that one computation. The reads under it are the same
 * `getSiteData()` and collection reads the pages make, cached under the same
 * `site:<id>` and collection tags, so a Studio save that replaces the seed
 * text revalidates this answer with the page.
 *
 * A degraded site read answers `[]`: nothing is hidden on data that was not
 * read (the routes refuse that state on their own).
 *
 * FAILS OPEN. A throw from a list read or from the renderer's rule hides
 * nothing (see `findSeedOnlyPaths`), so the header, the footer, the page list
 * and every page still render with every link. It is logged once per
 * computation. Next's own control-flow throws (`notFound`, a dynamic bail)
 * are rethrown first, never swallowed.
 */
export const getSeedOnlyPaths = cache(async (): Promise<string[]> => {
  const siteData = await getSiteData();
  if (isDegradedSiteData(siteData)) return [];
  let reported = false;
  const onError: SeedOnlyErrorReport = (err, slug) => {
    unstable_rethrow(err);
    if (reported) return;
    reported = true;
    console.error(`[seedOnlyPaths] check failed open, nothing hidden (page ${slug ?? 'all'})`, err);
    Sentry.captureException(err, { tags: { area: 'seed-only-paths', siteId: process.env.SITE_ID || 'unknown' } });
  };
  return findSeedOnlyPaths(
    siteData.pageConfigs ?? [],
    RULES,
    async (page: PageConfig) => {
      const { input, listReadFailed, emptinessUnknown } = await buildPageContext({ siteData, page, isHome: false });
      return { getItems: input.data.getItems, listReadFailed, emptinessUnknown };
    },
    onError,
  );
});
