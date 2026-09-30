import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECIPES_FORMAT,
  WHATS_ON_LAYOUT,
  detailJsonLdFormat,
  servesCollectionDetail,
} from './detailFormats.ts';

/**
 * Phase 1 exit criterion #1: a recipe URL resolves rather than 404s.
 *
 * `[slug]/[itemId]/page.tsx` is JSX and cannot be loaded by
 * `node --experimental-strip-types`, so the routing DECISION lives here and is
 * tested by being called. `page.test.ts` pins that the route reaches it.
 */

test('a recipes page is served by the collection detail arm', () => {
  // Without this the route falls through to notFound() and EVERY recipe URL is
  // a 404 — an unknown page format is fatal here, unlike an unknown detail
  // section, which the renderer skips silently.
  assert.equal(servesCollectionDetail({ format: RECIPES_FORMAT }), true);
});

test('the formats that were served before are still served', () => {
  assert.equal(servesCollectionDetail({ format: 'collection-list' }), true);
  assert.equal(
    servesCollectionDetail({ format: 'location-hub', detailPage: { itemCollectionId: 'c1' } }),
    true,
    'the scoped-detail opt-in is format-independent by design',
  );
});

test('a format with no arm is still not served', () => {
  // The arm must not become a catch-all: `schedule` and friends have no item
  // to resolve, and claiming them would turn a 404 into a broken page.
  assert.equal(servesCollectionDetail({ format: 'schedule' }), false);
  assert.equal(servesCollectionDetail({ format: 'subscribe' }), false);
  assert.equal(servesCollectionDetail({}), false);
});

test('a recipes page maps to the Recipe JSON-LD branch', () => {
  // The call site used to hardcode "products", which made a `case 'recipes'`
  // in buildDetailJsonLd unreachable — dead code that still reads as coverage.
  assert.equal(detailJsonLdFormat(RECIPES_FORMAT), RECIPES_FORMAT);
});

test('every other format keeps emitting what it emits today', () => {
  // Passing pageConfig.format through verbatim would flip every scoped-detail
  // page on a non-recipes format from Product/Thing to Article, fleet-wide.
  assert.equal(detailJsonLdFormat('collection-list'), 'products');
  assert.equal(detailJsonLdFormat('location-hub'), 'products');
  assert.equal(detailJsonLdFormat(undefined), 'products');
});

test('Phase 0.4: a catalog page is served by the collection detail arm (D3)', () => {
  // Renderer 1.72.0 links a catalog tile with no order link to /<slug>/<id>.
  // Without this the route falls through to notFound() and every such tile
  // opens a 404. This must reach main before the renderer bump does.
  assert.equal(servesCollectionDetail({ format: 'catalog' }), true);
});

test('a products page without a collection id is still not a collection page', () => {
  assert.equal(servesCollectionDetail({ format: 'products' }), false);
});

/* ── Live events, road B: a What's on page serves its show detail ───────────
 *
 * The owner's ruling: a What's on page keeps `WhatsOnLayout` and the "What's
 * on" page type rather than being converted to `format:'products'` and served
 * by the Chalkboard product page. An operator picking "What's on" for their
 * shows is honest, and calling a comedy show a product leaks that modelling
 * into the UI. So the detail arm has to claim the page, and it cannot do it by
 * format: the preset persists `format:'standard'`.
 */

/** The block a `layout:whats-on` palette add persists. */
const whatsOnBlock = { type: { kind: 'layout', dispatchId: WHATS_ON_LAYOUT } };

test("a What's on page is served by the collection detail arm", () => {
  // Without this every show URL is a 404 while `/og/[slug]/[itemId]` still
  // renders a correct social card for it, a shared link that looks right and
  // lands nowhere.
  assert.equal(
    servesCollectionDetail({ format: 'standard', blocks: [whatsOnBlock] }),
    true,
  );
});

test("the What's on clause reads the block, not the format", () => {
  // The preset persists `format:'standard'`, so a format-only rule cannot see
  // this page at all. Pinning both halves: the format alone is not enough,
  // and the block alone is.
  assert.equal(servesCollectionDetail({ format: 'standard' }), false);
  assert.equal(servesCollectionDetail({ blocks: [whatsOnBlock] }), true);
});

test('a standard page with any OTHER layout block is still not served', () => {
  // The safety argument for the whole clause. Around eighteen layouts emit a
  // detail link when `detailEnabled`, and claiming `standard` wholesale would
  // flip every one of those pages from 404 to a rendered detail page fleet-
  // wide on the next promote. Only the named layout may widen the arm.
  assert.equal(
    servesCollectionDetail({
      format: 'standard',
      blocks: [
        { type: { kind: 'layout', dispatchId: 'cards' } },
        { type: { kind: 'layout', dispatchId: 'gallery' } },
        { type: { kind: 'layout', dispatchId: 'calendar' } },
      ],
    }),
    false,
  );
});

test("a What's on block is found wherever it sits on the page", () => {
  // The preset seeds `[section-header, whats-on]`, so the listing is never
  // block 0. A first-block-only read would have shipped green against a
  // hand-written fixture and 404'd on every real page.
  assert.equal(
    servesCollectionDetail({
      format: 'standard',
      blocks: [{ type: { kind: 'content', dispatchId: 'section-header' } }, whatsOnBlock],
    }),
    true,
  );
});

test('a block with no type at all does not throw', () => {
  // A Mongo round-trip strips empty sub-objects, so a block can arrive with no
  // `type`, the same reason `pageDetailCollectionId` optional-chains its
  // binding read.
  assert.equal(
    servesCollectionDetail({ format: 'standard', blocks: [{}, { type: null }, whatsOnBlock] }),
    true,
  );
  assert.equal(servesCollectionDetail({ format: 'standard', blocks: [{}] }), false);
  assert.equal(servesCollectionDetail({ format: 'standard', blocks: [] }), false);
  assert.equal(servesCollectionDetail({ format: 'standard', blocks: null }), false);
});

test('the pages that were served before are served for the same reason as before', () => {
  // The new clause is additive: it can only turn `false` into `true`, and only
  // for a page carrying the named layout. Every pre-existing answer is pinned
  // above; this pins that a blockless page is unaffected by the widening.
  assert.equal(servesCollectionDetail({ format: 'collection-list', blocks: [] }), true);
  assert.equal(servesCollectionDetail({ format: 'products', blocks: [] }), false);
  assert.equal(servesCollectionDetail({ format: 'schedule', blocks: [] }), false);
});
