/**
 * detailCollection.test.ts — the Recipes 404, proved against the page the
 * product actually mints.
 *
 * THE FIXTURE IS NOT HAND-WRITTEN, and that is the point of this file.
 * `__fixtures__/recipesPresetPage.json` is the literal output of
 * `Vivreal_Portal_Mobile`'s `buildPresetBlocks(recipes preset)` →
 * `buildNewPage` → `applyProvisionedBindings`, with the block ids normalised
 * and the Detail-pages toggle flipped on, which is exactly the sequence an
 * owner walks in Site Studio. The portal regenerates it from the live preset
 * and asserts byte equality against its own copy
 * (`tests/unit/lib/sites/recipesDetailCollectionParity.test.ts`), so if #346's preset
 * ever changes shape, that test goes red rather than this one rotting.
 *
 * A hand-written page fixture is how this shipped green: every page fixture in
 * the estate carried a `page-template` block, and the recipes preset is the
 * first shipped page type that has none.
 *
 * The only value in here that is invented is the collection id; the shape
 * around it is not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pageDetailCollectionId } from './detailCollection.ts';
import { servesCollectionDetail } from './detailFormats.ts';
import { resolveItem } from './resolveItem.ts';

const PRESET_PAGE = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./__fixtures__/recipesPresetPage.json', import.meta.url)),
    'utf8',
  ),
) as {
  format: string;
  slug: string;
  collectionId?: string;
  collections?: { collectionId?: string }[];
  blocks: { type: { kind: string }; config?: { bindings?: { collectionId?: string }[] } }[];
};

/** The collection the preset's auto-provisioning bound to the cards block. */
const RECIPES_COLLECTION = '6a9cb88fbe11d924f146f000';

/* ------------------------------------------------------------------ */
/* The fixture is the shape the defect needs                           */
/* ------------------------------------------------------------------ */

test('[guard] the preset page carries NO page-template block, and binds its collection to a layout block', () => {
  // Guard against a vacuous suite: every assertion below is about a page with
  // this shape, so a fixture that quietly gained a page-template block would
  // make them all pass for the wrong reason.
  assert.equal(PRESET_PAGE.format, 'recipes');
  assert.ok(PRESET_PAGE.blocks.length > 0, 'fixture has no blocks');
  assert.equal(
    PRESET_PAGE.blocks.some((b) => b.type.kind === 'page-template'),
    false,
    'the fixture gained a page-template block — the defect it pins is gone or moved',
  );
  assert.deepEqual(PRESET_PAGE.collections, []);
  assert.equal(PRESET_PAGE.collectionId, undefined);
});

/* ------------------------------------------------------------------ */
/* The defect                                                          */
/* ------------------------------------------------------------------ */

test('a Recipes page resolves the collection bound to its cards block', () => {
  // RED BEFORE THE FIX: clauses 1-3 (page-template block, legacy collectionId,
  // legacy collections[0]) all miss on this page, `getPageCollectionId`
  // returned '', `lookupDetailItem` returned null, and
  // `/recipes/<id>` 404'd on a page whose own index card links to it.
  assert.equal(pageDetailCollectionId(PRESET_PAGE), RECIPES_COLLECTION);
});

test('the whole address resolves: the route claims the page, and the page names an item', () => {
  // The URL the live walk got a 404 for, walked through the three decisions the
  // detail route makes in order.
  const itemId = '6a9cb88fbe11d924f146f53a';

  // 1. `[slug]/[itemId]/page.tsx` dispatches to the collection arm at all.
  assert.equal(servesCollectionDetail({ format: PRESET_PAGE.format }), true);
  // 2. `lookupDetailItem` finds a collection to fetch from — this was the gap.
  const collectionId = pageDetailCollectionId(PRESET_PAGE);
  assert.equal(collectionId, RECIPES_COLLECTION);
  // 3. `resolveItem` finds the item in that collection's pool. `_id` first,
  //    unconditionally, which is the key the portal's Copy link button builds
  //    its URL from.
  const pool = [
    { id: 'another-recipe', raw: { title: 'Focaccia' } },
    { id: itemId, raw: { title: 'Sourdough' } },
  ];
  assert.equal(resolveItem(pool, itemId)?.raw.title, 'Sourdough');
});

test('the per-item OG card and the detail route ask ONE function, so they cannot answer differently', () => {
  // Both `/[slug]/[itemId]/page.tsx` and `/og/[slug]/[itemId]/route.tsx` reach
  // this through `lookupDetailItem`. The symptom that named the cause was
  // `/og/recipes/<id>` being byte-identical to `/og/recipes` — the item could
  // not be resolved, so the card fell back to the page's.
  const source = readFileSync(
    fileURLToPath(new URL('./lookupItem.ts', import.meta.url)),
    'utf8',
  );
  assert.match(
    source,
    /detailPage\?\.itemCollectionId \|\| getPageCollectionId\(siteData, pageConfig\.name, ''\)/,
    'lookupItem.ts no longer resolves its collection through getPageCollectionId',
  );
});

