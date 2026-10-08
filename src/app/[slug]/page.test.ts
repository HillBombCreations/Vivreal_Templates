import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * page.tsx contains JSX, so `node --experimental-strip-types` cannot load it at
 * all (.tsx is unsupported by that loader regardless of content), and
 * `generateMetadata` reads `getSiteData()`, which is `server-only`. Every gate
 * in this area was moved into a plain .ts module precisely so it could be
 * tested by CALLING it, and `buildPageRobotsMetadata`'s behaviour IS tested for
 * real in src/lib/seo/pageIndexing.test.ts. This file pins only that the route
 * still reaches it — the same tradeoff, for the same reason, as
 * src/app/[slug]/[itemId]/page.test.ts.
 *
 * Matched on the function NAME, never on formatting or argument layout, so a
 * behaviour-preserving reformat cannot turn this red.
 */

const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('generateMetadata composes its robots policy through the shared builder', () => {
  assert.match(source, /buildPageRobotsMetadata\(/, 'the route must reach the tested composer');
  assert.match(
    source,
    /import \{ buildPageRobotsMetadata(, \w+)* \} from "@\/lib\/seo\/pageIndexing"/,
    'imported from the module that owns the non-indexable page-type list',
  );
});

test('recipes is a recognised page format', () => {
  // COMPOSE_FORMATS is keyed on page.format and gates route RECOGNITION. A
  // format missing from it does not degrade to a plain page: the file's own
  // measured note records HTTP 200 with a soft-404 body, which no status check
  // can see. So a recipe library page would read as missing while its detail
  // route happily served every recipe under it.
  assert.match(source, /^\s*"recipes",$/m, 'the recipes library page must be routable');
});

test('the search results page must be routable AND must receive the query', () => {
  // Two halves of one change. Route recognition alone serves the page's
  // collection UNFILTERED at every URL — a search that always returns
  // everything, which reads as working and is worse than the soft-404 the
  // comment above describes. Neither half is worth having without the other,
  // so both are pinned in one test.
  assert.match(source, /^\s*"lookup",$/m, 'the search results page is not a recognized route');
  assert.match(
    source,
    /lookupQuery: readLookupQuery\(sp, composedPage\)/,
    'the results page is routable but never sees ?q=',
  );
});

test('the robots policy is no longer decided inline in the route module', () => {
  // The pre-change form. Inline, it could only ever see the author-set flag, so
  // the Stripe checkout result pages emitted no `noindex` at all — and being
  // inside a .tsx meant no test could reach it either.
  assert.doesNotMatch(source, /seo\?\.noindex \? \{ robots:/);
});

// ── a page the owner turned off must not serve ──────────────────────────────
//
// The behaviour of the predicate itself is tested for real, by calling it, in
// src/lib/pages/pageEnabled.test.ts, and the sitemap half of the same rule in
// src/lib/seo/sitemap.test.ts. These pin the two things only the route file
// can carry: that it reaches that predicate, and WHERE.

test('the route refuses to serve a page the owner turned off', () => {
  assert.match(source, /if \(isPageTurnedOff\(pageConfig\)\) return notFound\(\);/);
  assert.match(
    source,
    /import \{ isPageTurnedOff \} from "@\/lib\/pages\/pageEnabled"/,
    'off the same predicate buildSitemapEntries reads, so the route and sitemap.xml cannot drift',
  );
});

test('the off guard runs BEFORE the privacy/terms fallback', () => {
  // Order is the whole behaviour here. Those two slugs render on every site
  // even with no page config at all, so an off privacy page reaching that
  // fallback would serve the built-in near-empty copy instead of 404ing: the
  // owner switched their page off and got a different page at the same URL.
  const guard = source.indexOf('if (isPageTurnedOff(pageConfig)) return notFound();');
  const fallback = source.indexOf('const STATIC_SLUGS: Record<string, string> = {');
  assert.ok(guard > 0, 'the off guard is present in the render');
  assert.ok(fallback > 0, 'the privacy/terms fallback is present');
  assert.ok(guard < fallback, 'the off guard must come first');
});

test('the off guard runs AFTER the degraded-read guard, so an upstream wobble cannot 404 a live page', () => {
  // On a degraded read `pageConfigs` is empty and every lookup misses. Missing
  // is not off (`isPageTurnedOff(undefined) === false`), but the ordering is
  // what makes that reasoning safe to rely on, so it is pinned rather than
  // assumed.
  const healthy = source.indexOf('assertUpstreamHealthy(siteData);');
  const guard = source.indexOf('if (isPageTurnedOff(pageConfig)) return notFound();');
  assert.ok(healthy > 0 && guard > 0);
  assert.ok(healthy < guard, 'the health assertion must come first');
});

test('the 404 for an off page is titled as one, not as the retired page', () => {
  // Metadata resolves independently of the render that calls notFound(), so
  // without its own guard the 404 keeps the page title, description and
  // canonical of the page the owner just took down.
  assert.match(
    source,
    /if \(isPageTurnedOff\(pageConfig\)\) \{[\s\S]{0,80}?Not Found \| \$\{siteName\}/,
    'generateMetadata answers Not Found for an off page',
  );
});

// ── the checkout result pages are built in on every site ────────────────────
//
// The resolver's behaviour (stored page wins, built-in only for the two exact
// checkout slugs, everything else undefined) is tested for real in
// src/lib/pages/builtInPages.test.ts. These pin that BOTH lookups in this file
// go through it: the render (so the page serves and the confirmation fires)
// and generateMetadata (so a served page is not titled "Not Found").

test('both the render and the metadata resolve pages through the built-in-aware resolver', () => {
  const lookups = source.match(/resolvePageForSlug\(siteData\.pageConfigs, slug\)/g) ?? [];
  assert.equal(lookups.length, 2, 'DynamicPage and generateMetadata');
  assert.match(
    source,
    /import \{ resolvePageForSlug \} from "@\/lib\/pages\/builtInPages"/,
  );
  assert.doesNotMatch(
    source,
    /getPageBySlug\(/,
    'a bare stored-only lookup would 404 /checkoutsuccess on a site that became a store later',
  );
});

test('the built-in pages are resolved BEFORE the off guard reads the result', () => {
  // A stored page is returned as stored, so an owner's off switch still 404s
  // it; the guard has to see the resolver's answer to keep that true.
  const resolve = source.indexOf('const pageConfig = resolvePageForSlug(siteData.pageConfigs, slug);');
  const guard = source.indexOf('if (isPageTurnedOff(pageConfig)) return notFound();');
  assert.ok(resolve > 0 && guard > 0);
  assert.ok(resolve < guard);
});

// ── QA-G1-2: metadata says what the body says for an empty composed page ────
//
// The verdict is the render's own (`decidePageEmptiness`, tested for real in
// pageEmptiness.test.ts) and the metadata shape is tested in
// pageIndexing.test.ts. This pins only that generateMetadata reaches both.
test('generateMetadata answers Not Found, noindex, for a composed page that renders as not found', () => {
  assert.match(
    source,
    /await composedPageIsEmpty\(\{[\s\S]{0,200}?\}\)\)[\s\S]{0,40}?return buildEmptyPageMetadata\(siteName\)/,
    'the empty verdict must decide the metadata',
  );
  assert.match(source, /import \{ renderComposedPage, composedPageIsEmpty \} from "@\/lib\/renderComposedPage"/);
});

// Review of #188, concern 1: reading `searchParams` bails the route to dynamic,
// so generateMetadata may read it ONLY after the config-only check says the page
// could be empty. A stored static page (privacy, terms) must never reach it, or
// an ISR site stops prerendering it. The predicate is tested for real in
// pageEmptiness.test.ts; this pins the ordering in the route.
test('generateMetadata reads searchParams only behind the config-only emptiness check', () => {
  const meta = source.slice(source.indexOf('export async function generateMetadata'));
  const gate = meta.indexOf('pageMustDecideEmptiness(pageConfig) &&');
  const read = meta.indexOf('await searchParams');
  assert.ok(gate > 0, 'the config-only check is in generateMetadata');
  assert.ok(read > gate, 'searchParams is awaited after (inside) the check');
  assert.equal(meta.match(/await searchParams/g)?.length, 1, 'and nowhere else in metadata');
  assert.match(source, /import \{ pageMustDecideEmptiness \} from "@\/lib\/api\/composition\/pageEmptiness"/);
});
