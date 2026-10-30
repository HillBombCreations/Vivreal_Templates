import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { queryReadAllowed } from "./queryReadDecision";

/**
 * May this render read the address query? (owner ideas PR 11, review B2; owner
 * decision 2026-10-29: never error.)
 *
 * THE FAILURE IT CLOSES. `pageReadsQuery` is decided from LIVE page config. A
 * page prerendered as ISR at build (no storefront then) that the owner later
 * gives a storefront, a search box or a schedule is regenerated at runtime
 * INSIDE a static regeneration; reading `searchParams` there throws
 * `DYNAMIC_SERVER_USAGE` and the live page answered 500 until the next fleet
 * build. Reproduced on a production build after a signed `site.updated`.
 *
 * THE RULE. Read the query only where reading it is safe:
 *  - a DYNAMIC request render (`workUnitStore.type === 'request'`): a page
 *    that bailed at build, a page added after the build, gate off, dev;
 *  - the BUILD's own prerender (`isBuildTimePrerendering`), where reading it is
 *    what makes a storefront page bail to dynamic in the first place.
 * Anywhere else (a runtime ISR regeneration of a prerendered path) the page is
 * rendered with the empty query: the storefront, search or schedule shows its
 * unfiltered default until the next build lists the page as dynamic, and the
 * toolbar's links still navigate. Never a 500.
 *
 * Both stores are Next internals (pinned `~16.4.1`; `queryReadGate.test.ts`
 * fails when a bump moves them). If neither answers, the answer is false: an
 * unfiltered page, never a 500. The build check proves the build half still
 * bails (`/shop` stays `no-store`).
 */
export function mayReadQuery(): boolean {
  try {
    return queryReadAllowed(workUnitAsyncStorage.getStore(), workAsyncStorage.getStore());
  } catch {
    return false;
  }
}
