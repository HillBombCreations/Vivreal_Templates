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
