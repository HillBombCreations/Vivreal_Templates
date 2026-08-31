import { connection } from 'next/server';
import { optOutOfPrerenderUnlessIsr } from '@/lib/renderMode';

/**
 * The route-facing ISR gate, and the ONE place `connection` is bound to the
 * real Next export. Every route the flip touches calls this as its first
 * statement.
 *
 * The decision and the `connection()` call both live in `renderMode.ts`, which
 * imports nothing from Next so `node --test` can execute it against the REAL
 * `connection` inside Next's REAL prerender work store (`renderMode.test.ts`).
 * This file is wiring only; its single untested claim, that it passes the real
 * `connection`, is source-pinned in that suite.
 *
 * WHY THE CALL IS THE FIRST STATEMENT IN EVERY ROUTE
 * -------------------------------------------------
 * In the off state nothing after it runs during `next build`. That is what
 * keeps a fleet build's VR_Client_API traffic at zero for these routes,
 * matching the pre-change build where `force-dynamic` meant Next never
 * attempted them at all. Move it below a `getSiteData()` call and every fleet
 * build starts making upstream reads it did not make before.
 *
 * WHY IT IS NOT IN THE ROOT LAYOUT
 * --------------------------------
 * A dynamic bailout in a layout cascades to every child. That would drag
 * `/_not-found` (which Phase 1 left as the only genuinely static route in the
 * app) back to dynamic, so the off state would no longer reproduce the
 * pre-change build. The gate stays per route, on exactly the routes being
 * flipped.
 */
export function enforceDynamicUnlessIsr(): Promise<void> {
  return optOutOfPrerenderUnlessIsr(connection);
}
