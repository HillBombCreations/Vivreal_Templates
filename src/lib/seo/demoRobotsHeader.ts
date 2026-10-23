/**
 * `X-Robots-Tag: noindex, nofollow` on every response a DEMO site gives
 * (discovery batch 3.4, 2026-10-22).
 *
 * A demo's robots.txt now says `Allow: /` (see `robotsPolicy.ts`), because a
 * crawler that is refused a page never reads that page's noindex and can still
 * list the bare URL. Letting crawlers in is only safe if every response tells
 * them not to index it, so the header is set in three layers, and no single
 * cache gap can expose a demo:
 *
 *   1. middleware stamps it from the edge site map on every path except
 *      `/_next/static/*` (hashed build assets carry no site content);
 *   2. the llms.txt, mcp.json, sitemap and OG route handlers stamp it
 *      themselves, which covers a cold or failed edge map in middleware (that
 *      read fails OPEN by design);
 *   3. the page's own `<meta name="robots" content="noindex, nofollow">`
 *      (`rootMetadata.ts`) stays.
 *
 * The verdict is always `isDemoSite`, so a lifecycle value that is present
 * but is not the literal `'live'` is a demo here too.
 *
 * Pure apart from `edgeRouteIsDemo`, which reads the edge map (edge safe, no
 * `next/*`), so the whole module loads under `node --test`.
 */
import { getEdgeSiteMap } from '../edgeSiteMap.ts';

export const DEMO_ROBOTS_HEADER = 'X-Robots-Tag';
export const DEMO_ROBOTS_VALUE = 'noindex, nofollow';

/**
 * Whether middleware stamps this path. Everything but the hashed build assets
 * under `/_next/static/`, which are shared by every site and never content.
 */
export function stampsDemoRobotsHeader(pathname: string): boolean {
  return !pathname.startsWith('/_next/static/');
}

/** Set the header on `headers` when the site is a demo. Never removes one. */
export function applyDemoRobotsHeader(headers: Headers, isDemo: boolean | undefined): void {
  if (isDemo === true) headers.set(DEMO_ROBOTS_HEADER, DEMO_ROBOTS_VALUE);
}

/**
 * The same response with the header added when the site is a demo, or the
 * response untouched when it is not.
 *
 * Builds a NEW `Response` rather than mutating: a `Response` that came back
 * from `fetch` (the OG routes proxy one) has immutable headers, and setting
 * one throws.
 */
export function withDemoRobotsHeader(response: Response, isDemo: boolean | undefined): Response {
  if (isDemo !== true) return response;
  const headers = new Headers(response.headers);
  applyDemoRobotsHeader(headers, isDemo);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * The demo verdict for an EDGE route handler (llms.txt, mcp.json), which has
 * no `getSiteData()` (that read is Node only).
 *
 * Awaits the edge map, so on a cold instance this route makes its own read
 * (bounded by the map's cold deadline) instead of relying on middleware's
 * non-blocking peek. A failed read answers `false` (no header), the same
 * fail-open posture the map has everywhere else: a header withheld for one
 * response is undone by the next, and noindex on a live site's file is not.
 */
export async function edgeRouteIsDemo(): Promise<boolean> {
  const siteMap = await getEdgeSiteMap();
  return siteMap?.isDemo === true;
}
