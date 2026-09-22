import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// page.tsx contains JSX, so `node --experimental-strip-types` cannot load it at
// all (.tsx is unsupported by that loader regardless of content). Every gate in
// this change was moved into a plain .ts module precisely so it could be tested
// by CALLING it — `servesCollectionDetail`/`detailJsonLdFormat` in
// src/lib/detail/detailFormats.test.ts, the card decisions in
// src/lib/og/ogCard.test.ts, the Recipe payload in
// src/components/JsonLd/schema.test.ts, and `buildDetailUrl` in
// src/lib/og/siteOrigin.test.ts. This file pins only that the route reaches
// them, matching on names rather than formatting so a reformat cannot turn it
// red.

const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('all five detail JSON-LD call sites resolve their URL through the shared helper', () => {
  // Still five: recipes are served BY the collection arm and share its single
  // call site, so the recipes work added a schema shape without adding a site.
  const calls = source.match(/buildDetailUrl\(siteData, slug, itemId\)/g) ?? [];
  assert.equal(calls.length, 5, 'each JSON-LD call site resolves its detail URL once');
});

test('no detail URL is still hand-built from a raw domainName', () => {
  // The pre-change form. Hand-built URLs skipped the demo gate, the HTTPS-origin
  // allowlist and the amplifyapp refusal, and emitted nothing at all for the
  // subdomain-only sites that are the fleet majority.
  assert.doesNotMatch(source, /https:\/\/\$\{siteData\.domainName\}/);
});

test('the collection detail arm asks the tested predicate which formats it serves', () => {
  assert.match(source, /if \(servesCollectionDetail\(pageConfig\)\)/);
  assert.match(
    source,
    /import \{[\s\S]*servesCollectionDetail,?[\s\S]*\} from "@\/lib\/detail\/detailFormats"/,
  );
});

test('the arm no longer decides its own format list inline', () => {
  // The pre-change form. Inline, `recipes` was absent, so every recipe URL fell
  // through to notFound() at the bottom of the function — an unknown page
  // FORMAT is fatal on this route.
  assert.doesNotMatch(source, /pageConfig\.format === "collection-list" \|\|/);
});

test('the JSON-LD call site passes a real format instead of hardcoding products', () => {
  // With `format: "products"` hardcoded here, a `case 'recipes'` in
  // buildDetailJsonLd is unreachable: the Recipe branch would be dead code that
  // still reads as coverage.
  assert.match(source, /format: detailJsonLdFormat\(pageConfig\.format\)/);
  assert.doesNotMatch(
    source,
    /format: "products",\s*\n\s*title: effectiveItem\.title/,
    'the collection arm must not hardcode the products discriminant',
  );
});

test('a recipe card is built from the item, not from the page', () => {
  // C11: `buildOgImageUrl(origin, slug)` takes the PAGE slug, so every item
  // under a page inherited one card. Two recipes must produce two cards.
  assert.match(source, /buildOgItemImageUrl\(origin, slug, itemId\)/);
});

test("a recipe's structured image is the stable card URL on a durable origin", () => {
  // The unsigned media URL this route hands every other schema shape is
  // documented to 403 on this CloudFront distribution. Google requires a
  // fetchable image for a Recipe, so recipes get the card route instead.
  assert.match(source, /resolveSiteOrigin\(siteData, \{ surface: "durable" \}\)/);
  assert.match(source, /buildOgItemImageUrl\(durableOrigin, slug, itemId\)/);
  assert.match(source, /durableImageUrl: recipeCardUrl/);
});

test('the page and the card resolve the item through one function', () => {
  // If they drift, a correct recipe page ships under another recipe's social
  // card — silently. `/og/[slug]/[itemId]/route.tsx` calls the same helper.
  const calls = source.match(/lookupDetailItem\(siteData, pageConfig, itemId\)/g) ?? [];
  assert.equal(calls.length, 2, 'the render and the metadata both use the shared lookup');
});

test('Phase 0.1: a products page misses to the collection arm when one serves it', () => {
  assert.match(source, /if \(!product && providerMissIsFinal\(pageConfig\)\)/);
  assert.doesNotMatch(source, /if \(!product && pageConfig\.format === "products"\)/);
});

test('Phase 0.1: the provider read asks the shared source order', () => {
  assert.match(source, /storefrontItemSources\(pageConfig, paymentsProvider\)\.includes\("provider"\)/);
});

test('Phase 0.1: a collection-sourced products item renders through the product renderer', () => {
  assert.match(source, /contentItemToProduct\(effectiveItem, \{ specFields: storefrontConfig\?\.specFields \}\)/);
  const renderers = source.match(/<ProductDetailRenderer/g) ?? [];
  assert.equal(renderers.length, 2, 'the provider arm and the collection arm');
});

test('Phase 0.3: a product page describes its own product, with its own card', () => {
  assert.match(source, /if \(pageConfig\.format === "products"\) \{\s*const summary = await resolveStorefrontItemSummary\(siteData, pageConfig, itemId\);/);
  assert.match(source, /productItemMetaText\(\{/);
  assert.match(source, /const productCardUrl = buildOgItemImageUrl\(origin, slug, itemId\);/);
});

test('the collection products render hands a look page the item fields and the pool the route already read', () => {
  // plan-2a Task 12. A look's product page reads servings, lead time and tags
  // from the item's own fields, and a venue space reads its seasons from the
  // rest of the collection (data-contract.md 5.11). Both come from data this
  // arm already holds; neither costs a read.
  assert.match(source, /productSource=\{effectiveItem\.raw as Record<string, unknown> \| undefined\}/);
  assert.match(source, /collectionItems=\{unscopedItems\}/);
  assert.equal((source.match(/collectionItems=\{/g) ?? []).length, 1, 'only the collection arm has a pool to pass');
});

// ── the two arms of this route that an off page reaches ─────────────────────
//
// This file serves BOTH depth-2 nested pages (one config whose slug carries a
// slash) and the detail items of a page one level up, so the owner's page
// on/off switch has to be honoured twice here. Neither arm appears in
// `[slug]/page.tsx`, which is the file a reader would expect to hold the whole
// rule. The predicate's own behaviour is tested by calling it in
// src/lib/pages/pageEnabled.test.ts.

test('a nested page the owner turned off is not served', () => {
  assert.match(source, /if \(isPageTurnedOff\(nestedPage\)\) return notFound\(\);/);
  assert.match(source, /import \{ isPageTurnedOff \} from "@\/lib\/pages\/pageEnabled"/);
});

test('the nested off guard runs before the format allowlist, so no format can serve an off page', () => {
  const guard = source.indexOf('if (isPageTurnedOff(nestedPage)) return notFound();');
  const formats = source.indexOf('NON_NESTABLE_FORMATS.has(nestedPage.format)');
  assert.ok(guard > 0 && formats > 0);
  assert.ok(guard < formats, 'the off guard must come first');
});

test('an item under a page the owner turned off is not served either', () => {
  // Otherwise the page 404s while every item under it keeps serving, which
  // publishes the collection one URL at a time.
  assert.match(source, /if \(isPageTurnedOff\(pageConfig\)\) return notFound\(\);/);
});

test('the page switch did not replace the detail-page switch: both guards stand', () => {
  // `detailPage.enabled` answers "this page has no per-item pages";
  // `page.enabled` answers "this page is not live at all". Two switches, two
  // subjects, and a change that folded one into the other would silently turn
  // per-item pages back on for every page that had them off.
  assert.match(source, /if \(pageConfig\.detailPage\?\.enabled === false\) return notFound\(\);/);
});
