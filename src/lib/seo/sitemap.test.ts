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
