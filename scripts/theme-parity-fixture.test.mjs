import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFixtureSiteData, REDACTED } from './theme-parity-fixture.mjs';

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
