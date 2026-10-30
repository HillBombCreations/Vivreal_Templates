/**
 * How many inner and item pages one site's build may prerender (owner ideas
 * fix-forward, 2026-10-30).
 *
 * WHY. Amplify refuses a build whose output passes 230,686,720 bytes, and
 * every Templates site carries about 194 MB that does not depend on its
 * content (server code, `public/`, traced modules, Amplify's own share;
 * measured on vivreal.io and help.vivreal.io builds, 2026-10-30). That leaves
 * about 36 MB for prerendered pages. Owner ideas T10 and T11 prerendered every
 * inner page and up to 300 item pages, and each prerendered page is about four
 * copies of the root layout's payload (HTML, RSC and two segment files), so
 * the cost per page scales with the size of the site's own record: 1.31 MB a
 * page on vivreal.io, 1.36 MB on help.vivreal.io. Promote run 41089220307
 * failed six sites at 231 to 625 MB.
 *
 * WHAT. One byte budget per site, spent on authored inner pages first (the
 * pages a visitor lands on), then items. The cost of a page is estimated from
 * the serialized site data with a margin over the measured ratio. Pages past
 * the budget are not listed, so they render on request exactly as they did
 * before T10/T11 (200, `no-store`): never a 404, never a 500. A small site
 * keeps every page cached, which is the plan's promise for normal sites.
 *
 * `scripts/build-size-guard.mjs` measures what the build actually wrote and
 * fails it before the cap if this estimate is ever wrong.
 */
import type { PageConfig } from '@/types/SiteData';
// Explicit .ts paths: `node --test` has no tsconfig `paths` resolution.
import { CHECKOUT_RESULT_SLUGS } from './builtInPages.ts';
import { slugsForStaticParams } from './staticParams.ts';

/** The bytes of prerendered inner and item pages one build may spend. */
export const PRERENDER_PAGE_BUDGET_BYTES = 20 * 1024 * 1024;

/**
 * Estimated page bytes per byte of serialized site data. Measured 2026-10-30,
 * page bytes over site data bytes: 4.3 (help.vivreal.io items) to 7.2 (its
 * /all-articles), 6.2 (vivreal.io blog posts) to 7.5 (vivreal.io /industries).
 * 8 sits above the highest, since the build guard is the only check after it.
 */
export const PAGE_COST_FACTOR = 8;

/**
 * No page costs less than this, however small the site record: Comedy
 * Collective (a 14 KB record) measured 197 to 365 KB an inner page on
 * 2026-10-30, so the floor sits above its largest.
 */
export const MIN_PAGE_COST_BYTES = 384 * 1024;

/** Bytes of the site data as the layout serializes it; Infinity when it cannot be measured. */
export function siteDataBytes(siteData: unknown): number {
  try {
    const json = JSON.stringify(siteData);
    return typeof json === 'string' ? Buffer.byteLength(json) : Number.POSITIVE_INFINITY;
  } catch {
    // A record that cannot be serialized cannot be costed: prerender nothing
    // extra rather than guess, and the pages render on request.
    return Number.POSITIVE_INFINITY;
  }
}

export interface PrerenderLimits {
  /** Estimated bytes one prerendered page costs on this site. */
  pageBytes: number;
  /** Pages the budget allows in total. */
  allowance: number;
  /** Authored inner pages `[slug]` may list. */
  slugs: number;
  /** Item pages `[slug]/[itemId]` may list. */
  items: number;
}

/**
 * The split for one site. Both routes call this with the same inputs, so they
 * agree without talking to each other: `[slug]` takes `slugs`, the item route
 * takes what is left.
 */
export function planPrerenderLimits(dataBytes: number, authoredSlugCount: number): PrerenderLimits {
  const pageBytes = Math.max(MIN_PAGE_COST_BYTES, PAGE_COST_FACTOR * dataBytes);
  const allowance = Number.isFinite(pageBytes) ? Math.floor(PRERENDER_PAGE_BUDGET_BYTES / pageBytes) : 0;
  const slugs = Math.min(Math.max(0, authoredSlugCount), allowance);
  return { pageBytes, allowance, slugs, items: allowance - slugs };
}

/**
 * The authored inner pages `[slug]` lists, in its order: its list without the
 * always-on checkout slugs. The item route calls this too, so both routes
 * count the same pages.
 */
export function authoredStaticSlugs(
  pageConfigs: PageConfig[] | undefined,
  isReservedSlug: (slug: string) => boolean,
): string[] {
  const always = new Set(CHECKOUT_RESULT_SLUGS);
  return slugsForStaticParams(pageConfigs).filter((slug) => !isReservedSlug(slug) && !always.has(slug));
}

/**
 * The `[slug]` list cut to the budget. The always-on slugs (the checkout
 * result pages) are kept whatever the budget: they bail at build, so they cost
 * nothing, and they are what keeps the list non-empty and the route free of a
 * build fallback (see `slugsForStaticParams`).
 */
export function capSlugParams(slugs: readonly string[], alwaysOn: readonly string[], limit: number): string[] {
  const always = new Set(alwaysOn);
  let kept = 0;
  return slugs.filter((slug) => {
    if (always.has(slug)) return true;
    if (kept >= limit) return false;
    kept += 1;
    return true;
  });
}

/** One build-log line per route, so a site's split is readable in its Amplify log. */
export function describePrerenderLimits(route: string, dataBytes: number, limits: PrerenderLimits, listed: number): string {
  return (
    `[prerender-budget] ${route}: siteData ${dataBytes} bytes, about ${limits.pageBytes} bytes a page, ` +
    `allowance ${limits.allowance} (slugs ${limits.slugs}, items ${limits.items}), listed ${listed}`
  );
}
