import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { DegradedUpstreamError } from '@/lib/api/siteData/degraded';
import {
  buildDegradedRefusalCapture,
  DEGRADED_DETAIL_REFUSAL_FINGERPRINT,
} from '@/lib/api/errorCapture';

/**
 * Refuse to answer "this page does not exist" when the read that would have
 * proved it failed.
 *
 * WHY THIS IS ITS OWN MODULE
 * ..........................
 * Two call sites have to make this decision identically: `ComposedPageBody` in
 * `./renderComposedPage.tsx` (the live one, where every generic format lands)
 * and `ComposedFormatBody` in `app/[slug]/page.tsx` (currently unreachable for
 * those formats, kept correct under that file's lockstep contract). They have
 * drifted before, on this exact boundary: the transitional title band was
 * hand-mirrored between the same two files under a "cannot drift" comment and
 * drifted anyway. A shared function makes agreement structural instead of
 * remembered.
 *
 * WHY THE CAPTURE IS HERE AND NOT LEFT TO THE ERROR BOUNDARY
 * ..........................................................
 * `src/instrumentation.ts` exports no `onRequestError` hook, which
 * `api/errorCapture.ts` documents as the reason a swallowed failure reaches
 * Sentry from nowhere. A THROW has the mirror-image problem: it reaches Sentry
 * only through `app/error.tsx`, on the client, and Next replaces a server
 * component's error message with an opaque digest before it gets there. So the
 * `surface` and `whatIsUnknown` this error carries would never arrive, and an
 * operator watching a fleet-wide upstream episode would see a spike of
 * `clientFetchCached` fetch failures with no way to tell whether any page
 * actually refused to render. The explicit capture is what makes the refusal
 * countable, and countable is the whole point of preferring it to a silent 404.
 *
 * WHY IT IS NOT IN `api/siteData/degraded.ts`
 * ...........................................
 * That module is deliberately free of any Next or Sentry import so
 * `node --experimental-strip-types --test` can drive it, which is what pins the
 * refusal contract at all. Importing Sentry there would cost the suite that
 * proves this behaviour, to save one file.
 */
export function refuseUnknownEmptiness(format: string | undefined): never {
  const refusal = new DegradedUpstreamError(
    'a page-missing (404) verdict for a generic page',
    'the collection items for this page are UNKNOWN (siteData itself is healthy)',
  );
  Sentry.captureException(
    refusal,
    buildDegradedRefusalCapture({ siteId: process.env.SITE_ID, format }),
  );
  throw refusal;
}

/**
 * Refuse to answer "this detail item does not exist" when the read that would
 * have found it failed.
 *
 * The sibling of `refuseUnknownEmptiness` above, for
 * `app/[slug]/[itemId]/page.tsx`, and it differs from it in one way worth
 * stating at the throw rather than leaving to be rediscovered: this one runs in
 * an UN-SUSPENDED server component, so it sets a real 5xx status instead of
 * swapping the body under an already-flushed 200. That is the outcome the
 * generic-page refusal wanted and structurally could not have, and it is why
 * the detail route was the more damaging half of the pair: the 404 it replaces
 * was a real 404 telling a crawler that a live item is gone.
 *
 * It refuses the REDIRECT arm too. `redirectOrNotFound()` resolves an authored
 * 308 before falling back to 404, and a 308 issued because a read failed is the
 * more durable wrong claim of the two. A retired item's authored redirect still
 * resolves on the next request that gets an answer.
 *
 * Same shared-module reasoning as its sibling, doubled: the item-miss branch is
 * reached from six arms of that one file, so a per-arm throw would be six
 * chances to drift and six chances to lose the capture.
 */
export function refuseUnknownItemExistence(format: string | undefined): never {
  const refusal = new DegradedUpstreamError(
    'an item-missing (404) verdict for a detail page',
    'whether this item exists is UNKNOWN (siteData itself is healthy)',
  );
  Sentry.captureException(
    refusal,
    buildDegradedRefusalCapture({
      siteId: process.env.SITE_ID,
      format,
      fingerprint: DEGRADED_DETAIL_REFUSAL_FINGERPRINT,
    }),
  );
  throw refusal;
}
