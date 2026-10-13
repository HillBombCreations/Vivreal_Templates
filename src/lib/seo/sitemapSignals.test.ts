import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sitemapBuiltLine, sitemapRefusedLine } from './sitemapSignals.ts';

test('sitemap.built carries the site, the address and item counts and the time', () => {
  assert.deepEqual(JSON.parse(sitemapBuiltLine({ siteId: 's1', urls: 152, items: 150, ms: 40 })), {
    event: 'sitemap.built',
    siteId: 's1',
    urls: 152,
    items: 150,
    ms: 40,
  });
});

test('sitemap.refused carries the site and the cause', () => {
  assert.deepEqual(JSON.parse(sitemapRefusedLine({ siteId: 's1', cause: 'x' })), { event: 'sitemap.refused', siteId: 's1', cause: 'x' });
});

// The refusal path is server-only (Sentry), so its wiring is pinned from source.
test('REFUSE: a degraded read is logged, sent to Sentry as sitemap.refused, and RE-THROWN (never an empty list)', () => {
  const code = readFileSync(new URL('./loadSitemapEntries.ts', import.meta.url), 'utf8');
  assert.match(code, /if \(err instanceof DegradedUpstreamError\) \{[\s\S]*?Sentry\.captureMessage\(SITEMAP_REFUSED,[\s\S]*?\}\s*throw err;/);
});

test('ALLOW: a build logs sitemap.built from getSiteMap', () => {
  const code = readFileSync(new URL('../api/siteData/index.tsx', import.meta.url), 'utf8');
  assert.match(code, /logSitemapBuilt\(\{ siteId: SITE_ID, urls: entries\.length, items: itemCount, ms: Date\.now\(\) - startedAt \}\);/);
});
