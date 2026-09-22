import type { PageConfig } from '@/types/SiteData';
// Explicit .ts extension (not the `@/` alias): this module is imported
// directly by staticParams.test.ts under `node --experimental-strip-types
// --test`, which has no tsconfig `paths` resolution. The `PageConfig` import
// above is type-only, so it is erased before the loader ever sees it.
import { isPageTurnedOff } from './pageEnabled.ts';

/**
 * The `slug` values `[slug]/page.tsx` should hand Next as prerender params.
 *
 * Deliberately a pure function in its own module (no `server-only`, no Next
 * imports) so `node --test` can call it. The route's `generateStaticParams`
 * is then nothing but "fetch site data, call this, map to params".
 *
 * Five exclusions, each for a reason a future edit must not lose:
 *
 *  - **Slugs containing `/`.** The migrator stores depth-2 pages as a single
 *    config with `slug: "features/ai-sites"`. Next matches that URL as
 *    `[slug]="features"` / `[itemId]="ai-sites"`, so it is served by
 *    `[slug]/[itemId]/page.tsx`, never by this route. Emitting it here would
 *    prerender `/features%2Fai-sites`, a URL nothing links to.
 *  - **`format: 'subscribers'`.** VR_Client_API synthesises this page so
 *    EmailPopup can find the subscribers collection id. `[slug]/page.tsx`
 *    hard-`notFound()`s it on purpose; prerendering a 404 wastes a build slot
 *    and puts a 404 in the prerender manifest.
 *  - **The home page.** Served by `/`. `getSiteData()` already filters it out
 *    of `pageConfigs`, so this is a belt-and-braces guard against that filter
 *    changing.
 *  - **Blank slugs.** A malformed config must not produce a `/` param that
 *    collides with the home route.
 *  - **Pages the owner turned off** (`isPageTurnedOff`). `[slug]/page.tsx`
 *    answers `notFound()` for them, so this is the same reason `subscribers`
 *    is excluded one bullet up: prerendering a 404 spends a build slot and
 *    puts a 404 in the prerender manifest. It cannot strand a page that comes
 *    back, because `dynamicParams = true` renders any slug that was not
 *    prerendered on first request, and the Studio save that flips the switch
 *    fires the revalidate webhook.
 *
 * `alwaysOn` carries the slugs the route serves with no page config at all
 * (privacy, terms). They are appended rather than prepended so a real authored
 * page of the same slug keeps its position, and the dedupe keeps the first
 * occurrence either way.
 *
 * O(n) over page configs with a Set for dedupe. Page counts are double digits
 * at most, but this runs once per build per site and the ordering guarantee is
 * worth more than the micro-optimisation.
 */
export function slugsForStaticParams(
  pageConfigs: PageConfig[] | undefined,
  alwaysOn: readonly string[] = [],
): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];

  const add = (slug: string | undefined) => {
    if (!slug) return;
    if (slug.includes('/')) return;
    if (slug === 'home') return;
    if (seen.has(slug)) return;
    seen.add(slug);
    slugs.push(slug);
  };

  for (const page of pageConfigs ?? []) {
    if (page?.format === 'subscribers') continue;
    if (isPageTurnedOff(page)) continue;
    add(page?.slug);
  }
  for (const slug of alwaysOn) add(slug);

  return slugs;
}
