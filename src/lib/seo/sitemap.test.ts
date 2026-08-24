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

// ── an author-hidden page must not be SUBMITTED to the crawler it is hiding from
//
// The second half of the same defect class as the checkout pages above. The
// author turns the Studio search-visibility toggle off, `[slug]/page.tsx` emits
// `noindex, nofollow` for that page, and the sitemap kept submitting the URL
// anyway. Google Search Console reports that exact pair as "Submitted URL marked
// noindex": the site invites the crawl and refuses the result in one breath.
//
// The field is `pageConfig.seo.noindex` (src/types/SiteData/index.tsx), written
// by the portal Studio's seoDraft collapse, which persists the key only when it
// is true.

const hiddenPagePages = [
  { slug: 'home', format: 'home' },
  { slug: 'about', format: 'about' },
  { slug: 'thank-you', format: 'static', seo: { noindex: true } },
  { slug: 'menu', format: 'list' },
];

test('DEFECT: an author-noindexed page is absent from the sitemap', () => {
  const urls = buildSitemapEntries(hiddenPagePages, 'https://acme.test').map((e) => e.url);
  assert.ok(
    !urls.includes('https://acme.test/thank-you'),
    'a page the author hid from search must not be submitted to search',
  );
});

test('DEFECT: the removal is surgical, every page the author did NOT hide is still advertised, in order', () => {
  // The mirror of the checkout case: a change that dropped the hidden page by
  // dropping something else with it would pass the assertion above.
  const urls = buildSitemapEntries(hiddenPagePages, 'https://acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, [
    'https://acme.test',
    'https://acme.test/about',
    'https://acme.test/menu',
  ]);
});

test('the author rule fires on the FLAG, not on the format: `static` is otherwise indexable and stays so', () => {
  // `thank-you` above is a `static` page, the same format as privacy/terms,
  // which pageIndexing.ts deliberately keeps indexable. Only the flag moved it.
  // This is what keeps the two rules independent: the author rule must not be
  // implementable as "another format in the set".
  const sameFormatUnflagged = [
    { slug: 'home', format: 'home' },
    { slug: 'thank-you', format: 'static' },
  ];
  const urls = buildSitemapEntries(sameFormatUnflagged, 'https://acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test', 'https://acme.test/thank-you']);
});

test('BACK-COMPAT: a site with zero author-hidden pages gets byte-identical entries, seo block present or not', () => {
  // The fleet-wide guarantee. `seo` is a bag most pages carry for metaTitle /
  // metaDescription alone, and a site that has never touched the visibility
  // toggle must be unable to tell this change shipped.
  //
  // Compares the FULL entry shape (url + priority + changeFrequency), not just
  // URLs, because the priority renumbering is the one way a removal leaks into
  // entries it did not remove. `lastModified` is `new Date()` per call and is
  // excluded for that reason alone.
  const shape = (entries: ReturnType<typeof buildSitemapEntries>) =>
    entries.map((e) => ({ url: e.url, priority: e.priority, changeFrequency: e.changeFrequency }));

  const noSeoAtAll = [
    { slug: 'home', format: 'home' },
    { slug: 'about', format: 'about' },
    { slug: 'menu', format: 'list' },
  ];
  const seoButNoFlag = [
    { slug: 'home', format: 'home', seo: { metaTitle: 'Home' } },
    { slug: 'about', format: 'about', seo: { metaDescription: 'About us' } },
    { slug: 'menu', format: 'list', seo: { noindex: false } },
  ];

  const baseline = shape(buildSitemapEntries(noSeoAtAll, 'https://acme.test'));
  assert.deepStrictEqual(shape(buildSitemapEntries(seoButNoFlag, 'https://acme.test')), baseline);
  // ...and the baseline itself is still the pre-change output, spelled out
  // rather than compared to itself.
  assert.deepStrictEqual(baseline, [
    { url: 'https://acme.test', priority: 1.0, changeFrequency: 'monthly' },
    { url: 'https://acme.test/about', priority: 0.55, changeFrequency: 'monthly' },
    { url: 'https://acme.test/menu', priority: 0.1, changeFrequency: 'monthly' },
  ]);
});

