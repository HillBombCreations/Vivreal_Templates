import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFixtureSiteData, REDACTED, buildFixture, rawFromDbValues } from './theme-parity-fixture.mjs';

const RAW = {
  name: 'Cobalt Bakery',
  tier: 'pro',
  updatedAt: '2026-10-27T00:00:00.000Z',
  favicon: 'data:image/png;base64,AAAA',
  motionPreset: 'calm',
  domainInformation: { live_url: 'https://cobalt.example' },
  siteDetails: {
    values: {
      primary: '#1f3a5f',
      'surface-alt': '#eeeff0',
      border: '#e4e4e7',
      'contact-button-radius': '0px',
      chrome: 'dark',
      canonicalUrl: 'https://cobalt.example',
      googleSiteVerification: 'secret-ish-token',
      fontFamily: 'Geist',
      motionPreset: 'stale-mirror',
      emailPopup: { enabled: true },
      typography: { monoFamily: "'JetBrains Mono', monospace", note: 'dropped', size: 3 },
      logo: { key: 'a.png' },
    },
  },
};

test('ALLOW: theme keys, chrome and the typography families travel verbatim', () => {
  const site = toFixtureSiteData(RAW);
  assert.equal(site.primary, '#1f3a5f');
  assert.equal(site['surface-alt'], '#eeeff0');
  assert.equal(site.border, '#e4e4e7');
  assert.equal(site['contact-button-radius'], '0px');
  assert.equal(site.chrome, 'dark');
  assert.deepEqual(site.typography, { monoFamily: "'JetBrains Mono', monospace" });
});

test('REFUSE: no other stored value leaves the dump; each string key stays, redacted', () => {
  const site = toFixtureSiteData(RAW);
  const text = JSON.stringify(site);
  for (const leak of ['cobalt.example', 'secret-ish-token', 'data:image', 'Cobalt Bakery', 'Geist', '2026-10-27', 'calm']) {
    assert.ok(!text.includes(leak), `${leak} leaked into the fixture`);
  }
  for (const key of ['canonicalUrl', 'googleSiteVerification', 'fontFamily', 'name', 'tier', 'updatedAt', 'favicon', 'motionPreset']) {
    assert.equal(site[key], REDACTED, key);
  }
  // Non-string values are not stamped by any theme writer, so they are not carried.
  for (const key of ['emailPopup', 'logo', 'domainInformation']) assert.equal(key in site, false, key);
});

test('REFUSE: the chrome fields come from the top level only, as getSiteData builds them', () => {
  const site = toFixtureSiteData({ ...RAW, motionPreset: undefined });
  // The values mirror is replaced by the absent top level, so the key is gone, not "stale-mirror".
  assert.equal('motionPreset' in site, false);
});

test('REFUSE: a response with no siteDetails.values is refused, not turned into an empty site', () => {
  assert.throws(() => toFixtureSiteData({ name: 'x' }), /no siteDetails\.values/);
});

/* ── a site whose Client API fetch failed, from a read-only DB read ────────── */

const FAILED = '68adda65762dfc328d91382d';
const DB_DOC = { _id: { $oid: FAILED }, siteDetails: { values: { primary: '#2e5e3a', border: '#d9d2c0', canonicalUrl: 'https://grain.example', chrome: 'light' } } };

test('ALLOW: a failed fetch is filled from the DB document, marked, redacted, and leaves notFetched', () => {
  const fixture = buildFixture({ a1: { raw: RAW }, [FAILED]: { error: 'fetch failed' } }, { [FAILED]: DB_DOC });
  assert.deepEqual(fixture.notFetched, []);
  const site = fixture.sites.find((s) => s.id === FAILED);
  assert.equal(site.source, 'db');
  assert.equal(site.siteData.primary, '#2e5e3a');
  assert.equal(site.siteData.border, '#d9d2c0');
  assert.equal(site.siteData.canonicalUrl, REDACTED);
  assert.equal(fixture.sites.find((s) => s.id === 'a1').source, undefined, 'a fetched site is not marked as a DB read');
  // The bare values object is accepted too.
  assert.deepEqual(rawFromDbValues(DB_DOC.siteDetails.values), { siteDetails: { values: DB_DOC.siteDetails.values } });
});

test('ALLOW: without a DB read the failed site stays listed as not fetched', () => {
  const fixture = buildFixture({ a1: { raw: RAW }, [FAILED]: { error: 'fetch failed' } });
  assert.deepEqual(fixture.notFetched, [FAILED]);
  assert.equal(fixture.sites.length, 1);
});

test('REFUSE: a DB read never replaces settings the Client API returned, and a non-site document is refused', () => {
  assert.throws(() => buildFixture({ a1: { raw: RAW } }, { a1: DB_DOC }), /already has its settings/);
  for (const bad of [{}, [], { siteDetails: { values: { name: 'x' } } }, null]) {
    assert.throws(() => rawFromDbValues(bad), /no string primary/, JSON.stringify(bad));
  }
});
