import type { Metadata } from 'next';

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
 *     carrier VR_Client_API injects whose route `notFound()`s.
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
 * Three outcomes, in precedence order:
 *   1. Author set `seo.noindex` ⇒ `noindex, nofollow`, byte-identical to what
 *      this repo already emitted for that flag. The author's stricter choice
 *      wins over the format default so turning the Studio toggle on can never
 *      make a page LESS hidden.
 *   2. A non-indexable page type ⇒ `noindex, follow`. `follow`, not `nofollow`:
 *      the checkout result pages carry a "continue shopping" link back into the
 *      storefront, and a thin page that must not be indexed should still pass
 *      discovery on to the pages that should be. That is the standard treatment
 *      for a thank-you page.
 *   3. Anything else ⇒ `{}`, no `robots` key at all, so the root layout's
 *      demo-site rule stands on its own exactly as it does today. Returning an
 *      empty object rather than `{ robots: undefined }` is load-bearing: the
 *      call site spreads this, and a present-but-undefined key would override
 *      the layout's value.
 */
export function buildPageRobotsMetadata(
  format: string | undefined,
  authoredNoindex: boolean | undefined,
): Pick<Metadata, 'robots'> {
  if (authoredNoindex) return { robots: { index: false, follow: false } };
  if (isNonIndexablePageFormat(format)) return { robots: { index: false, follow: true } };
  return {};
}
