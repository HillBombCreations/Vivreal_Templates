import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import { buildSitemapEntries } from './sitemap.ts';

// buildSitemapEntries builds the live sitemap from the AUTHORITATIVE page list
// (raw.pages) — the fix for getSiteMap having read the never-populated
// siteDetails.values.pages (so the sitemap was homepage-only).

const pages = [
  { slug: 'home', format: 'home' },
  { slug: 'about', format: 'about' },
  { slug: 'menu', format: 'list' },
  { slug: 'subscribers', format: 'subscribers' }, // synthetic carrier — must be excluded
];

test('builds an entry per navigable page, home as the root', () => {
  const entries = buildSitemapEntries(pages, 'https://acme.test');
  const urls = entries.map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test', 'https://acme.test/about', 'https://acme.test/menu']);
});

test('excludes the home duplicate and the synthetic subscribers carrier', () => {
  const urls = buildSitemapEntries(pages, 'https://acme.test').map((e) => e.url);
  assert.ok(!urls.includes('https://acme.test/home'), 'no /home duplicate');
  assert.ok(!urls.includes('https://acme.test/subscribers'), 'the subscribers carrier is not indexed');
});

test('home is priority 1.0 and content pages descend', () => {
  const entries = buildSitemapEntries(pages, 'https://acme.test');
  assert.strictEqual(entries[0].priority, 1.0);
  assert.ok((entries[1].priority ?? 0) < 1.0 && (entries[1].priority ?? 0) >= 0.1);
});

test('empty siteOrigin ⇒ no sitemap', () => {
  assert.deepStrictEqual(buildSitemapEntries(pages, ''), []);
});

test('a trailing slash on siteOrigin is stripped before building entries', () => {
  const urls = buildSitemapEntries(pages, 'https://acme.test/').map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test', 'https://acme.test/about', 'https://acme.test/menu']);
});

test('de-duplicates + strips leading slashes on slugs', () => {
  const dupes = [{ slug: 'about', format: 'about' }, { slug: '/about', format: 'about' }];
  const urls = buildSitemapEntries(dupes, 'https://acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test', 'https://acme.test/about'], 'one /about entry');
});

test('undefined pages ⇒ just the root', () => {
  const urls = buildSitemapEntries(undefined, 'https://acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test']);
});

// ── the checkout result pages must never be advertised to a crawler ──────────
//
// The live defect, captured from production on 2026-08-24:
//
//   $ curl https://dougs-kitchen.com/sitemap.xml
//   <loc>https://dougs-kitchen.com</loc>            priority 1
//   <loc>https://dougs-kitchen.com/products</loc>   priority 0.87
//   <loc>https://dougs-kitchen.com/privacy</loc>    priority 0.74
//   <loc>https://dougs-kitchen.com/terms</loc>      priority 0.61
//   <loc>https://dougs-kitchen.com/checkoutsuccess</loc>  priority 0.49
//   <loc>https://dougs-kitchen.com/checkoutcancel</loc>   priority 0.36
//   <loc>https://dougs-kitchen.com/about</loc>      priority 0.23
//   <loc>https://dougs-kitchen.com/our-craft</loc>  priority 0.1
//
// The fixture below is that page list, with the real slugs. Note the slugs have
// no separator (`checkoutsuccess`) while the formats do (`checkout-success`) —
// that mismatch is why the exclusion is keyed on the format.

const dougsKitchenPages = [
  { slug: 'home', format: 'home' },
  { slug: 'products', format: 'products' },
  { slug: 'privacy', format: 'static' },
  { slug: 'terms', format: 'static' },
  { slug: 'checkoutsuccess', format: 'checkout-success' },
  { slug: 'checkoutcancel', format: 'checkout-cancel' },
  { slug: 'about', format: 'about' },
  { slug: 'our-craft', format: 'craft' },
];

test('DEFECT: the Stripe checkout result pages are excluded from the sitemap', () => {
  const urls = buildSitemapEntries(dougsKitchenPages, 'https://dougs-kitchen.com').map((e) => e.url);
  assert.ok(!urls.includes('https://dougs-kitchen.com/checkoutsuccess'), 'checkout success must not be advertised');
  assert.ok(!urls.includes('https://dougs-kitchen.com/checkoutcancel'), 'checkout cancel must not be advertised');
});

test('DEFECT: every OTHER page on the same live site is still advertised, in the same order', () => {
  // The removal is surgical. A change that dropped the checkout pages by
  // dropping something else with them would pass the test above.
  const urls = buildSitemapEntries(dougsKitchenPages, 'https://dougs-kitchen.com').map((e) => e.url);
  assert.deepStrictEqual(urls, [
    'https://dougs-kitchen.com',
    'https://dougs-kitchen.com/products',
    'https://dougs-kitchen.com/privacy',
    'https://dougs-kitchen.com/terms',
    'https://dougs-kitchen.com/about',
    'https://dougs-kitchen.com/our-craft',
  ]);
});

