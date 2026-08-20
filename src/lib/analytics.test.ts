/**
 * Unit tests for the single GA4 conversion event (C5).
 *
 * The fleet property is the one to hold on to: a customer site has no consent
 * surface, so `resolveConsentState()` reports `gated: false` and this emits
 * nothing — a customer site with GA4 configured sends exactly what it sends
 * today. The event only exists inside vivreal.io's own consented funnel.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type DomHarness } from './__testing__/domHarness.ts';
import { trackLeadConversion, resetLeadEventForTests } from './analytics.ts';
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED, COOKIE_CONSENT_REJECTED } from './consent.ts';

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

test('consent granted on the apex ⇒ generate_lead fires', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  trackLeadConversion({ method: 'popup' });

  assert.deepEqual(leadEvents(), [
    ['event', 'generate_lead', { event_category: 'Lead', method: 'popup' }],
  ]);
});

test('the method is omitted rather than sent empty when unknown', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  trackLeadConversion();
  assert.deepEqual(leadEvents(), [['event', 'generate_lead', { event_category: 'Lead' }]]);
});

test('consent rejected ⇒ nothing fires', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_REJECTED);
  trackLeadConversion({ method: 'footer' });
  assert.deepEqual(leadEvents(), []);
});

test('consent undecided ⇒ nothing fires', () => {
  trackLeadConversion({ method: 'footer' });
  assert.deepEqual(leadEvents(), []);
});

test('★ a customer site fires nothing, even with consent stored and GA4 present', () => {
  for (const host of ['acme.com', 'www.acme.com', 'vivreal.io.evil.com']) {
    resetLeadEventForTests();
    dom.setHostname(host);
    dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
    trackLeadConversion({ method: 'inline' });
    assert.deepEqual(leadEvents(), [], `${host} must emit no conversion event`);
  }
});

test('no gtag on the page ⇒ no throw, no event', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  delete (window as { gtag?: unknown }).gtag;
  assert.doesNotThrow(() => trackLeadConversion({ method: 'inline' }));
});

test('deduped per page load — two conversions from one visitor count once', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  trackLeadConversion({ method: 'footer' });
  trackLeadConversion({ method: 'popup' });
  assert.equal(leadEvents().length, 1);
});

test('a gtag that throws cannot break the submit handler that already succeeded', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);
  (window as { gtag?: unknown }).gtag = () => {
    throw new Error('tag manager blew up');
  };
  assert.doesNotThrow(() => trackLeadConversion({ method: 'inline' }));
});
