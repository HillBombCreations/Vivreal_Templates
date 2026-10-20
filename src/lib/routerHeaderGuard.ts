/**
 * Refuse forged Next router-header requests before they can poison a cache.
 * Design: vivreal-hq docs/projects/next-release-v7/
 * design-templates-router-header-strip-2026-10-18.md, Option B (owner
 * approved 2026-10-18).
 *
 * The defect, read from the installed `next` 16.3.8 (16.4.2 is identical):
 *   - `server/base-server.js` treats a request as RSC only when `RSC` is
 *     exactly `1`, and runs its `_rsc` cache-busting hash check only then.
 *   - `build/templates/app-page-runtime.js:198` decides PREFETCH on its own:
 *     `req.headers['next-router-prefetch'] === '1'`, no `RSC` needed. With a
 *     `Next-Router-Segment-Prefetch` header it answers with raw segment flight
 *     (`text/x-component`), or an empty 404 on a segment miss, under the
 *     route's OWN cache control (`s-maxage=300` on a prerendered page).
 *   - Next sets `Vary: RSC, Next-Router-*`, but the Amplify origin answers
 *     with `Vary: Accept-Encoding` only (measured 2026-10-18), so the CDN keys
 *     on the URL alone. One forged request therefore serves raw flight, or a
 *     blank page, to every visitor of that URL for up to 300 s.
 *
 * Why refuse rather than strip: stripping needs middleware to see these
 * headers, which takes `skipProxyUrlNormalize`, and that flag also stops Next
 * making middleware redirect `Location`s relative, which on Amplify ships the
 * compute's `localhost:3000` host to visitors (the 2026-08-29 llms.txt
 * incident). A rewrite needs no flag and leaves middleware untouched.
 *
 * Who legitimately sends these headers, so nothing real is refused:
 *   - Next's own client always sends `RSC: 1` with navigation and prefetch
 *     (`client/components/router-reducer/fetch-server-response.js:89`,
 *     `client/components/segment-cache/cache.js`). Re-check that line on
 *     every Next bump: if it ever stops sending `RSC: 1`, these rules start
 *     refusing real navigations.
 *   - Server actions send `Next-Action`, `Next-Router-State-Tree` and
 *     `Next-Url` WITHOUT `RSC` (`server-action-reducer.js:51-62`), and never a
 *     prefetch header. So `next-action` exempts ONLY the state-tree and
 *     `Next-Url` rules. It must never exempt the prefetch rules: Next treats a
 *     request as a server action only on POST
 *     (`server/lib/server-action-request-meta.js:39`), so on a GET the header
 *     changes nothing in the page runtime, and exempting on it would let any
 *     forged prefetch through by adding one header (PR #197 review pass 7, B1).
 *   - Browser link prefetch sends `Purpose` / `Sec-Purpose`, never these.
 *
 * Dependency free, so `node --experimental-strip-types` loads it and the test
 * can evaluate these exact rules with Next's own `matchHas`.
 */

export const ROUTER_HEADER_REFUSED_PATH = '/api/router-header-refused';

/**
 * The four router headers the vivreal.io CloudFront function strips, plus
 * `Next-HMR-Refresh` from Next's `FLIGHT_HEADERS`. `RSC` itself is not a rule:
 * it is the condition that makes these headers legitimate.
 */
export const ROUTER_HEADERS = Object.freeze([
  'next-router-prefetch',
  'next-router-segment-prefetch',
  'next-router-state-tree',
  'next-url',
  'next-hmr-refresh',
] as const);

/**
 * The router headers a server action legitimately sends alongside
 * `Next-Action` (`server-action-reducer.js:51-62`). Only these rules carry the
 * `next-action` exemption; see the module docblock.
 */
const SERVER_ACTION_HEADERS: ReadonlySet<string> = new Set(['next-router-state-tree', 'next-url']);

interface HeaderCondition {
  type: 'header';
  key: string;
  value?: string;
}

export interface RouterHeaderRefusalRewrite {
  source: string;
  has: HeaderCondition[];
  missing: HeaderCondition[];
  destination: string;
}

/**
 * One rule per header, because `has` is AND and one rule per header gives OR.
 * `missing` is satisfied only when NONE of its items match, and Next anchors a
 * condition `value` as `^1$`, so `RSC: 0`, an empty `RSC` and a repeated
 * `RSC` (Node joins it as `1, 1`) all still rewrite.
 *
 * Must be wired as `beforeFiles`: an `afterFiles` rule never runs for `/` or
 * any other filesystem match, which is exactly where the poison lands.
 */
export function routerHeaderRefusalRewrites(): RouterHeaderRefusalRewrite[] {
  return ROUTER_HEADERS.map((key) => ({
    source: '/:path*',
    has: [{ type: 'header', key }],
    missing: SERVER_ACTION_HEADERS.has(key)
      ? [
          { type: 'header', key: 'rsc', value: '1' },
          { type: 'header', key: 'next-action' },
        ]
      : [{ type: 'header', key: 'rsc', value: '1' }],
    destination: ROUTER_HEADER_REFUSED_PATH,
  }));
}
