/**
 * Unit tests for the vivreal.io consent controller (G13 / C2).
 *
 * Covers the design's test-plan items 2 (the fleet gate, which is the SITE ID
 * and no longer the host), 4 (GPC), 6 (C2-AC1 restore) and 8 (withdrawal).
 *
 * ★ C2-AC1 is the load-bearing one: with `cookie_consent_v1 === 'accepted'`
 * pre-seeded and NO banner interaction at all, `gtag('consent','update',
 * {analytics_storage:'granted', ad_storage:'granted', ad_user_data:'granted'})`
 * must be observed and every configured vendor
 * script must be in the DOM. **This test must fail against a click-only
 * implementation** — that is the entire point of it. The mirror cases
 * ('rejected' and absent) are mandatory, not optional: a restore path that
 * mis-reads the stored value and grants when it should not is a
 * consent-integrity defect with the opposite sign.
 *
 * The vendor snippets here are SYNTHETIC. The controller is deliberately
 * vendor-agnostic (it receives `{domId, innerHTML}` pairs, never a provider
 * name or a URL); C9's registry is what turns config into these, and it has its
 * own fail-closed suite. No real vendor id appears anywhere in this file.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type DomHarness } from './__testing__/domHarness.ts';
import { resolveConsentGaScripts } from './gaConsentLoad.ts';
import {
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_ACCEPTED,
  COOKIE_CONSENT_REJECTED,
  readStoredConsentChoice,
  resolveConsentState,
  runConsentMount,
  grantConsent,
  denyConsent,
  withdrawConsent,
  resetConsentApplied,
  injectVendorScript,
  isGpcEnabled,
  type VendorScript,
} from './consent.ts';

const FAKE_VENDORS: VendorScript[] = [
  { domId: 'fake-vendor-a', innerHTML: 'window.__fakeVendorA = true;' },
  { domId: 'fake-vendor-b', innerHTML: 'window.__fakeVendorB = true;' },
];

let dom: DomHarness;

beforeEach(() => {
  dom = installDom({ hostname: 'vivreal.io' });
  resetConsentApplied();
});

afterEach(() => {
  dom.restore();
});

function injectedIds(): string[] {
  return dom
    .scripts()
    .map((s) => s.id)
    .filter(Boolean);
}

function consentUpdates(): unknown[][] {
  return dom.gtagCalls().filter((c) => c[0] === 'consent' && c[1] === 'update');
}

// ── the fleet gate ──────────────────────────────────────────────

/**
 * These cases used to drive the gate with `dom.setHostname(...)`, and that is
 * exactly why they never caught the defect: every host they tried was a
 * customer CUSTOM domain or a suffix-confusion string, never the
 * `<customer>.vivreal.io` shape most customer sites are actually served from,
 * which the old apex gate matched. The gate is now a resolved boolean the
 * server computes from `SITE_ID`, so the hostname is irrelevant here and the
 * harness deliberately stays on `vivreal.io` throughout: if the hostname could
 * still change any answer below, that would itself be the bug.
 *
 * `lib/vivrealApex.test.ts` is what maps real deployed site ids onto this
 * boolean.
 */
const CUSTOMER_SITE = false;
const VIVREAL_SITE = true;

test('no consent surface exists on a customer site, even with a stored acceptance', () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);

  const state = runConsentMount(CUSTOMER_SITE, FAKE_VENDORS);

  assert.equal(state.gated, false, 'a customer site is never gated');
  assert.equal(state.showBanner, false, 'no banner may render on a customer site');
  assert.equal(state.showWithdraw, false);
  assert.equal(state.vendorsAllowed, false);
  assert.deepEqual(injectedIds(), [], 'no vendor tag may reach a customer site');
  assert.deepEqual(dom.gtagCalls(), [], 'no consent signal may be emitted on a customer site');
});

test('grant/deny/withdraw are all no-ops on a customer site', () => {
  grantConsent(CUSTOMER_SITE, FAKE_VENDORS);
  denyConsent(CUSTOMER_SITE);
  withdrawConsent(CUSTOMER_SITE, () => {
    throw new Error('withdrawal must not reload a customer site');
  });

  assert.equal(dom.storage.size, 0, 'nothing may be written to a customer site storage');
  assert.deepEqual(injectedIds(), []);
  assert.deepEqual(dom.gtagCalls(), []);
});

