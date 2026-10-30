import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PageConfig } from '@/types/SiteData';
import {
  authoredStaticSlugs,
  capSlugParams,
  MIN_PAGE_COST_BYTES,
  PAGE_COST_FACTOR,
  planPrerenderLimits,
  PRERENDER_PAGE_BUDGET_BYTES,
  siteDataBytes,
} from './prerenderBudget.ts';
import { CHECKOUT_RESULT_SLUGS } from './builtInPages.ts';

/**
 * Promote run 41089220307 (2026-10-30): six sites failed Amplify's output cap
 * because every inner page and up to 300 item pages were prerendered. The
 * record sizes below are the four sites measured locally that day, each built
 * in production mode from its own live data.
 */
const MEASURED = {
  help: { siteData: 314_144, authoredSlugs: 10, measuredPageBytes: 2_264_547 },
  vivreal: { siteData: 212_870, authoredSlugs: 14, measuredPageBytes: 1_592_922 },
  meridian: { siteData: 165_567, authoredSlugs: 17, measuredPageBytes: 1_400_265 },
  // Largest INNER page: the home page is prerendered outside the budget.
  comedyCollective: { siteData: 14_626, authoredSlugs: 6, measuredPageBytes: 365_375 },
} as const;

const page = (slug: string, format = 'standard') => ({ slug, format }) as PageConfig;
const neverReserved = () => false;

test('REFUSE: a large site record cannot list more pages than its budget (help.vivreal.io, 625 MB on 10-30)', () => {
  const limits = planPrerenderLimits(MEASURED.help.siteData, MEASURED.help.authoredSlugs);
  assert.equal(limits.allowance, 8);
  assert.equal(limits.slugs, 8);
  assert.equal(limits.items, 0, 'an item page must not be listed once inner pages spend the budget');
});

test("REFUSE: at each site's largest measured page, what the budget lists stays under the budget plus one page", () => {
  // The estimate is per site, the real pages vary around it; the build guard
  // (scripts/build-size-guard.mjs, 30 MiB) is what catches a bigger miss.
  for (const [site, m] of Object.entries(MEASURED)) {
    const limits = planPrerenderLimits(m.siteData, m.authoredSlugs);
    const worst = limits.allowance * Math.max(m.measuredPageBytes, MIN_PAGE_COST_BYTES);
    assert.ok(worst <= PRERENDER_PAGE_BUDGET_BYTES + m.measuredPageBytes, `${site}: ${worst} bytes listed`);
  }
});

test('REFUSE: a record that cannot be measured lists no budgeted page at all', () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(siteDataBytes(circular), Number.POSITIVE_INFINITY);
  assert.equal(siteDataBytes(undefined), Number.POSITIVE_INFINITY);
  assert.deepEqual(planPrerenderLimits(Number.POSITIVE_INFINITY, 5), {
    pageBytes: Number.POSITIVE_INFINITY,
    allowance: 0,
    slugs: 0,
    items: 0,
  });
});

test('ALLOW: a normal site keeps every page cached (Comedy Collective lists all of its 6 pages and 14 items)', () => {
  const limits = planPrerenderLimits(MEASURED.comedyCollective.siteData, MEASURED.comedyCollective.authoredSlugs);
  assert.equal(limits.pageBytes, MIN_PAGE_COST_BYTES);
  assert.equal(limits.slugs, 6);
  assert.ok(limits.items >= 14, `items ${limits.items}`);
  assert.equal(limits.allowance, Math.floor(PRERENDER_PAGE_BUDGET_BYTES / MIN_PAGE_COST_BYTES));
});

test('ALLOW: siteDataBytes counts UTF-8 bytes of the serialized record', () => {
  assert.equal(siteDataBytes({ name: 'é' }), Buffer.byteLength(JSON.stringify({ name: 'é' })));
  assert.equal(planPrerenderLimits(100_000, 0).pageBytes, PAGE_COST_FACTOR * 100_000);
});

test('REFUSE: capSlugParams cuts authored pages at the limit, in order', () => {
  assert.deepEqual(capSlugParams(['a', 'b', 'c', 'checkoutsuccess', 'checkoutcancel'], CHECKOUT_RESULT_SLUGS, 2), [
    'a',
    'b',
    'checkoutsuccess',
    'checkoutcancel',
  ]);
});

test('ALLOW: the checkout slugs survive a zero budget, so the list is never empty and the route keeps no build fallback', () => {
  assert.deepEqual(capSlugParams(['a', 'checkoutsuccess', 'checkoutcancel'], CHECKOUT_RESULT_SLUGS, 0), [
    'checkoutsuccess',
    'checkoutcancel',
  ]);
  assert.ok(CHECKOUT_RESULT_SLUGS.length > 0);
});

test('authoredStaticSlugs: the [slug] list without checkout or reserved slugs, so both routes count the same pages', () => {
  const pages = [page('about'), page('book'), page('checkoutsuccess', 'checkout-success'), page('features/x'), page('menu')];
  assert.deepEqual(authoredStaticSlugs(pages, (s) => s === 'book'), ['about', 'menu']);
  assert.deepEqual(authoredStaticSlugs(undefined, neverReserved), []);
});
