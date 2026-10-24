import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteDetailsRaw } from './resolve.ts';

/**
 * T1 (site-first-read-fallback plan). The decision `getSiteData` makes about
 * which site shell to render. At 52fbad4 the only outcome of a missing
 * `siteDetails.values` was `FALLBACK_SITE_DATA`, the placeholder page
 * (TEMPLATES-5), whatever the build had read.
 */

interface Raw {
  name: string;
  pages: Array<{ slug: string }>;
  siteDetails?: { values?: object | null } | null;
}

const SNAPSHOT: Raw = {
  name: 'Floor Cafe',
  pages: [{ slug: 'menu' }, { slug: 'features/ai-sites' }],
  siteDetails: { values: { name: 'Floor Cafe' } },
};
const LIVE: Raw = { name: 'Live Cafe', pages: [{ slug: 'menu' }, { slug: 'new-page' }], siteDetails: { values: { name: 'Live Cafe' } } };

test('T1 REFUSE: a failed read (null) with a valid snapshot renders the snapshot, never the placeholder', () => {
  const { raw, source } = resolveSiteDetailsRaw<Raw>(null, SNAPSHOT);
  assert.equal(source, 'floor');
  assert.equal(raw?.name, 'Floor Cafe');
  assert.deepEqual(raw?.pages.map((p) => p.slug), ['menu', 'features/ai-sites']);
});

test('T1 REFUSE: a read that "succeeded" with no values (research 2.3) renders the snapshot too', () => {
  const { raw, source } = resolveSiteDetailsRaw<Raw>({ name: '', pages: [], siteDetails: {} }, SNAPSHOT);
  assert.equal(source, 'floor');
  assert.equal(raw?.name, 'Floor Cafe');
});

test('T1 ALLOW: a good live read wins over the snapshot', () => {
  const { raw, source } = resolveSiteDetailsRaw<Raw>(LIVE, SNAPSHOT);
  assert.equal(source, 'live');
  assert.equal(raw, LIVE);
});

test('T1 CONTROL: no snapshot leaves today behaviour (the caller returns FALLBACK_SITE_DATA)', () => {
  assert.deepEqual(resolveSiteDetailsRaw<Raw>(null, null), { raw: null, source: 'none' });
  assert.deepEqual(resolveSiteDetailsRaw<Raw>(null, { name: 'x', pages: [], siteDetails: { values: null } }), {
    raw: null,
    source: 'none',
  });
});
