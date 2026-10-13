/**
 * What the renderer's commerce context is told about this site's payments
 * (F-C19, v5 item 19): the active provider, as before, and now whether the
 * product lists are paused (the owner chose "Disconnect, keep my products") or
 * moving to the new provider. While they are, every look and the product page
 * draw "Not for sale right now" in place of Add (renderer 1.85.0
 * `isListNotForSale`), and the product page itself still answers 200, so the
 * shop's pages and their place in search stay put during the switch.
 *
 * `selling`, absent (an older VR_Client_API) or anything unrecognised passes
 * no state at all, which the renderer reads as selling: exactly today.
 *
 * The site-level state is the strongest over the group's lists
 * (VR_Client_API `summarizeCommerce`): a provider switch pauses every payments
 * list of the business at once, and checkout refuses a paused item on its own
 * (409 `not_for_sale`) whatever a page shows.
 */
import type { SiteData } from '@/types/SiteData';

export interface RendererCommerce {
  paymentsProvider?: string | null;
  state?: 'paused' | 'moving';
}

export function rendererCommerce(
  siteData: Pick<SiteData, 'paymentsProvider' | 'commerce'> | null | undefined,
): RendererCommerce {
  const state = siteData?.commerce?.state;
  return {
    paymentsProvider: siteData?.paymentsProvider,
    ...(state === 'paused' || state === 'moving' ? { state } : {}),
  };
}
