import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partSitemapXml, renderUrlset, rootSitemapXml, SITEMAP_PAGE_SIZE } from './sitemapXml.ts';

const entries = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ url: `https://acme.test/shop/p${i}`, changeFrequency: 'monthly' as const, priority: 0.5 }));

test('ALLOW (R4): 150 products are 150 addresses in one file', () => {
  const xml = rootSitemapXml(entries(150));
  assert.equal(xml.match(/<url>/g)?.length, 150);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset /);
});

test('ALLOW (R4): past 1,000 addresses /sitemap.xml is an index of parts that hold every address once', () => {
  const all = entries(2_345);
  const root = rootSitemapXml(all);
  assert.match(root, /<sitemapindex /);
  assert.deepEqual(root.match(/<loc>[^<]+<\/loc>/g), [
    '<loc>https://acme.test/sitemaps/1.xml</loc>',
    '<loc>https://acme.test/sitemaps/2.xml</loc>',
    '<loc>https://acme.test/sitemaps/3.xml</loc>',
  ]);
  const counted = [1, 2, 3].reduce((n, i) => n + (partSitemapXml(all, `${i}.xml`)?.match(/<url>/g)?.length ?? 0), 0);
  assert.equal(counted, 2_345);
  assert.equal(partSitemapXml(all, '1.xml')?.match(/<url>/g)?.length, SITEMAP_PAGE_SIZE);
});

test('REFUSE (R4): exactly 1,000 addresses stay one file; a part that does not exist is null', () => {
  assert.match(rootSitemapXml(entries(1_000)), /<urlset /);
  assert.equal(partSitemapXml(entries(1_000), '1.xml'), null, 'no parts when the list fits');
  for (const file of ['0.xml', '4.xml', '1', '01.xml', '../1.xml', '1.xml.gz']) {
    assert.equal(partSitemapXml(entries(2_345), file), null, file);
  }
});

test('the urlset escapes addresses and writes dates only when the entry has one', () => {
  const xml = renderUrlset([
    { url: 'https://acme.test/a?b=1&c=<2>', lastModified: '2026-09-02T10:00:00.000Z', priority: 1 },
    { url: 'https://acme.test/b' },
  ]);
  assert.match(xml, /<loc>https:\/\/acme\.test\/a\?b=1&amp;c=&lt;2&gt;<\/loc>\n<lastmod>2026-09-02T10:00:00\.000Z<\/lastmod>/);
  assert.equal(xml.match(/<lastmod>/g)?.length, 1);
});

test('an empty list (a prospect demo) is an empty urlset, as before', () => {
  assert.equal(rootSitemapXml([]), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n');
});
