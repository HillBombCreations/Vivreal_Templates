/**
 * Unit tests for the single GA4 conversion event (C5).
 *
 * The fleet property is the one to hold on to: a customer site has no consent
 * surface, so `resolveConsentState()` reports `gated: false` and this emits
 * nothing. A customer site with GA4 configured sends exactly what it sends
 * today. The event only exists inside Vivreal's own consented funnel.
 *
 * THAT PROPERTY DID NOT HOLD, and this file is part of why nobody noticed. Its
 * customer-site case tried `acme.com`, `www.acme.com` and `vivreal.io.evil.com`
 * and no `<customer>.vivreal.io`, which is the shape a customer site with no
 * purchased domain is actually served from and the one the old apex gate
 * matched. `window.gtag` on a customer site is the CUSTOMER's GA4 property, so
 * a visitor who accepted Vivreal's banner there fired Vivreal's `generate_lead`
 * into the customer's analytics. The gate is now the site id, threaded in as
 * `vivrealOwnSite`, and the hostname decides nothing.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type DomHarness } from './__testing__/domHarness.ts';
import { trackLeadConversion, resetLeadEventForTests } from './analytics.ts';
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED, COOKIE_CONSENT_REJECTED } from './consent.ts';

/** The resolved fleet gate, as the server layout computes it. */
const VIVREAL_SITE = true;
const CUSTOMER_SITE = false;

let dom: DomHarness;

beforeEach(() => {
  dom = installDom({ hostname: 'vivreal.io' });
  resetLeadEventForTests();
});

afterEach(() => {
  dom.restore();
});

function leadEvents(): unknown[][] {
  return dom.gtagCalls().filter((c) => c[0] === 'event' && c[1] === 'generate_lead');
}

test('consent granted on a Vivreal site ⇒ generate_lead fires', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE, method: 'popup' });

  assert.deepEqual(leadEvents(), [
    ['event', 'generate_lead', { event_category: 'Lead', method: 'popup' }],
  ]);
});

test('the method is omitted rather than sent empty when unknown', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE });
  assert.deepEqual(leadEvents(), [['event', 'generate_lead', { event_category: 'Lead' }]]);
});

test('consent rejected ⇒ nothing fires', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_REJECTED);
  trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE, method: 'footer' });
  assert.deepEqual(leadEvents(), []);
});

test('consent undecided ⇒ nothing fires', () => {
  trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE, method: 'footer' });
  assert.deepEqual(leadEvents(), []);
});

test('a customer site fires nothing, even with consent stored and GA4 present', () => {
  // Every host here, INCLUDING the vivreal.io subdomain that is the regression
  // case and that the previous version of this test omitted. The hostname is
  // deliberately varied to prove it changes nothing: the gate is the argument.
  for (const host of [
    'acme.com',
    'www.acme.com',
    'vivreal.io.evil.com',
    'windward-house.vivreal.io',
  ]) {
    resetLeadEventForTests();
    dom.setHostname(host);
    dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
    trackLeadConversion({ vivrealOwnSite: CUSTOMER_SITE, method: 'inline' });
    assert.deepEqual(leadEvents(), [], `${host} must emit no conversion event`);
  }

  // The control the old version lacked: the SAME stored acceptance and the same
  // customer hostname DO fire once the gate says this is Vivreal's site. Without
  // this, a trackLeadConversion that never fired at all would pass the loop.
  resetLeadEventForTests();
  dom.setHostname('windward-house.vivreal.io');
  trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE, method: 'inline' });
  assert.equal(leadEvents().length, 1, 'the loop above must be the gate, not a dead function');
});

test('no gtag on the page ⇒ no throw, no event', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  delete (window as { gtag?: unknown }).gtag;
  assert.doesNotThrow(() => trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE, method: 'inline' }));
});

test('deduped per page load — two conversions from one visitor count once', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE, method: 'footer' });
  trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE, method: 'popup' });
  assert.equal(leadEvents().length, 1);
});

test('a gtag that throws cannot break the submit handler that already succeeded', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  (window as { gtag?: unknown }).gtag = () => {
    throw new Error('tag manager blew up');
  };
  assert.doesNotThrow(() => trackLeadConversion({ vivrealOwnSite: VIVREAL_SITE, method: 'inline' }));
});
