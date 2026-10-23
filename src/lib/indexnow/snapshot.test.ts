import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { SiteData } from '@/types/SiteData';
import { buildSiteMapForSite } from '../seo/siteMapPolicy.ts';
import { DegradedUpstreamError } from '../api/siteData/degraded.ts';
import { SNAPSHOT_MAX_SKEW_MS, snapshotAnswer, verifySnapshotRequest } from './snapshot.ts';

// Discovery batch 2.4 (design section 6, row "Snapshot route"). Every ALLOW has
// its REFUSE.

const SECRET = 'a'.repeat(64);
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);
const KEY = '0123456789abcdef0123456789abcdef';

function signed(body: string, secret = SECRET) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

const LIVE = {
  lifecycleState: 'live',
  indexNowKey: KEY,
  canonicalUrl: 'https://wavesofgrainco.com',
  domainInformation: { live_url: 'https://dndrl820jldt9.amplifyapp.com' },
} as SiteData;

const PAGES = [
  { slug: 'home', format: 'home', updatedAt: '2026-10-01T00:00:00.000Z' },
  { slug: 'shop', format: 'products' },
  { slug: 'about', format: 'about', updatedAt: '2026-09-01T00:00:00.000Z' },
];
const ITEMS = { shop: [{ segment: 'p1', lastModified: '2026-10-02T00:00:00.000Z' }, { segment: 'p2' }] };

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

test('ALLOW: a body signed with the site secret and a fresh ts passes', () => {
  const body = JSON.stringify({ ts: NOW - 1000 });
  assert.deepEqual(verifySnapshotRequest({ rawBody: body, signature: signed(body), secret: SECRET, now: NOW }), { ok: true });
});

test('REFUSE: a bad signature is refused (401 at the route)', () => {
  const body = JSON.stringify({ ts: NOW });
  for (const signature of [signed(body, 'b'.repeat(64)), 'sha256=', null, signed(`${body} `)]) {
    assert.deepEqual(verifySnapshotRequest({ rawBody: body, signature, secret: SECRET, now: NOW }), { ok: false, reason: 'bad_signature' });
  }
});

test('REFUSE: a ts six minutes old (or six minutes ahead) is refused', () => {
  for (const ts of [NOW - 6 * 60 * 1000, NOW + 6 * 60 * 1000]) {
    const body = JSON.stringify({ ts });
    assert.deepEqual(verifySnapshotRequest({ rawBody: body, signature: signed(body), secret: SECRET, now: NOW }), { ok: false, reason: 'stale' });
  }
  const edge = JSON.stringify({ ts: NOW - SNAPSHOT_MAX_SKEW_MS });
  assert.equal(verifySnapshotRequest({ rawBody: edge, signature: signed(edge), secret: SECRET, now: NOW }).ok, true, 'five minutes exactly still passes');
});

test('REFUSE: no secret configured refuses everything; a signed body with no numeric ts is refused', () => {
  const body = JSON.stringify({ ts: NOW });
  assert.deepEqual(verifySnapshotRequest({ rawBody: body, signature: signed(body), secret: undefined, now: NOW }), { ok: false, reason: 'not_configured' });
  for (const raw of ['{}', JSON.stringify({ ts: String(NOW) }), 'not json']) {
    assert.deepEqual(verifySnapshotRequest({ rawBody: raw, signature: signed(raw), secret: SECRET, now: NOW }), { ok: false, reason: 'bad_body' });
  }
});

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

test('ALLOW: a valid request returns the sitemap’s exact URL set, on the durable host, with the key location', async () => {
  const entries = buildSiteMapForSite(LIVE, PAGES, ITEMS);
  const answer = await snapshotAnswer(LIVE, async () => entries);
  assert.equal(answer.status, 200);
  const body = answer.body as { eligible: true; host: string; key: string; keyLocation: string; urls: Array<{ loc: string; lastmod?: string }> };
  assert.equal(body.eligible, true);
  assert.equal(body.host, 'wavesofgrainco.com', 'never the Amplify host');
  assert.equal(body.key, KEY);
  assert.equal(body.keyLocation, `https://wavesofgrainco.com/${KEY}.txt`);
  assert.deepEqual(body.urls.map((u) => u.loc), entries.map((e) => e.url), 'the list IS the sitemap');
  assert.deepEqual(body.urls, [
    { loc: 'https://wavesofgrainco.com', lastmod: '2026-10-01T00:00:00.000Z' },
    { loc: 'https://wavesofgrainco.com/shop', lastmod: '2026-10-02T00:00:00.000Z' },
    { loc: 'https://wavesofgrainco.com/about', lastmod: '2026-09-01T00:00:00.000Z' },
    { loc: 'https://wavesofgrainco.com/shop/p1', lastmod: '2026-10-02T00:00:00.000Z' },
    { loc: 'https://wavesofgrainco.com/shop/p2' },
  ]);
});

test('REFUSE: a demo returns eligible false and reads no page list', async () => {
  let reads = 0;
  const answer = await snapshotAnswer({ ...LIVE, lifecycleState: 'demo' } as SiteData, async () => {
    reads += 1;
    return [];
  });
  assert.deepEqual(answer, { status: 200, body: { eligible: false, reason: 'demo' } });
  assert.equal(reads, 0);
});

test('REFUSE (absent C1): no key returns eligible false; no durable origin returns eligible false', async () => {
  const noKey = { ...LIVE, indexNowKey: undefined } as SiteData;
  assert.deepEqual((await snapshotAnswer(noKey, async () => [])).body, { eligible: false, reason: 'no_key' });
  const amplifyOnly = { lifecycleState: 'live', indexNowKey: KEY, domainInformation: { live_url: 'https://x.amplifyapp.com' } } as SiteData;
  assert.deepEqual((await snapshotAnswer(amplifyOnly, async () => [])).body, { eligible: false, reason: 'no_origin' });
});

test('REFUSE: degraded site data, or a page list refused as degraded, is a 503, never an empty list', async () => {
  assert.equal((await snapshotAnswer({ ...LIVE, degraded: true } as SiteData, async () => [])).status, 503);
  const refused = await snapshotAnswer(LIVE, async () => {
    throw new DegradedUpstreamError('sitemap.xml', 'test');
  });
  assert.equal(refused.status, 503);
});
