'use client';

import { useEffect } from 'react';
import { installCtaClickTracking } from '@/lib/ctaTracking';

/**
 * Null-rendering mount for the `cta_click` listener (marketing-measurement T2).
 * All behaviour, including the own-site gate, lives in `lib/ctaTracking.ts` so
 * it is unit-testable without a browser.
 */
export default function CtaClickTracking({
  /** `isVivrealOwnSite(process.env.SITE_ID)` from the root layout. Required, so a mount that forgets it does not compile. */
  vivrealOwnSite,
}: {
  vivrealOwnSite: boolean;
}) {
  useEffect(() => installCtaClickTracking(vivrealOwnSite), [vivrealOwnSite]);

  return null;
}
