/**
 * The one place this app asks "has the owner turned this page off?".
 *
 * `enabled` is the portal's per-page on/off switch (`UniversalPage.enabled`,
 * documented there as "Whether this page is currently active. Default true",
 * with a sibling `optional` flag deciding whether the owner may flip it at
 * all). The Studio shows an off page as "(hidden)" in its page list.
 *
 * ## What it used to mean here, and what it means now
 *
 * Until this module existed, `enabled` was a NAVIGATION flag and nothing else.
 * The renderer drops an off page from the navbar and the footer
 * (`vivreal-site-renderer/src/chrome/deriveChrome.ts`, the `deriveMenuItems`
 * and `deriveFooterColumns` loops), and no other reader on the serving path
 * existed: VR_Client_API hands `site.pages` back verbatim, `getSiteData()`
 * filtered only the home page out of `pageConfigs`, the route matched on slug
 * alone, and `buildSitemapEntries` never looked at it. So an owner who turned
 * a page off got it hidden from the menu while it stayed reachable at its URL
 * and stayed SUBMITTED to search engines in `sitemap.xml`, which is the
 * opposite of what "off" means to the person who flipped the switch, and the
 * sitemap half actively invited strangers to the page they had just retired.
 *
 * Two surfaces read this predicate now, and they answer the same way BECAUSE
 * they read the same function rather than two copies of the same condition:
 *
 *   - the page routes (`[slug]`, and the nested-page and detail-item arms of
 *     `[slug]/[itemId]`) answer `notFound()`;
 *   - `buildSitemapEntries` leaves the page, and any detail items under it,
 *     out of `sitemap.xml` entirely.
 *
 * 404 rather than a redirect home, deliberately. The owner retired ONE page,
 * they did not say "send these visitors to my front door", and a 200 at a URL
 * whose content is now something else is a soft 404: the search engine keeps
 * the URL, treats it as a near-duplicate of the home page, and the visitor who
 * followed an old link is left wondering what happened to the page they asked
 * for. A 404 is the one answer that is true for both audiences, it is what
 * this route already says for a page that was deleted rather than switched
 * off, and it is reversible the moment the owner flips the switch back. An
 * owner who wants an old URL to LAND somewhere has a better tool for it: they
 * delete the page and author a redirect, which is the path that already works
 * (an authored redirect does not fire while the page still exists, because
 * middleware treats a live page slug as content a redirect must never shadow,
 * `isLiveContentPath` in `src/lib/edgeSiteMap.ts`).
 *
 * ## Navigation is NOT changed by any of this
 *
 * Nav and footer derivation stays exactly where it is, in the renderer, on the
 * same flag, with the same rule. This module reads the flag the same way that
 * rule does (see the comparison note below) so the two cannot disagree about
 * which pages are off. Nothing here adds or removes a nav link.
 *
 * ## The home page is out of scope, on purpose
 *
 * `/` is served by `app/page.tsx` from `siteData.homePageConfig` and never
 * consults `enabled`; `[slug]` cannot receive it (`getSiteData()` filters the
 * home page out of `pageConfigs`), and the sitemap's ROOT entry is decided by
 * `isAuthorHiddenPage` alone. Taking a site's root page and its root sitemap
 * entry away over this switch would be a site-wide regression nobody authored,
 * which is the same reason `buildSitemapEntries` refuses to let the
 * page-format rule reach the root entry.
 */

/**
 * The minimum page shape this rule reads.
 *
 * Structural rather than `Pick<PageConfig, 'enabled'>` so the module stays
 * importable by `node --experimental-strip-types --test`, which resolves no
 * tsconfig `paths` and therefore cannot follow the `@/types/SiteData` alias.
 * Same convention `src/lib/seo/pageIndexing.ts` uses for `IndexablePage`.
 */
export type SwitchablePage = {
  enabled?: boolean;
};

/**
 * Has the owner turned this page off?
 *
 * `=== false` EXACTLY, and this is the load-bearing detail. Absent, `null` and
 * `undefined` all mean ON: the field is optional, most pages in the fleet have
 * never carried it, and the whole platform already reads its absence as "on".
 * It is byte-identical to the renderer's nav rule (`if (p.enabled === false)
 * continue`), so a page that is in the menu today can never be 404'd by this,
 * and a page this 404s is a page the menu has already dropped. A looser form
 * (`!page?.enabled`, or `page?.enabled !== true`) would take every page that
 * predates the field off the live site and out of the sitemap, fleet-wide, on
 * the first deploy. That is the one direction of error this must not take.
 */
export function isPageTurnedOff(page: SwitchablePage | undefined | null): boolean {
  return page?.enabled === false;
}