test('getPageCollectionId delegates here rather than keeping its own copy', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../api/siteData/index.tsx', import.meta.url)),
    'utf8',
  );
  // `siteData/index.tsx` imports `server-only` and Sentry, so nothing in it can
  // be tested by being CALLED (the same reason `detailFormats.ts` and
  // `pageIndexing.ts` were extracted). Assert the delegation by source, and
  // assert the parse found the function first so this cannot pass vacuously.
  const body = source.match(
    /export const getPageCollectionId = \([\s\S]*?\n\};/,
  )?.[0];
  assert.ok(body, 'getPageCollectionId not found in src/lib/api/siteData/index.tsx');
  assert.doesNotMatch(
    body,
    /page-template/,
    'getPageCollectionId still carries its own inline block walk',
  );
  // The env fallback stays LAST, and stays. It is the only thing standing
  // between the Comedy Collective / EastTenn shows and team pages (SHOWS_ID /
  // TEAMMEMBERS_ID) and a detail route with no pool at all, and widening the
  // rule in front of it must not have quietly eaten it.
  assert.match(body, /return pageDetailCollectionId\(page\) \|\| envFallback;/);
  assert.match(body, /if \(!page\) return envFallback;/);
});

/* ------------------------------------------------------------------ */
/* The rule, clause by clause                                          */
/* ------------------------------------------------------------------ */

const pageTemplateBlock = (collectionId: string) => ({
  type: { kind: 'page-template' },
  config: { bindings: [{ collectionId }] },
});
const cardsBlock = (collectionId: string) => ({
  type: { kind: 'layout' },
  config: { bindings: [{ displayAs: 'cards', collectionId }] },
});

test('clause 1 — a page-template block still wins over everything else', () => {
  assert.equal(
    pageDetailCollectionId({
      blocks: [cardsBlock('from-cards'), pageTemplateBlock('from-template')],
      collectionId: 'legacy-pointer',
      collections: [{ collectionId: 'legacy-mirror' }],
    }),
    'from-template',
  );
});

test('clauses 2 and 3 — the legacy mirrors still win over a content block', () => {
  // This ordering is the safety argument, not an accident: clause 4 is
  // reachable ONLY where the shipped rule already answered `undefined`, so it
  // can never re-point a page that resolves today.
  assert.equal(
    pageDetailCollectionId({
      blocks: [cardsBlock('from-cards')],
      collectionId: 'legacy-pointer',
    }),
    'legacy-pointer',
  );
  assert.equal(
    pageDetailCollectionId({
      blocks: [cardsBlock('from-cards')],
      collections: [{ collectionId: 'legacy-mirror' }],
    }),
    'legacy-mirror',
  );
});

test('clause 4 reads bindings[0] only, so a products filter collection is never the item source', () => {
  // The live products shape: the integration binding is the item source and
  // the collection at index 1 is the FILTER list. `bindings.find(hasCollection)`
  // would serve detail pages out of the category list.
  assert.equal(
    pageDetailCollectionId({
      blocks: [
        {
          type: { kind: 'layout' },
          config: {
            bindings: [
              { integrationProvider: 'stripe' },
              { collectionId: 'categories' },
            ],
          },
        },
      ],
    }),
    undefined,
  );
});

test('clause 4 takes the FIRST bound content block when a page has several', () => {
  assert.equal(
    pageDetailCollectionId({
      blocks: [
        { type: { kind: 'static' }, config: { labels: {} } } as never,
        cardsBlock('first'),
        cardsBlock('second'),
      ],
    }),
    'first',
  );
});

test('an unbound page resolves to undefined, not to an empty string', () => {
  // `lookupDetailItem` distinguishes "addresses no collection" (a misconfigured
  // page) from "no such item", and the OG route falls back on the first and
  // 404s on the second. A `''` would blur them.
  assert.equal(pageDetailCollectionId({}), undefined);
  assert.equal(pageDetailCollectionId({ blocks: [] }), undefined);
  assert.equal(
    pageDetailCollectionId({
      blocks: [{ type: { kind: 'static' } }, { type: { kind: 'layout' }, config: {} }],
    }),
    undefined,
  );
});

test('a block with no config at all does not throw', () => {
  // A masthead hero block's empty config is dropped by a Mongo round-trip that
  // strips empty sub-objects. This resolver runs inside a Server Component;
  // a dereference here takes the whole page down.
  assert.equal(
    pageDetailCollectionId({
      blocks: [{}, { type: null }, { type: { kind: 'layout' }, config: null }, cardsBlock('ok')],
    }),
    'ok',
  );
});