test("the gate ignores the hostname entirely, on both answers", () => {
  // The control for the case above. A customer site stays ungated and a Vivreal
  // site stays gated on the very host that fooled the old predicate, which is
  // the whole content of this fix.
  for (const host of ['windward-house.vivreal.io', 'vivreal.io', 'acme.com']) {
    dom.setHostname(host);
    assert.equal(
      resolveConsentState(CUSTOMER_SITE).gated,
      false,
      `a customer site must stay ungated on ${host}`,
    );
    assert.equal(
      resolveConsentState(VIVREAL_SITE).gated,
      true,
      `a Vivreal site must stay gated on ${host}`,
    );
  }
});

test("Vivreal's own sites ARE gated", () => {
  assert.equal(resolveConsentState(VIVREAL_SITE).gated, true);
});

// ── ★ C2-AC1 — restore on mount, not just capture on click ─────────────────

test("★ C2-AC1: stored 'accepted' + NO interaction ⇒ consent upgraded AND vendors injected", () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);

  const state = runConsentMount(VIVREAL_SITE, FAKE_VENDORS);

  assert.equal(state.showBanner, false, 'a returning consenter must not be re-prompted');
  assert.equal(state.showWithdraw, true, 'but they must be able to withdraw');
  assert.equal(state.vendorsAllowed, true);
  assert.deepEqual(
    consentUpdates(),
    [['consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' }]],
    'GA4 must be upgraded out of the denied default on RESTORE, not only on click',
  );
  assert.deepEqual(
    injectedIds(),
    ['fake-vendor-a', 'fake-vendor-b'],
    'every configured vendor must be injected on restore',
  );
  assert.deepEqual(
    dom.gtagCalls().filter((c) => c[1] === 'cookie_consent_accept'),
    [],
    'restore must NOT fire the accept event — it measures the act of choosing',
  );
});

test("★ C2-AC1 mirror: stored 'rejected' + no interaction ⇒ nothing at all", () => {
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_REJECTED);

  const state = runConsentMount(VIVREAL_SITE, FAKE_VENDORS);

  assert.equal(state.showBanner, false);
  assert.equal(state.showWithdraw, true);
  assert.equal(state.vendorsAllowed, false);
  assert.deepEqual(consentUpdates(), [], 'a refusal must never upgrade consent');
  assert.deepEqual(injectedIds(), [], 'a refusal must never inject a vendor');
});

test('★ C2-AC1 mirror: absent choice ⇒ banner opens, nothing injected', () => {
  const state = runConsentMount(VIVREAL_SITE, FAKE_VENDORS);

  assert.equal(state.choice, null);
  assert.equal(state.showBanner, true);
  assert.equal(state.showWithdraw, false);
  assert.deepEqual(consentUpdates(), []);
  assert.deepEqual(injectedIds(), []);
});

test('a junk stored value is NOT consent (strict equality, fail-closed)', () => {
  for (const junk of ['', 'ACCEPTED', 'true', 'yes', '{"consent":true}', 'accepted ']) {
    dom.storage.clear();
    resetConsentApplied();
    dom.storage.set(COOKIE_CONSENT_KEY, junk);

    assert.equal(readStoredConsentChoice(), null, `"${junk}" must not read as a choice`);
    const state = runConsentMount(VIVREAL_SITE, FAKE_VENDORS);
    assert.equal(state.vendorsAllowed, false, `"${junk}" must not grant`);
    assert.deepEqual(injectedIds(), [], `"${junk}" must not inject`);
  }
});

// ── the click path ─────────────────────────────────────────────────────────

test('Accept stores the choice, upgrades consent, injects vendors and measures the act', () => {
  const state = grantConsent(VIVREAL_SITE, FAKE_VENDORS);

  assert.equal(dom.storage.get(COOKIE_CONSENT_KEY), COOKIE_CONSENT_ACCEPTED);
  assert.equal(state.showBanner, false);
  assert.equal(state.showWithdraw, true);
  assert.deepEqual(consentUpdates(), [
    ['consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' }],
  ]);
  assert.deepEqual(injectedIds(), ['fake-vendor-a', 'fake-vendor-b']);
  assert.deepEqual(
    dom.gtagCalls().filter((c) => c[1] === 'cookie_consent_accept'),
    [['event', 'cookie_consent_accept', { event_category: 'Privacy' }]],
    'the click path — and only the click path — measures the act of choosing',
  );
});

