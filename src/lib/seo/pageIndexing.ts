import type { Metadata } from 'next';

/**
 * The minimum page shape every indexing rule in this module reads.
 *
 * Structural rather than `Pick<PageConfig, 'format' | 'seo'>` so this module
 * stays importable by `node --experimental-strip-types --test`, which resolves
 * no tsconfig `paths` and therefore cannot follow the `@/types/SiteData` alias.
 * `PageConfig` declares both members compatibly (`format: string`,
 * `seo?: { noindex?: boolean }`), so a real page config assigns to this with no
 * cast, and `sitemap.ts`'s own narrowed page type does too.
 */
export type IndexablePage = {
  format?: string;
  seo?: { noindex?: boolean };
};

/**
 * Which Studio page TYPES must never be advertised to a search engine.
 *
 * Keyed on `pageConfig.format`, the authoritative page-type discriminant every
 * layer of this system already agrees on: the migrator's blueprint schema
 * (`@hillbombcreations/site-loader` `PageFormat` zod enum), the portal's
 * `PageFormat` union + `FORMAT_LABEL`/`isTypeLocked` registry
 * (`src/lib/sites/railTiers.ts`), the renderer's `isCheckoutFormat` chrome
 * predicate, and this repo's own `COMPOSE_FORMATS` route allowlist.
 *
 * Explicitly NOT keyed on the slug. The live defect that produced this module
 * is the proof: `dougs-kitchen.com` advertises `/checkoutsuccess` and
 * `/checkoutcancel`, whose SLUGS carry no separator while their FORMATS are
 * `checkout-success` / `checkout-cancel`. A slug pattern would have to guess at
 * both spellings, would miss a renamed slug entirely, and would falsely match a
 * legitimate page like `/checkout-guide`.
 *
 * ── What is here, and why ────────────────────────────────────────────────────
 *
 * `checkout-success` / `checkout-cancel` — the Stripe result pages. Four
 * independent reasons, any one of which is sufficient:
 *   1. Reachable ONLY as a Stripe redirect target. A crawler that lands on one
 *      has arrived with no session, so it indexes a "thank you for your order"
 *      page describing an order that does not exist.
 *   2. Near-duplicate content by construction: both render the same
 *      `checkout-status` block with the only difference being a boolean, so a
 *      site ships two thin pages that differ by a sentence.
 *   3. Zero search intent. Nobody searches for a shop's checkout-cancel page,
 *      so the entries only dilute the crawl budget of the pages that matter.
 *   4. The whole platform already treats them as SYSTEM pages, never content:
 *      the portal locks their type (`isTypeLocked`), the Studio link picker
 *      skips them, and the renderer's chrome derivation excludes them from both
 *      the navbar and the footer. The sitemap was the one surface that did not
 *      get the memo.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────
 *
 * Widening this set silently is how a fleet loses pages it wanted indexed, so
 * every candidate that was considered and rejected is recorded:
 *   - `subscribe`, `form`, `inquiry`, `intake`, `booking-hub`, `quiz` — these
 *     ARE the conversion pages. A business actively wants "contact", "book a
 *     table", "sell with us" and "find your treatment" in search results. Being
 *     a form does not make a page transactional in the post-transaction sense.
 *   - `static` (privacy / terms) — low value but legitimately indexable, and
 *     they are already live in fleet sitemaps; removing them would change
 *     sitemap contents on every site for no defect.
 *   - `home` and `subscribers` — excluded from the sitemap for reasons that are
 *     NOT "must not be indexed", so they are kept as their own conditions in
 *     `buildSitemapEntries`: home IS in the sitemap (as the root entry, so the
 *     `/home` form would be a duplicate), and `subscribers` is a synthetic data
 *     carrier VR_Client_API injects whose route `notFound()`s. Note that the
 *     root entry DOES answer to the author rule below (an owner can hide home
 *     from search like any other page); it just never answers to this list.
 *   - cart / login / account / order-confirmation / thank-you / search-results —
 *     the obvious members of this class in a normal ecommerce app. None of them
 *     exists here: the cart is a dialog (`CartDialog`), there are no customer
 *     accounts on a Vivreal site, `checkout-success` IS the order confirmation,
 *     and storefront search is a query param inside a `products`/`catalog` page
 *     rather than a page type. Grepped across the site-loader `PageFormat` enum,
 *     the portal `PageFormat` union and this repo's `COMPOSE_FORMATS`: zero
 *     occurrences. Nothing to exclude.
 */
export const NON_INDEXABLE_PAGE_FORMATS: ReadonlySet<string> = new Set([
  'checkout-success',
  'checkout-cancel',
]);

/** Is this page type one search engines must never be pointed at? */
export function isNonIndexablePageFormat(format: string | undefined): boolean {
  return format !== undefined && NON_INDEXABLE_PAGE_FORMATS.has(format);
}

