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
  assert.match(source, /if \(isPageTurnedOff\(pageConfig\)\) \{\s*\/\/ "Off" at the last build[^\n]*\s*refuseNegativeClaimFromFloor\(siteData\);\s*return notFound\(\);/);
  assert.match(
    source,
    /import \{ isPageTurnedOff \} from "@\/lib\/pages\/pageEnabled"/,
    'off the same predicate buildSitemapEntries reads, so the route and sitemap.xml cannot drift',
  );
});

// ── privacy and terms are served only from a stored page ────────────────────
//
// Owner decision 2026-10-14 (consistent with FP2-08, no invented legal text):
// a site that stores no privacy or terms page answers 404 for them. They used
// to be exempt from the no-page 404 and rendered a synthesized, block-less page
// that was EMPTY with a 200. Which page a slug resolves to is decided by
// `resolvePageForSlug`, tested by calling it in
// src/lib/pages/builtInPages.test.ts (REFUSE: no stored page resolves nothing;
// ALLOW: a stored privacy page resolves as stored). These pin that the route
// adds no exemption on top of that answer.

test('REFUSE: with no stored page the route 404s every slug, privacy and terms included', () => {
  assert.match(
    source,
    /if \(!pageConfig\) \{[\s\S]{0,1600}?resolveMissingItemRedirect\(siteData\.redirects, `\/\$\{slug\}`\);[\s\S]{0,400}?refuseNegativeClaimFromFloor\(siteData\);\s*return notFound\(\);/,
    'a missing page goes to the redirect check and then notFound(), with no exemption in the condition',
  );
  for (const retired of ['STATIC_SLUGS', 'STATIC_PAGE_TITLES', '"Privacy Policy"', '"Terms of Service"']) {
    assert.ok(!source.includes(retired), `${retired} must not come back: it served an empty 200 on sites with no policy`);
  }
});

test('REFUSE: metadata titles a missing privacy or terms page Not Found, like any other missing page', () => {
  assert.match(source, /if \(!pageConfig\) \{\s*return \{ title: `Not Found \| \$\{siteName\}` \};/);
});

test('the off and seed-only guards still run before the missing-page 404', () => {
  // A stored policy page the owner switched off, or one that is still all
  // kit seed, 404s through its own guard; the order keeps that explicit.
  const off = source.indexOf('// "Off" at the last build is not "off" now: on floor data, refuse.');
  const seed = source.indexOf('if (pageConfig && isSeedOnlySlug(await getSeedOnlyPaths(), pageConfig.slug)) return notFound();');
  const missing = source.indexOf('if (!pageConfig) {');
  assert.ok(off > 0 && seed > 0 && missing > 0);
  assert.ok(off < seed && seed < missing);
});

test('the prerender list is always-on only for the built-in checkout slugs, never privacy or terms', () => {
  // Non-empty on every site is load-bearing (see staticParams.test.ts); the
  // checkout result slugs are what keep it so now.
  assert.match(source, /slugsForStaticParams\(siteData\.pageConfigs, CHECKOUT_RESULT_SLUGS\)/);
});

test('the off guard runs AFTER the degraded-read guard, so an upstream wobble cannot 404 a live page', () => {
  // On a degraded read `pageConfigs` is empty and every lookup misses. Missing
  // is not off (`isPageTurnedOff(undefined) === false`), but the ordering is
  // what makes that reasoning safe to rely on, so it is pinned rather than
  // assumed.
  const healthy = source.indexOf('assertUpstreamHealthy(siteData);');
  const guard = source.indexOf('// "Off" at the last build is not "off" now: on floor data, refuse.');
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
    /import \{ CHECKOUT_RESULT_SLUGS, resolvePageForSlug \} from "@\/lib\/pages\/builtInPages"/,
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
  const guard = source.indexOf('// "Off" at the last build is not "off" now: on floor data, refuse.');
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

test('the subscribe fallback resolves its list through the tested helper', () => {
  // The helper reads collections[0] only for a block-less page (review note N5,
  // VR_Client_API #121 blanks that mirror on pages with blocks). An inline
  // collections[0] read here would bypass that gate where no test can reach it.
  assert.match(source, /legacySubscribeCollectionId\(pageConfig\)/, 'the route must reach the tested helper');
  assert.doesNotMatch(source, /collections\?\.\[0\]/, 'no inline read of the legacy mirror');
});

// ── review B1: no reserved name in the build list ─────────────────────────
test('the build list never claims a fixed route\'s path', () => {
  assert.match(
    source,
    /const listed = slugsForStaticParams\(siteData\.pageConfigs, CHECKOUT_RESULT_SLUGS\)\s*\.filter\(\(slug\) => !isReservedPageSlug\(slug\)\)/,
    'an owner page called book would be prerendered by this route and 500 at /book',
  );
});

// ── fix-forward 2026-10-30: the per-site prerender budget ────────────────
test('the build list is cut to the site prerender budget, keeping the checkout slugs', () => {
  // Without the cut, help.vivreal.io listed every inner page and its build hit
  // Amplify's output cap (promote run 41089220307). The checkout slugs must
  // survive it: they keep the list non-empty and the route free of a fallback.
  assert.match(
    source,
    /planPrerenderLimits\(dataBytes, authoredStaticSlugs\(siteData\.pageConfigs, isReservedPageSlug\)\.length\)/,
  );
  assert.match(source, /const slugs = capSlugParams\(listed, CHECKOUT_RESULT_SLUGS, limits\.slugs\);/);
  assert.match(source, /return slugs\.map\(\(slug\) => \(\{ slug \}\)\);/);
});

// ── owner ideas T7: the link page ─────────────────────────────────────────
test('the link page is a recognised format AND takes the plain delegation', () => {
  // Without the Set entry a links page 404s (the /shop lesson). Without the
  // delegation line it would fall into the format-specific arm meant for
  // shows, team and the rest. The runtime half (a links page answering 200,
  // and ISR) is the build check, scripts/isr-build-check.mjs.
  assert.match(source, /^\s*"links",$/m, 'the link page must be routable');
  assert.match(source, /format === "links"\s*\)\s*\{/, 'and delegated like standard');
});

test('a link tap reaches the beacon through the renderer context', () => {
  const providers = fs.readFileSync(new URL('../../components/Providers/index.tsx', import.meta.url), 'utf8');
  assert.match(providers, /onLinkTap=\{recordLinkTap\}/);
  assert.match(providers, /import \{ recordGoal, recordLinkTap \} from '@\/lib\/siteEvents'/);
});

test('a contact form result reaches the beacon through the renderer context (next release 2026-11, N2)', () => {
  const providers = fs.readFileSync(new URL('../../components/Providers/index.tsx', import.meta.url), 'utf8');
  assert.match(providers, /onGoal=\{recordGoal\}/);
});