test('removing two entries renumbers priority for the ones after them — the arithmetic consequence, stated', () => {
  // Priority is derived from POSITION, so a removal shifts every later entry
  // up. Pinned rather than left implicit: it is the one way the sitemap's
  // contents change beyond the two removals, and a reviewer must be able to see
  // that it was intended. Priority is a non-binding hint Google ignores.
  // 5 remaining slugs ⇒ a 0.9/5 = 0.18 step, so the spread still runs the full
  // 1.0 → 0.1 range rather than stopping short. Live today it was an 0.87 →
  // 0.1 spread over 7 slugs.
  const entries = buildSitemapEntries(dougsKitchenPages, 'https://dougs-kitchen.com');
  assert.deepStrictEqual(
    entries.map((e) => e.priority),
    [1.0, 0.82, 0.64, 0.46, 0.28, 0.1],
  );
});

test('the exclusion keys on FORMAT, not the slug: a content page whose slug contains "checkout" is kept', () => {
  // The inverse of the fixture above. `/checkout-guide` is an ordinary content
  // page a shop might genuinely publish, and a slug pattern would eat it.
  const pages = [
    { slug: 'home', format: 'home' },
    { slug: 'checkout-guide', format: 'about' },
    { slug: 'how-checkout-works', format: 'standard' },
  ];
  const urls = buildSitemapEntries(pages, 'https://acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, [
    'https://acme.test',
    'https://acme.test/checkout-guide',
    'https://acme.test/how-checkout-works',
  ]);
});

test('a checkout page that opted into detail-item URLs contributes none of them either', () => {
  // The detail-item loop reads `eligiblePages`, so excluding the page from that
  // list must also exclude its items. Pinned because the two are separate loops
  // and a future refactor could easily reconnect the second one to `pages`.
  const pages = [
    { slug: 'checkoutsuccess', format: 'checkout-success', detailPage: { sitemap: true } },
  ];
  const urls = buildSitemapEntries(pages, 'https://acme.test', {
    checkoutsuccess: ['order-1', 'order-2'],
  }).map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test'], 'root only — no page entry and no item entries');
});

test('a site with ONLY checkout pages still emits its root entry, never an empty sitemap', () => {
  // An empty sitemap is the exact defect this whole area was fixed for. The
  // exclusion must never be able to produce one for a live site.
  const pages = [
    { slug: 'home', format: 'home' },
    { slug: 'checkoutsuccess', format: 'checkout-success' },
    { slug: 'checkoutcancel', format: 'checkout-cancel' },
  ];
  assert.deepStrictEqual(
    buildSitemapEntries(pages, 'https://acme.test').map((e) => e.url),
    ['https://acme.test'],
  );
});

// ── Two-axis detail-route design, Phase 3 (T4) — detail items in the sitemap ──

test('detailItemSegmentsByPage omitted ⇒ byte-identical URL/priority shape to the 2-arg call (fleet default)', () => {
  const scopedPages = [
    ...pages,
    { slug: 'santa-monica', format: 'collection-list', detailPage: { sitemap: true } },
  ];
  const shape = (entries: ReturnType<typeof buildSitemapEntries>) =>
    entries.map((e) => ({ url: e.url, priority: e.priority }));
  const withoutMap = shape(buildSitemapEntries(scopedPages, 'https://acme.test'));
  const twoArg = shape(buildSitemapEntries(scopedPages, 'https://acme.test'));
  assert.deepStrictEqual(withoutMap, twoArg);
});

test('detailPage.sitemap === true + resolved segments ⇒ detail item URLs appended', () => {
  const scopedPages = [
    { slug: 'santa-monica', format: 'collection-list', detailPage: { sitemap: true, itemKeyField: 'slug' } },
  ];
  const urls = buildSitemapEntries(scopedPages, 'https://acme.test', { 'santa-monica': ['botox', 'juvederm'] }).map(
    (e) => e.url,
  );
  assert.ok(urls.includes('https://acme.test/santa-monica/botox'));
  assert.ok(urls.includes('https://acme.test/santa-monica/juvederm'));
});

test('detailPage.sitemap absent/false ⇒ no detail items added even if segments are supplied', () => {
  const scopedPages = [{ slug: 'santa-monica', format: 'collection-list', detailPage: { itemKeyField: 'slug' } }];
  const urls = buildSitemapEntries(scopedPages, 'https://acme.test', { 'santa-monica': ['botox'] }).map((e) => e.url);
  assert.ok(!urls.includes('https://acme.test/santa-monica/botox'));
});

test('a page with sitemap:true but no resolved segments (empty pool / fetch miss) adds nothing', () => {
  const scopedPages = [{ slug: 'santa-monica', format: 'collection-list', detailPage: { sitemap: true } }];
  const urls = buildSitemapEntries(scopedPages, 'https://acme.test', {}).map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test', 'https://acme.test/santa-monica']);
});
