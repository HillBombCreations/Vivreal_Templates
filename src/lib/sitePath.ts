/**
 * The site's base path at run time, and the one prefix rule (release B, F270;
 * vivreal-hq docs/projects/next-release-B/design-help-path.md SW-B-H5, SW-B-H7,
 * row TP-3).
 *
 * `VIVREAL_SITE_BASE_PATH` is set by `next.config.ts` `env`, which Next inlines
 * into the server, edge and client bundles at BUILD time. So the value never
 * comes from the app's stored buildSpec or its run-time environment, and the
 * server and the browser always agree on it. `''` on every site but the help
 * site.
 *
 * Next adds the base itself to `Link`, `router.push`/`replace`, `redirect()`,
 * `headers()`, `rewrites()` and its own assets. Every OTHER address this app
 * writes that starts with `/` goes through `sitePath`: a `fetch` to its own
 * API routes, a hand-built `Location`, middleware's redirects, the beacon's
 * page path. `withSitePath` is the renderer's own rule (SW-B-H7), so the two
 * repos can never disagree on it; the empty base is the identity.
 *
 * NOT idempotent, exactly as Next's `Link`: wrap an address once, where it is
 * written.
 */
import { withSitePath } from '@hillbombcreations/site-renderer/bindings';

export const SITE_BASE_PATH: string = process.env.VIVREAL_SITE_BASE_PATH ?? '';

/** `url` under this site's base path (`/x` becomes `/help/x`); unchanged when the base is `''`. */
export function sitePath(url: string): string {
  return withSitePath(SITE_BASE_PATH, url);
}

/**
 * The page path a view is reported under (TP-9): the router's path with the
 * base, so a help view on host vivreal.io reads `/help/...` and never collides
 * with a marketing page of the same name. Without a router path, the browser's
 * own, which already carries the base. Unchanged on every other site.
 */
export function beaconPagePath(routerPath: string | null, browserPath: string): string {
  return routerPath ? sitePath(routerPath) : browserPath;
}