/**
 * The AUTHOR rule: did a human explicitly hide this page from search?
 *
 * The one place in this app that reads the `seo.noindex` field path. Everything
 * that needs the answer (the page's `robots` metadata AND the sitemap) calls
 * this, so the field cannot be renamed or re-typed on one surface and not the
 * other. That drift is not hypothetical: before this function existed the route
 * read `seo?.noindex` inline while `buildSitemapEntries` did not read it at all,
 * so a page the author had hidden was still submitted in `sitemap.xml` while
 * that same page served `noindex`. That is Google Search Console's "Submitted URL
 * marked noindex" error, with the site simultaneously inviting and refusing the
 * crawl.
 *
 * Truthiness, not `=== true`, deliberately. It matches byte-for-byte what the
 * route already did with this flag, so unifying the two surfaces cannot make a
 * page that is hidden TODAY become visible. The portal only ever persists the
 * literal `true` (`Studio/seoDraft.ts` rebuilds the bag from a known key list
 * and drops `noindex` entirely when false), so the two forms cannot disagree on
 * real fleet data anyway, but if a hand-edited doc ever carried a truthy
 * non-boolean, the strict form would silently un-hide a page, and that is the
 * one direction of error this must not take.
 */
export function isAuthorHiddenPage(page: IndexablePage | undefined | null): boolean {
  return Boolean(page?.seo?.noindex);
}

/**
 * WHY this page must be withheld from search, or `null` if it must not be.
 *
 * The single predicate behind both search-facing surfaces: `buildSitemapEntries`
 * skips a page when this is non-null, and `buildPageRobotsMetadata` turns the
 * same answer into the page's `robots` directive. One function answering "should
 * this page be indexed" means the sitemap and the meta tag cannot disagree,
 * which is the entire failure mode this area keeps producing.
 *
 * It returns the CAUSE rather than a boolean because the two rules have
 * different origins and different consequences, and a future reader has to be
 * able to tell them apart:
 *   - `'author'`: a human turned the Studio search-visibility toggle off on
 *     THIS page. Site-specific, reversible in the Studio, and it can legitimately
 *     empty a sitemap (a link-only site is a real thing an owner may ask for).
 *   - `'format'`: the page TYPE is one no site should ever advertise, listed in
 *     `NON_INDEXABLE_PAGE_FORMATS` above. Fleet-wide, not authorable, and it can
 *     never empty a sitemap because no site consists only of checkout pages.
 *
 * Precedence is author-first and stated once here rather than re-derived at each
 * call site. It only matters for the `follow` half of the directive (an author
 * who hides a page wants nothing followed out of it), since both causes agree on
 * `index: false`.
 */
export type PageIndexingBlock = 'author' | 'format';

export function pageIndexingBlock(page: IndexablePage | undefined | null): PageIndexingBlock | null {
  if (isAuthorHiddenPage(page)) return 'author';
  if (isNonIndexablePageFormat(page?.format)) return 'format';
  return null;
}

/**
 * Whether a withheld page still passes link discovery on.
 *
 * A `Record<PageIndexingBlock, boolean>` rather than a `default:` arm or a
 * trailing `if`: adding a cause to `PageIndexingBlock` without deciding its
 * `follow` value is then a COMPILE error. The fall-through shapes all fail OPEN
 * (a page withheld from the sitemap that emits no `noindex` at all), which is
 * the precise inconsistency this module exists to prevent.
 */
const FOLLOW_WHEN_BLOCKED: Record<PageIndexingBlock, boolean> = {
  // The author hid the page; nothing should be discovered through it either.
  author: false,
  // `follow`, not `nofollow`: the checkout result pages carry a "continue
  // shopping" link back into the storefront, and a thin page that must not be
  // indexed should still pass discovery on to the pages that should be. That is
  // the standard treatment for a thank-you page.
  format: true,
};

/**
 * The page's `robots` metadata, or NO `robots` key at all.
 *
 * Absence from a sitemap does not prevent indexing — Google's own guidance is
 * that a sitemap is a hint, and any inbound link (a Stripe receipt email, a
 * browser-history share, an existing index entry) is enough to get a URL
 * crawled. These two URLs are ALREADY in the live fleet sitemap, so they have
 * already been offered to crawlers; dropping them from the sitemap stops the
 * invitation but cannot retract it. `noindex` is the only directive that can,
 * which is why this is not "sitemap-only" hygiene.
 *
 * Three outcomes, decided by `pageIndexingBlock` above:
 *   1. `'author'` ⇒ `noindex, nofollow`, byte-identical to what this repo
 *      already emitted for that flag. The author's stricter choice wins over the
 *      format default so turning the Studio toggle on can never make a page LESS
 *      hidden.
 *   2. `'format'` ⇒ `noindex, follow`.
 *   3. `null` ⇒ `{}`, no `robots` key at all, so the root layout's demo-site
 *      rule stands on its own exactly as it does today. Returning an empty
 *      object rather than `{ robots: undefined }` is load-bearing: the call site
 *      spreads this, and a present-but-undefined key would override the layout's
 *      value.
 *
 * Takes the PAGE rather than a `(format, authoredNoindex)` pair so that the
 * caller cannot compute the author half differently from the way the sitemap
 * does. A boolean parameter is an invitation to a second reader of the field.
 */
export function buildPageRobotsMetadata(
  page: IndexablePage | undefined | null,
): Pick<Metadata, 'robots'> {
  const block = pageIndexingBlock(page);
  if (!block) return {};
  // A fresh object per call: Next.js owns the returned metadata and a shared
  // reference across every page render is a mutation hazard for no gain.
  return { robots: { index: false, follow: FOLLOW_WHEN_BLOCKED[block] } };
}
