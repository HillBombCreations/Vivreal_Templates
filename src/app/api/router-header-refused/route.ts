import { ROUTER_HEADERS } from '../../../lib/routerHeaderGuard.ts';

/**
 * The destination of the router-header refusal rewrites in `next.config.ts`
 * (see `src/lib/routerHeaderGuard.ts`). Only a forged or broken client reaches
 * this: Next's own client always sends `RSC: 1` with these headers, and
 * server actions carry `Next-Action`.
 *
 * `force-dynamic` is load bearing. Without it Next prerenders a GET route
 * handler and gives it a static `s-maxage` (the favicon route shows
 * `s-maxage=31536000`), which would put a cached 400 at every URL the rewrite
 * sends here. `private, no-store` keeps this answer out of every cache, so a
 * forged request can poison nothing.
 *
 * No `next/server` import, so `node --test` loads this file directly.
 */
export const dynamic = 'force-dynamic';

const REFUSAL_HEADERS = Object.freeze({
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'private, no-store, max-age=0',
});

function refuse(request: Request, body: string | null): Response {
  // Header NAMES only, never values: Next-Url and the state tree can carry
  // a visitor's path.
  const present = ROUTER_HEADERS.filter((name) => request.headers.has(name));
  console.warn('[router-header-refused]', present.join(',') || 'direct');
  return new Response(body, { status: 400, headers: REFUSAL_HEADERS });
}

export function GET(request: Request): Response {
  return refuse(request, 'Bad request\n');
}

export function HEAD(request: Request): Response {
  return refuse(request, null);
}