test('the two rules COMPOSE: a checkout page and an author-hidden page both go, and only those two', () => {
  const mixed = [
    { slug: 'home', format: 'home' },
    { slug: 'products', format: 'products' },
    { slug: 'private-launch', format: 'about', seo: { noindex: true } },
    { slug: 'checkoutsuccess', format: 'checkout-success' },
    { slug: 'terms', format: 'static' },
  ];
  const urls = buildSitemapEntries(mixed, 'https://acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, [
    'https://acme.test',
    'https://acme.test/products',
    'https://acme.test/terms',
  ]);
});

test('the author rule renumbers priority the same way the format rule does: position-derived, stated not discovered', () => {
  // Same arithmetic consequence the checkout removal has, pinned separately so
  // it reads as an intended property of the AUTHOR rule rather than something
  // inherited quietly. 2 remaining slugs of 4 pages ⇒ a 0.9/2 = 0.45 step, so
  // the survivors span the full 1.0 → 0.1 range instead of holding the
  // positions they had when the hidden pages were still in the list.
  const entries = buildSitemapEntries(hiddenPagePages, 'https://acme.test');
  assert.deepStrictEqual(
    entries.map((e) => e.priority),
    [1.0, 0.55, 0.1],
  );
});

test('an author-hidden page that opted into detail-item URLs contributes none of them either', () => {
  // Mirrors the checkout detail-item case: the item loop reads `eligiblePages`,
  // so a page removed by the author rule must take its items with it.
  const pages = [
    { slug: 'home', format: 'home' },
    {
      slug: 'santa-monica',
      format: 'collection-list',
      detailPage: { sitemap: true },
      seo: { noindex: true },
    },
  ];
  const urls = buildSitemapEntries(pages, 'https://acme.test', {
    'santa-monica': ['botox', 'juvederm'],
  }).map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test'], 'root only, no page entry and no item entries');
});

test('an author-hidden HOME page removes the sitemap ROOT entry, the one URL the toggle would otherwise silently miss', () => {
  // `/` is the home page. Home is excluded from the slug list by the
  // home-duplicate rule, so without an explicit gate the root entry was emitted
  // unconditionally and a site whose owner hid home kept submitting `/` while
  // app/page.tsx served it `noindex, nofollow`.
  const pages = [
    { slug: 'home', format: 'home', seo: { noindex: true } },
    { slug: 'about', format: 'about' },
  ];
  const urls = buildSitemapEntries(pages, 'https://acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test/about'], 'no root entry, the rest untouched');
});

test('only the AUTHOR can remove the root entry: a home page with no flag keeps it, however it is identified', () => {
  // The gate matches home the same way getSiteData() does (`format === 'home'
  // || slug === 'home'`), so the page whose metadata carries the noindex is
  // exactly the page consulted here. Both spellings, both unflagged, root kept.
  for (const home of [
    { slug: 'home', format: 'home' },
    { slug: 'home', format: 'standard' },
    { slug: 'welcome', format: 'home' },
  ]) {
    const urls = buildSitemapEntries([home, { slug: 'about', format: 'about' }], 'https://acme.test').map(
      (e) => e.url,
    );
    assert.ok(urls.includes('https://acme.test'), `root entry kept for ${JSON.stringify(home)}`);
  }
});

test('a site with no pages at all still emits its root, because the author rule cannot fire on a page that is not there', () => {
  // Guards the `find` returning undefined. An empty sitemap is the defect this
  // whole area was fixed for, and only an explicit author flag may produce one.
  assert.deepStrictEqual(buildSitemapEntries(undefined, 'https://acme.test').map((e) => e.url), [
    'https://acme.test',
  ]);
  assert.deepStrictEqual(buildSitemapEntries([], 'https://acme.test').map((e) => e.url), [
    'https://acme.test',
  ]);
});
