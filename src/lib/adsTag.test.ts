/**
 * Owner ideas 2026-10-29, T6 (plan 3.3, D18 to D20): a customer site's Google
 * tags behind the visitor permission banner.
 *
 *   ALLOW  the `AW-` tag loads only after Accept (and on the restore of a
 *          stored Accept);
 *   REFUSE a malformed `AW-` code emits nothing and asks nothing;
 *   REFUSE no conversion before consent, for an unticked result, or under GPC;
 *   REFUSE a customer site's Accept never runs Vivreal's own Clarity or vr_attr.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installDom, type DomHarness } from './__testing__/domHarness.ts';
import {
  configureAdsConversions,
  customerConsentTags,
  fireAdsConversion,
  readAdsConfig,
  resolveCustomerConsentScripts,
} from './adsTag.ts';
import {
  COOKIE_CONSENT_KEY,
  denyConsent,
  grantConsent,
  resetConsentApplied,
  runConsentMount,
  type VendorScript,
} from './consent.ts';

const ADS_ONLY = { adsTagId: 'AW-123456789', adsConversionLabel: 'AbC_123-x', adsConversionEvents: ['booking', 'purchase'] };
const GA_AND_ADS = { provider: 'google_analytics', trackingId: 'G-ABC123', consentMode: true, ...ADS_ONLY };
const CLARITY: VendorScript[] = [{ domId: 'vr-clarity', innerHTML: 'window.__clarity = true;' }];
const CUSTOMER = { ownSite: false };

let dom: DomHarness;

beforeEach(() => {
  dom = installDom({ hostname: 'shop.example' });
  resetConsentApplied();
  configureAdsConversions(null);
});

afterEach(() => dom.restore());

const ids = () => dom.scripts().map((el) => el.id);

test('ALLOW: the AW- tag loads only after Accept', () => {
  const scripts = resolveCustomerConsentScripts(ADS_ONLY);
  assert.deepEqual(scripts.map((s) => s.domId), ['vr-ads-gtag', 'vr-ads-init']);
  assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=AW-123456789');

  runConsentMount(true, [], scripts, CUSTOMER);
  assert.deepEqual(ids(), [], 'nothing Google before a choice');

  grantConsent(true, [], scripts, CUSTOMER);
  assert.deepEqual(ids(), ['vr-ads-gtag', 'vr-ads-init']);
});

test('ALLOW: a stored Accept restores the tag on the next page, with no click', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, 'accepted');
  runConsentMount(true, [], resolveCustomerConsentScripts(GA_AND_ADS), CUSTOMER);
  assert.deepEqual(ids(), ['vr-ga-gtag', 'vr-ga-init', 'vr-ads-config']);
  const adsLine = dom.scripts().find((el) => el.id === 'vr-ads-config');
  assert.equal(adsLine?.innerHTML, "gtag('config','AW-123456789');", 'rides the GA gtag');
});

test('REFUSE: Reject loads nothing Google', () => {
  denyConsent(true, CUSTOMER);
  runConsentMount(true, [], resolveCustomerConsentScripts(GA_AND_ADS), CUSTOMER);
  assert.deepEqual(ids(), []);
});

test('REFUSE: a malformed AW- code emits nothing and asks nothing', () => {
  for (const adsTagId of ['AW-12345', 'AW-1234567890123', 'aw-123456789', "AW-123456');alert(1);//", 'G-ABC123', '', null]) {
    const config = { adsTagId, adsConversionLabel: 'AbC_123-x', adsConversionEvents: ['purchase'] };
    assert.equal(readAdsConfig(config), null, String(adsTagId));
    assert.equal(customerConsentTags(config), null, String(adsTagId));
    assert.deepEqual(resolveCustomerConsentScripts(config), [], String(adsTagId));
  }
});

test('REFUSE: a customer site with no Google tag, or GA without consent mode, does not ask', () => {
  assert.equal(customerConsentTags(null), null);
  assert.equal(customerConsentTags({ provider: 'plausible', trackingId: 'shop.example', consentMode: true }), null);
  assert.equal(customerConsentTags({ provider: 'google_analytics', trackingId: 'G-ABC123' }), null, 'today\'s GA sites are untouched');
  assert.deepEqual(customerConsentTags({ provider: 'google_analytics', trackingId: 'G-ABC123', consentMode: true }), { analytics: true, ads: false });
  assert.deepEqual(customerConsentTags(ADS_ONLY), { analytics: false, ads: true }, 'an AW code asks even without consentMode');
});

test('REFUSE: no conversion before consent', () => {
  configureAdsConversions(readAdsConfig(ADS_ONLY));
  const scripts = resolveCustomerConsentScripts(ADS_ONLY);
  runConsentMount(true, [], scripts, CUSTOMER);
  assert.equal(fireAdsConversion('booking'), false);
  assert.equal(dom.gtagCalls().filter((c) => c[1] === 'conversion').length, 0);

  grantConsent(true, [], scripts, CUSTOMER);
  assert.equal(fireAdsConversion('booking'), true);
  const conversion = dom.gtagCalls().find((c) => c[1] === 'conversion');
  assert.deepEqual(conversion, ['event', 'conversion', { send_to: 'AW-123456789/AbC_123-x' }]);
});

test('REFUSE: an unticked result, a missing label or GPC sends no conversion', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, 'accepted');
  configureAdsConversions(readAdsConfig(ADS_ONLY));
  assert.equal(fireAdsConversion('message'), false, 'message was not ticked');

  configureAdsConversions(readAdsConfig({ ...ADS_ONLY, adsConversionLabel: 'bad label!' }));
  assert.equal(fireAdsConversion('booking'), false, 'no valid label');

  configureAdsConversions(readAdsConfig(ADS_ONLY));
  dom.setGpc(true);
  assert.equal(fireAdsConversion('booking'), false, 'GPC keeps ad signals off');
});

test('control: on Vivreal\'s own site the same Accept DOES run Clarity and write vr_attr', () => {
  dom.setUrl('/?utm_source=google');
  grantConsent(true, CLARITY, [], { ownSite: true });
  assert.ok(ids().includes('vr-clarity'));
  assert.notEqual(dom.cookie('vr_attr'), null);
});

test('REFUSE: a customer site\'s Accept never runs Clarity or writes vr_attr', () => {
  dom.setUrl('/?utm_source=google');
  grantConsent(true, CLARITY, resolveCustomerConsentScripts(ADS_ONLY), CUSTOMER);
  assert.ok(!ids().includes('vr-clarity'));
  assert.equal(dom.cookie('vr_attr'), null);
  assert.equal(dom.gtagCalls().filter((c) => c[1] === 'cookie_consent_accept').length, 0);
});

test('REFUSE: the customer banner speaks the renderer\'s words, and the layout drops the head GA tag on such a site', () => {
  const banner = fs.readFileSync(new URL('../components/SiteConsent/index.tsx', import.meta.url), 'utf8');
  assert.match(banner, /data-consent-copy="renderer"/);
  assert.match(banner, /consentBannerSentences\(customerTags\)/);
  const layout = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /!vivrealOwnSite && !customerTags\?\.analytics && <SiteAnalytics/);
  assert.match(layout, /customerTags=\{customerTags\}/);
});
