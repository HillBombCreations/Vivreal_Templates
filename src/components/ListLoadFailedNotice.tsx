import { bailOutOfCachingDegradedRender } from '@/lib/renderGate';

/**
 * RW4-6: shown on a page that has its own content when one of its list reads
 * failed, and the reason that render is never cached.
 *
 * WHAT IT FIXES
 * .............
 * With the Client API down and a list read uncached, a page with authored copy
 * plus a list (an FAQ, a menu) answered 200 with the list silently gone, so the
 * shopper saw a page that looked complete and was not. On an ISR site the home
 * page is page-cached, and that incomplete render was STORED: measured against
 * `next start`, it served `s-maxage=60` and `x-nextjs-cache: HIT` with the list
 * still missing on every read after the upstream recovered.
 *
 * WHY THE PAGE STILL RENDERS, NOT A 500
 * ......................................
 * A page whose only content is its lists already refuses with a 500
 * (`refuseUnknownEmptiness`). This page has something else worth showing (the
 * hours, the address, the written intro), and on these routes the 200 shell
 * has already been sent before the list reads finish, so the status could only
 * become 500 by holding back every page that has a list until its reads land.
 * That would slow the healthy case on every request to improve the outage case.
 *
 * WHY THE CACHE BAIL LIVES IN HERE
 * ................................
 * So the note and the bail cannot be separated: anything that renders the note
 * also takes the render off the caches. What the bail does is documented on
 * `optOutOfCachingDegradedRender` in `src/lib/renderMode.ts`, and was measured
 * here too:
 *   - a dynamic route (every `[slug]` page, and every route on a site without
 *     ISR) is already `private, no-cache, no-store`, so the bail is inert and
 *     the shopper sees this note;
 *   - an ISR page-cached route (home) never stores the render: Next keeps the
 *     last good copy if it has one, otherwise answers 500 with nothing stored,
 *     and the first request after recovery renders the list. That 500 carries
 *     NO `Cache-Control` line; a plain throw in the same place gave the same
 *     header-less 500 (measured), so it is Next's failed-ISR-render path and
 *     not something this component can change. A CDN may hold that 500 for
 *     its error TTL; it never holds the incomplete page.
 * The Data Cache never holds the failure either: `clientFetchCached` returns
 * its fallback OUTSIDE `unstable_cache`, so the next read goes upstream.
 *
 * It replaces nothing in the renderer: the renderer has no slot for "this list
 * could not load", so the note sits above the composed body.
 */
export default async function ListLoadFailedNotice() {
  await bailOutOfCachingDegradedRender();
  return (
    // FQ-3: `content-grid` is a grid, so the sentence must sit in a CHILD
    // (which the grid places in its content track). Put directly on the text
    // element, the bare text became a grid item in the first, gutter-width
    // track: 61px wide, one word per line, at 390 and 1440 alike.
    <div role="status" data-list-load-failed="" className="content-grid py-6">
      <p className="text-center text-base" style={{ color: 'var(--text-secondary, #555)' }}>
        Part of this page could not load. Please try again in a moment.
      </p>
    </div>
  );
}
