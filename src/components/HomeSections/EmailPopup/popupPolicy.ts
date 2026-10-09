/**
 * O10: the newsletter popup stops covering the shop on phones.
 *
 * Two rules, both for phone widths only, so the desktop popup is unchanged:
 * 1. Shop, product and checkout pages never open it. On a phone the dialog
 *    covers the whole screen, and on those pages it stood between a shopper and
 *    Add to cart.
 * 2. When the owner never chose a trigger, it waits for a scroll instead of the
 *    3 s timer, so it appears to someone reading, not someone who just landed.
 *    A trigger the owner DID choose is kept as chosen.
 *
 * Pure and free of React and `@/` imports, so it runs under `node --test`; the
 * popup wrapper is the thin call site.
 */
import { pagesNeedCart, type CartGatePage } from '../../../lib/payments.ts';

/** Same phone breakpoint as `src/hooks/use-mobile.tsx` (768 and wider is not a phone). */
export const PHONE_MAX_WIDTH = 767;
export const PHONE_MEDIA_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px)`;

/** The page formats a shopper lands on after paying or cancelling. */
const CHECKOUT_PAGE_FORMATS: ReadonlySet<string> = new Set(['checkout-success', 'checkout-cancel']);

export type PopupPage = CartGatePage & { slug?: string };

export type PopupTriggerMode = 'delay' | 'scroll' | 'exit';

const trimSlashes = (value: string | undefined | null) => (value ?? '').replace(/^\/+|\/+$/g, '');

/**
 * Is this path a shop page, a product page under one, or a checkout page?
 *
 * A shop is a `products` page, or any page that sells (`pagesNeedCart`, the same
 * rule that mounts the bag). A product page is any deeper path under a shop. An
 * exact slug match is tried first, so a nested page like `features/ai-sites`
 * is judged on its own config and not on its parent's.
 */
export function isShopOrCheckoutPath(pages: readonly PopupPage[], pathname: string | null | undefined): boolean {
  const path = trimSlashes(pathname);
  if (!path) return false;
  const first = path.split('/')[0];
  const page =
    pages.find((p) => trimSlashes(p.slug) === path) ?? pages.find((p) => trimSlashes(p.slug) === first);
  if (!page) return false;
  if (page.format && CHECKOUT_PAGE_FORMATS.has(page.format)) return true;
  return page.format === 'products' || pagesNeedCart([page]);
}

/**
 * The trigger to arm, or `null` for no popup on this page at this width.
 * `ownerMode` is the authored `trigger.mode`, absent when the owner never chose.
 */
export function resolvePopupTrigger({
  ownerMode,
  isPhone,
  onShopOrCheckoutPath,
}: {
  ownerMode: PopupTriggerMode | undefined;
  isPhone: boolean;
  onShopOrCheckoutPath: boolean;
}): PopupTriggerMode | null {
  if (isPhone && onShopOrCheckoutPath) return null;
  if (ownerMode) return ownerMode;
  return isPhone ? 'scroll' : 'delay';
}
