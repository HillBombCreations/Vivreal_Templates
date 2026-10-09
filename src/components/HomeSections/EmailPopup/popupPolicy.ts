/**
 * O10: the newsletter popup stops covering the shop on phones.
 *
 * 1. Checkout pages (the order confirmation and the page Stripe's Back button
 *    returns to) never open it, at ANY width (QA-W2-2). A shopper who just
 *    paid, or just backed out of paying, is not asked to sign up.
 * 2. On a phone, shop and product pages never open it. There the dialog covers
 *    the whole screen and stood between a shopper and Add to cart.
 * 3. On a phone, when the owner never chose a trigger, it waits for a scroll instead of the
 *    3 s timer, so it appears to someone reading, not someone who just landed.
 *    A trigger the owner DID choose is kept as chosen.
 *
 * Pure and free of React and `@/` imports, so it runs under `node --test`; the
 * popup wrapper is the thin call site.
 */
import { pagesNeedCart, type CartGatePage } from '../../../lib/payments.ts';
import { CHECKOUT_RESULT_PAGES } from '../../../lib/pages/builtInPages.ts';

/** Same phone breakpoint as `src/hooks/use-mobile.tsx` (768 and wider is not a phone). */
export const PHONE_MAX_WIDTH = 767;
export const PHONE_MEDIA_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px)`;

/** The page formats a shopper lands on after paying or cancelling. */
const CHECKOUT_PAGE_FORMATS: ReadonlySet<string> = new Set(['checkout-success', 'checkout-cancel']);

export type PopupPage = CartGatePage & { slug?: string };

export type PopupPathKind = 'checkout' | 'shop' | null;

export type PopupTriggerMode = 'delay' | 'scroll' | 'exit';

const trimSlashes = (value: string | undefined | null) => (value ?? '').replace(/^\/+|\/+$/g, '');

/**
 * What kind of page this path is, for the popup.
 *
 * `checkout`: a checkout result page, by its stored format OR, when the site
 * stores none, by the built-in slugs this app serves on every site anyway
 * (`CHECKOUT_RESULT_PAGES`). QA-W2-2: Cobalt stores no `checkoutcancel` page,
 * so a lookup in the stored pages alone never saw it.
 * `shop`: a `products` page, or any page that sells (`pagesNeedCart`, the rule
 * that mounts the bag), and any deeper path under one (a product page).
 * An exact slug match is tried first, so a nested page like
 * `features/ai-sites` is judged on its own config and not on its parent's.
 */
export function classifyPopupPath(pages: readonly PopupPage[], pathname: string | null | undefined): PopupPathKind {
  const path = trimSlashes(pathname);
  if (!path) return null;
  const first = path.split('/')[0];
  const page =
    pages.find((p) => trimSlashes(p.slug) === path) ?? pages.find((p) => trimSlashes(p.slug) === first);
  if (!page) return CHECKOUT_RESULT_PAGES.some((p) => p.slug === path) ? 'checkout' : null;
  if (page.format && CHECKOUT_PAGE_FORMATS.has(page.format)) return 'checkout';
  return page.format === 'products' || pagesNeedCart([page]) ? 'shop' : null;
}

/**
 * The trigger to arm, or `null` for no popup on this page at this width.
 * `ownerMode` is the authored `trigger.mode`, absent when the owner never chose.
 */
export function resolvePopupTrigger({
  ownerMode,
  isPhone,
  pathKind,
}: {
  ownerMode: PopupTriggerMode | undefined;
  isPhone: boolean;
  pathKind: PopupPathKind;
}): PopupTriggerMode | null {
  if (pathKind === 'checkout') return null;
  if (isPhone && pathKind === 'shop') return null;
  if (ownerMode) return ownerMode;
  return isPhone ? 'scroll' : 'delay';
}