test('Accept grants ad_storage and ad_user_data for Google Ads attribution, and states ad_personalization denied', () => {
  // Consent Mode v2: without ad_storage + ad_user_data granted, Google will not
  // persist the gclid across the session, so a visit that began with a paid ad
  // click is reported as Direct and the signup is never attributed to the ad.
  // ad_personalization governs building a personalized/remarketing ad profile —
  // a separate, more sensitive decision. It is stated as denied in the update
  // (marketing-measurement T1) so the update is complete on its own when the
  // init's stored-choice default could not be read (storage blocked).
  grantConsent(VIVREAL_SITE, FAKE_VENDORS);
  const update = consentUpdates().at(-1)?.[2] as Record<string, string> | undefined;
  assert.ok(update, 'an accept emits a consent update');
  assert.equal(update.ad_storage, 'granted', 'ad_storage must be granted so gclid persists');
  assert.equal(update.ad_user_data, 'granted', 'ad_user_data must be granted (v2 requirement)');
  assert.equal(update.analytics_storage, 'granted', 'analytics stays granted');
  assert.equal(update.ad_personalization, 'denied', 'ad_personalization is never granted here');
});

test('Reject stores the refusal and injects nothing', () => {
  const state = denyConsent(VIVREAL_SITE);

  assert.equal(dom.storage.get(COOKIE_CONSENT_KEY), COOKIE_CONSENT_REJECTED);
  assert.equal(state.showBanner, false);
  assert.equal(state.vendorsAllowed, false);
  assert.deepEqual(consentUpdates(), []);
  assert.deepEqual(injectedIds(), []);
  assert.deepEqual(
    dom.gtagCalls().filter((c) => c[1] === 'cookie_consent_reject'),
    [['event', 'cookie_consent_reject', { event_category: 'Privacy' }]],
  );
});

test('click then restore does not double-apply within one page lifetime', () => {
  grantConsent(VIVREAL_SITE, FAKE_VENDORS);
  runConsentMount(VIVREAL_SITE, FAKE_VENDORS); // e.g. React StrictMode's second mount effect

  assert.equal(consentUpdates().length, 1, 'consent must upgrade exactly once');
  assert.deepEqual(injectedIds(), ['fake-vendor-a', 'fake-vendor-b'], 'no duplicate tags');
});

test('injectVendorScript is idempotent on its DOM id', () => {
  injectVendorScript(FAKE_VENDORS[0]);
  injectVendorScript(FAKE_VENDORS[0]);
  assert.deepEqual(injectedIds(), ['fake-vendor-a']);
});

test('an injected vendor carries its snippet body and lands in <head>', () => {
  injectVendorScript(FAKE_VENDORS[0]);
  const [script] = dom.scripts();
  assert.equal(script.tagName, 'SCRIPT');
  assert.equal(script.type, 'text/javascript');
  assert.equal(script.innerHTML, 'window.__fakeVendorA = true;');
  assert.equal(script.parentNode, document.head);
});

// ── GPC ────────────────────────────────────────────────────────────────────

test('GPC suppresses every vendor even with a stored acceptance', () => {
  dom.setGpc(true);
  dom.storage.set(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED);

  const state = runConsentMount(VIVREAL_SITE, FAKE_VENDORS);

  assert.equal(isGpcEnabled(), true);
  assert.equal(state.vendorsAllowed, false, 'GPC is a standing refusal for third parties');
  assert.deepEqual(injectedIds(), [], 'no vendor may run under GPC, restored consent or not');
});

test('GPC suppresses vendors on the click path too', () => {
  dom.setGpc(true);
  grantConsent(VIVREAL_SITE, FAKE_VENDORS);
  assert.deepEqual(injectedIds(), [], 'clicking Accept under GPC still injects nothing');
});

test('GPC does not hide the banner (uniform posture — Open Question 4)', () => {
  dom.setGpc(true);
  assert.equal(resolveConsentState(VIVREAL_SITE).showBanner, true);
});

// ── withdrawal ─────────────────────────────────────────────────────────────

test('★ withdrawal clears the choice, downgrades consent and reloads', () => {
  grantConsent(VIVREAL_SITE, FAKE_VENDORS);
  assert.equal(dom.storage.get(COOKIE_CONSENT_KEY), COOKIE_CONSENT_ACCEPTED);

  let reloaded = 0;
  const state = withdrawConsent(VIVREAL_SITE, () => {
    reloaded += 1;
  });

  assert.equal(dom.storage.has(COOKIE_CONSENT_KEY), false, 'the stored choice is cleared');
  assert.equal(reloaded, 1, 'the page reloads so the withdrawal takes effect now');
  assert.equal(state.showBanner, true, 'the banner returns');
  assert.equal(state.showWithdraw, false);
  assert.deepEqual(
    consentUpdates().at(-1),
    ['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied' }],
    'GA4 and the ad-measurement signals are all downgraded immediately',
  );
});

