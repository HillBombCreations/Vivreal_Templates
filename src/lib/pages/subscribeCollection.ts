import type { DetailPageLike } from '../detail/detailCollection.ts';

/**
 * The subscribers list a `subscribe` page with NO stored subscribe block binds
 * its synthesized form to, or `''` when it has none.
 *
 * Lives here, not inline in `[slug]/page.tsx`, so it can be tested by calling
 * it (that route is JSX and `server-only`, which the node test runner cannot
 * load). page.test.ts pins that the route still reaches it.
 *
 *   1. `page.collectionId`, unchanged.
 *   2. `page.collections[0].collectionId`, ONLY for a page with no blocks. Same
 *      gate as `pageDetailCollectionId` (detailCollection.ts) and the
 *      renderer's `defaultBlocksForFormat`: from VR_Client_API PR #121,
 *      GET /tenant/siteDetails serves `collections: []` for every page whose
 *      `blocks` is non-empty, so reading the mirror there would read a blank
 *      that only looks like "no list".
 *
 * `''` is the same no-list path as before: the form renders, and a submit is
 * refused by /api/subscribe (400, "Missing collectionId.") with no subscriber
 * written.
 */
export function legacySubscribeCollectionId(page: DetailPageLike | undefined): string {
  if (!page) return '';
  // `!= null`, not truthiness: the route used `??`, so a stored `''` stops here.
  if (page.collectionId != null) return page.collectionId;
  const hasBlocks = (page.blocks ?? []).length > 0;
  if (hasBlocks) return '';
  return page.collections?.[0]?.collectionId ?? '';
}
