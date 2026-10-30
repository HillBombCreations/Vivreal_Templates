/**
 * A visitor result: a message sent, a booking request or booking made, a
 * purchase (owner ideas 2026-10-29, plan 3.3, D16, T5 and T6). One call does
 * both halves:
 *
 *  - the first-party `gl` beacon (every plan), which VR_Analytics_API matches
 *    to an ad visit by the daily visitor hash, so the owner reads "3 of them
 *    sent you a message" with nothing stored on the visitor's device;
 *  - the owner's own Google Ads conversion, only on a site that connected one,
 *    only for a ticked result and only after an Accept (`lib/adsTag.ts`).
 *
 * A purchase is recorded once per paid order, and only for an order the
 * server confirmed paid, by the same `session_id` check and per-tab memory the
 * cart uses (`lib/confirmedOrderCart.ts`), so a reload of the success page
 * counts nothing twice.
 *
 * KNOWN GAP: the contact form's success is not recorded. The form is the
 * renderer's (`ConfigurableForm`), and renderer 1.93.0 exposes no success
 * callback to this app (`SiteRendererProvider` takes `onLinkTap`, not a form
 * hook), so there is nothing here to call it from.
 */
import { fireAdsConversion } from './adsTag.ts';
import { sendSiteEventHere, type SiteGoal } from './siteEvents.ts';
import { isOrderConfirmationId, type OrderCheck } from './orderConfirmationId.ts';
import type { ClearedOrderStore } from './confirmedOrderCart.ts';

export function recordSiteGoal(goal: SiteGoal): void {
  sendSiteEventHere({ k: 'gl', g: goal });
  fireAdsConversion(goal);
}

export const PURCHASE_RECORDED_KEY_PREFIX = 'vr-goal-purchase:';

/** Record the purchase result for a confirmed, paid order, once per order per tab. */
export async function recordPurchaseIfConfirmed({
  search,
  confirm,
  storage,
  record,
}: {
  search: string;
  confirm: (orderId: string) => Promise<OrderCheck>;
  storage: ClearedOrderStore | null;
  record: (goal: SiteGoal) => void;
}): Promise<boolean> {
  const orderId = new URLSearchParams(search).get('session_id');
  if (!isOrderConfirmationId(orderId)) return false;
  if ((await confirm(orderId)) !== 'confirmed') return false;
  if (storage) {
    const key = `${PURCHASE_RECORDED_KEY_PREFIX}${orderId}`;
    try {
      if (storage.getItem(key)) return false;
      storage.setItem(key, '1');
    } catch {
      // Blocked storage: record anyway. One extra count on a reload is better
      // than none at all for a real paid order.
    }
  }
  record('purchase');
  return true;
}