test('★ withdrawal: a subsequent mount injects nothing and reopens the banner', () => {
  grantConsent(VIVREAL_SITE, FAKE_VENDORS);
  withdrawConsent(VIVREAL_SITE, () => {});

  // Simulate the post-reload page load: fresh DOM, same (now empty) storage.
  const carriedStorage = new Map(dom.storage);
  dom.restore();
  dom = installDom({ hostname: 'vivreal.io' });
  for (const [k, v] of carriedStorage) dom.storage.set(k, v);
  resetConsentApplied();

  const state = runConsentMount(VIVREAL_SITE, FAKE_VENDORS);

  assert.equal(state.showBanner, true, 'the visitor is asked again');
  assert.deepEqual(injectedIds(), [], 'no vendor is injected after withdrawal');
  assert.deepEqual(consentUpdates(), [], 'consent stays at the denied default');
});

test('withdrawal uses window.location.reload by default', () => {
  grantConsent(VIVREAL_SITE, FAKE_VENDORS);
  assert.equal(dom.reloads(), 0);
  withdrawConsent(VIVREAL_SITE);
  assert.equal(dom.reloads(), 1);
});

// ── storage failures ───────────────────────────────────────────────────────

test('unreadable storage leaves the visitor in the denied default', () => {
  const throwing = {
    getItem() {
      throw new Error('SecurityError: storage is disabled');
    },
    setItem() {
      throw new Error('SecurityError: storage is disabled');
    },
    removeItem() {
      throw new Error('SecurityError: storage is disabled');
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: throwing,
    configurable: true,
    writable: true,
  });

  assert.equal(readStoredConsentChoice(), null);
  const state = runConsentMount(VIVREAL_SITE, FAKE_VENDORS);
  assert.equal(state.showBanner, true, 'we cannot read a prior choice, so we must not assume one');
  assert.deepEqual(injectedIds(), []);

  // A click still applies for THIS page view even though it cannot be stored.
  assert.doesNotThrow(() => grantConsent(VIVREAL_SITE, FAKE_VENDORS));
  assert.deepEqual(injectedIds(), ['fake-vendor-a', 'fake-vendor-b']);
});

// ── marketing-measurement T1: no GA `config` before a granted consent entry ──

/**
 * Make the harness behave like a browser for INLINE scripts: run the body on
 * append, and let a top-level `function gtag` become `window.gtag`, as a
 * classic script's function declaration does. Loader scripts (`src`) are not
 * fetched. Returns the dataLayer entries as plain arrays.
 */
function executeInlineScriptsOnAppend(): () => unknown[][] {
  const win = (globalThis as unknown as { window: { dataLayer: unknown[]; gtag?: unknown } }).window; // the harness window, typed for this emulation
  const head = globalThis.document.head as unknown as { appendChild(el: { src: string; innerHTML: string }): unknown }; // the harness container, typed for this wrap
  const original = head.appendChild.bind(head);
  head.appendChild = (el) => {
    const result = original(el);
    if (!el.src && el.innerHTML) {
      win.gtag = new Function('window', 'document', 'dataLayer', `${el.innerHTML};return gtag;`)(
        win,
        globalThis.document,
        win.dataLayer,
      );
    }
    return result;
  };
  return () => win.dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

test('★ Accept: GA config never runs before a GRANTED consent entry (the gcs=G100 first hit)', () => {
  const layer = executeInlineScriptsOnAppend();
  const ga = resolveConsentGaScripts({ provider: 'google_analytics', trackingId: 'G-TEST1' });
  assert.equal(ga.length, 2, 'control: the GA loader and init resolve');

  grantConsent(VIVREAL_SITE, [], ga);

  const entries = layer();
  const configAt = entries.findIndex((e) => e[0] === 'config');
  const grantedAt = entries.findIndex(
    (e) => e[0] === 'consent' && (e[2] as { analytics_storage?: string } | undefined)?.analytics_storage === 'granted',
  );
  assert.notEqual(configAt, -1, 'control: the init ran and pushed config');
  assert.notEqual(grantedAt, -1, 'a granted consent entry is pushed');
  assert.ok(grantedAt < configAt, 'config must not run while consent is still denied');
});

test('REFUSE: Reject injects no GA and pushes nothing to the dataLayer', () => {
  const layer = executeInlineScriptsOnAppend();
  denyConsent(VIVREAL_SITE);
  assert.deepEqual(injectedIds(), []);
  assert.deepEqual(layer(), []);
});
