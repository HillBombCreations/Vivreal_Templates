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
  const entries = buildSitemapEntries(pages, 'acme.test');
  const urls = entries.map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test', 'https://acme.test/about', 'https://acme.test/menu']);
});

test('excludes the home duplicate and the synthetic subscribers carrier', () => {
  const urls = buildSitemapEntries(pages, 'acme.test').map((e) => e.url);
  assert.ok(!urls.includes('https://acme.test/home'), 'no /home duplicate');
  assert.ok(!urls.includes('https://acme.test/subscribers'), 'the subscribers carrier is not indexed');
});

test('home is priority 1.0 and content pages descend', () => {
  const entries = buildSitemapEntries(pages, 'acme.test');
  assert.strictEqual(entries[0].priority, 1.0);
  assert.ok((entries[1].priority ?? 0) < 1.0 && (entries[1].priority ?? 0) >= 0.1);
});

test('empty domainName ⇒ no sitemap', () => {
  assert.deepStrictEqual(buildSitemapEntries(pages, ''), []);
});

test('de-duplicates + strips leading slashes on slugs', () => {
  const dupes = [{ slug: 'about', format: 'about' }, { slug: '/about', format: 'about' }];
  const urls = buildSitemapEntries(dupes, 'acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test', 'https://acme.test/about'], 'one /about entry');
});

test('undefined pages ⇒ just the root', () => {
  const urls = buildSitemapEntries(undefined, 'acme.test').map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test']);
});

// ── Two-axis detail-route design, Phase 3 (T4) — detail items in the sitemap ──

test('detailItemSegmentsByPage omitted ⇒ byte-identical URL/priority shape to the 2-arg call (fleet default)', () => {
  const scopedPages = [
    ...pages,
    { slug: 'santa-monica', format: 'collection-list', detailPage: { sitemap: true } },
  ];
  const shape = (entries: ReturnType<typeof buildSitemapEntries>) =>
    entries.map((e) => ({ url: e.url, priority: e.priority }));
  const withoutMap = shape(buildSitemapEntries(scopedPages, 'acme.test'));
  const twoArg = shape(buildSitemapEntries(scopedPages, 'acme.test'));
  assert.deepStrictEqual(withoutMap, twoArg);
});

test('detailPage.sitemap === true + resolved segments ⇒ detail item URLs appended', () => {
  const scopedPages = [
    { slug: 'santa-monica', format: 'collection-list', detailPage: { sitemap: true, itemKeyField: 'slug' } },
  ];
  const urls = buildSitemapEntries(scopedPages, 'acme.test', { 'santa-monica': ['botox', 'juvederm'] }).map(
    (e) => e.url,
  );
  assert.ok(urls.includes('https://acme.test/santa-monica/botox'));
  assert.ok(urls.includes('https://acme.test/santa-monica/juvederm'));
});

test('detailPage.sitemap absent/false ⇒ no detail items added even if segments are supplied', () => {
  const scopedPages = [{ slug: 'santa-monica', format: 'collection-list', detailPage: { itemKeyField: 'slug' } }];
  const urls = buildSitemapEntries(scopedPages, 'acme.test', { 'santa-monica': ['botox'] }).map((e) => e.url);
  assert.ok(!urls.includes('https://acme.test/santa-monica/botox'));
});

test('a page with sitemap:true but no resolved segments (empty pool / fetch miss) adds nothing', () => {
  const scopedPages = [{ slug: 'santa-monica', format: 'collection-list', detailPage: { sitemap: true } }];
  const urls = buildSitemapEntries(scopedPages, 'acme.test', {}).map((e) => e.url);
  assert.deepStrictEqual(urls, ['https://acme.test', 'https://acme.test/santa-monica']);
});
