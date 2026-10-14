import type { PageConfig } from '@/types/SiteData';
// Explicit .ts extensions (not the `@/` alias): this module is imported
// directly by policyPage.test.ts under `node --experimental-strip-types
// --test`, which has no tsconfig `paths` resolution. The `PageConfig` import
// above is type-only, so it is erased before the loader ever sees it.
import { isPageTurnedOff } from './pageEnabled.ts';
import { isSeedOnlySlug } from '../seo/seedOnlyPaths.ts';

/**
 * The href of the site's own privacy policy page, or `undefined` when the site
 * has none that this app would actually serve.
 *
 * There is no built-in privacy page (owner decision 2026-10-14, consistent with
 * FP2-08: no invented legal text), so `/privacy` 404s on a site that stores no
 * page there. Anything that links to a policy must therefore link to a STORED
 * page, and only one the `[slug]` route would serve rather than 404:
 *
 *  - **Stored, and the slug starts with `privacy`.** Kits store `privacy`,
 *    migrated sites `privacy-policy`. The format is deliberately NOT checked:
 *    kit policy pages are `about` or `standard`, not only `static`.
 *  - **Not turned off** (`isPageTurnedOff`), which the route 404s.
 *  - **Not seed-only** (`isSeedOnlySlug`), which the route 404s too.
 *  - **Single segment.** A slug carrying `/` is served by `[slug]/[itemId]`
 *    as a nested page, and is not the site's policy page.
 *
 * The first match in stored order wins. Pure, so the node runner can call it.
 */
export function resolvePrivacyPolicyHref(
  pageConfigs: readonly PageConfig[] | undefined,
  seedOnlyPaths: readonly string[],
): string | undefined {
  const page = (pageConfigs ?? []).find(
    (p) =>
      typeof p?.slug === 'string' &&
      p.slug.startsWith('privacy') &&
      !p.slug.includes('/') &&
      !isPageTurnedOff(p) &&
      !isSeedOnlySlug(seedOnlyPaths, p.slug),
  );
  return page ? `/${page.slug}` : undefined;
}
