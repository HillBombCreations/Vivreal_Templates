import type { PageConfig } from '@/types/SiteData';

/**
 * The two Stripe/Square checkout result pages, served on EVERY site whether or
 * not the site stores a page for them.
 *
 * VR_Client_API hardcodes where a paying buyer lands
 * (`src/services/tenant/createCheckoutSession.js` success_url
 * `<origin>/checkoutsuccess?session_id=...`, cancel_url `<origin>/checkoutcancel`;
 * the Square path uses the same success slug). Until this module, this app
 * served those URLs only from stored page data, and the only writer of that
 * data is the site-loader at FIRST build, and only when the site already sold
 * something. A site that became a store later answered the buyer's
 * post-payment redirect with a 404, and because the order confirmation email
 * is fired from the success page, no receipt went out either
 * (docs/bugs/storefront-checkout-2026-10-07 in vivreal-hq).
 *
 * Slug, format and name match the site-loader's own seed
 * (`packages/site-loader/src/loader/checkoutResultPages.js`
 * `CHECKOUT_RESULT_PAGES`) so a synthesized page and a seeded bare page render
 * identically: no blocks and empty labels, which makes `[slug]/page.tsx`
 * synthesize the `checkout-status` block and the renderer's
 * `CheckoutResultTemplate` canonical copy render.
 *
 * Deliberately a plain module (no `server-only`, no Next imports) so the node
 * test runner can call it, and edge-safe so middleware can read the slugs.
 */
export const CHECKOUT_RESULT_PAGES = Object.freeze([
  Object.freeze({ slug: 'checkoutsuccess', format: 'checkout-success', name: 'Order confirmed' }),
  Object.freeze({ slug: 'checkoutcancel', format: 'checkout-cancel', name: 'Checkout cancelled' }),
]);

/** Slugs this app serves on every site even with no stored page. */
export const CHECKOUT_RESULT_SLUGS: readonly string[] = Object.freeze(
  CHECKOUT_RESULT_PAGES.map((p) => p.slug),
);

/**
 * The page config `[slug]/page.tsx` renders for `slug`.
 *
 * A STORED page always wins, matched exactly as `getPageBySlug` matches
 * (strict slug equality), so a site that already carries its own checkout
 * pages, with its own copy and blocks, renders them unchanged. That includes a
 * stored page the owner switched off: it is returned as stored and the route's
 * `isPageTurnedOff` guard 404s it exactly as before.
 *
 * Only when nothing is stored, and only for the two exact checkout slugs, is a
 * bare page synthesized. Any other missing slug stays `undefined`, so the
 * route's redirect-then-`notFound()` path is untouched. A fresh object every
 * call: the route spreads and extends it, and a shared instance would leak one
 * request's composition into the next.
 */
export function resolvePageForSlug(
  pageConfigs: readonly PageConfig[] | undefined,
  slug: string,
): PageConfig | undefined {
  const stored = pageConfigs?.find((p) => p.slug === slug);
  if (stored) return stored;

  const builtIn = CHECKOUT_RESULT_PAGES.find((p) => p.slug === slug);
  if (!builtIn) return undefined;

  return {
    slug: builtIn.slug,
    name: builtIn.name,
    format: builtIn.format,
    collectionId: null,
    labels: {},
  };
}
