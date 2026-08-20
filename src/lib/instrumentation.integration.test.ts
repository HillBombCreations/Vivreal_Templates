/**
 * END-TO-END proof of the instrumentation cluster (C1 + C2 + C3 + C5 + C9),
 * walked as a visitor session against the DOM harness, with the REAL vendor
 * registry rather than synthetic snippets.
 *
 * This is the file that answers the two acceptance questions directly:
 *
 *   (a) ON THE APEX — banner renders; decline ⇒ no vendor tags; accept ⇒ tags
 *       mount; reload ⇒ choice restored with no re-prompt and no interaction;
 *       withdraw ⇒ tags gone and the banner returns.
 *   (b) ON A NON-APEX HOST — none of it exists. No banner state, no vendor tag,
 *       no `vr_attr` cookie, no gtag call, nothing written to storage.
 *
 * The GA4 half of the cluster (C3) is a server-rendered string with its own
 * byte-identity suite in gaInitScript.test.ts; here it is present only as the
 * `dataLayer`/`gtag` calls the controller makes against it.
 *
 * Ids are obviously fake. The browser-level equivalent of this walk is GATE 3
 * items 15-17, run on the deployed staging host through CloudFront — this
 * proves the logic, that proves the deployment.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type DomHarness } from './__testing__/domHarness.ts';
import {
  runConsentMount,
  grantConsent,
  denyConsent,
  withdrawConsent,
  resetConsentApplied,
  COOKIE_CONSENT_KEY,
} from './consent.ts';
import { resolveVendorScripts, type AdditionalVendorConfig } from './vendorTags.ts';
import { runAttributionCapture } from './attributionCapture.ts';
import { getAttribution } from './attribution.ts';
import { trackLeadConversion, resetLeadEventForTests } from './analytics.ts';

/**
 * The exact shape C7 will author onto the vivreal.io site doc.
 *
 * One vendor: RB2B was dropped entirely by owner decision on 2026-08-20. The
 * registry SHAPE is unchanged, so a second vendor stays one entry away — and
 * the stale-entry case below proves a dropped provider now fails closed rather
 * than lingering.
 */
const SITE_ANALYTICS_ADDITIONAL: AdditionalVendorConfig[] = [
  { provider: 'clarity', id: 'fakeclarity0' },
];

let dom: DomHarness;

beforeEach(() => {
  dom = installDom({ hostname: 'vivreal.io' });
  resetConsentApplied();
  resetLeadEventForTests();
});

afterEach(() => {
  dom.restore();
});

/** One page load: resolve the registry for this host, then mount the controller. */
function loadPage() {
  const vendors = resolveVendorScripts(SITE_ANALYTICS_ADDITIONAL);
  const state = runConsentMount(vendors);
  runAttributionCapture({ consentDenied: state.choice === 'rejected' });
  return { vendors, state };
}

function vendorIds(): string[] {
  return dom
    .scripts()
    .map((s) => s.id)
    .filter(Boolean)
    .sort();
}

function grantedUpdates(): number {
  return dom
    .gtagCalls()
    .filter(
      (c) =>
        c[0] === 'consent' &&
        c[1] === 'update' &&
        (c[2] as { analytics_storage?: string })?.analytics_storage === 'granted',
    ).length;
}

/**
 * Simulate a reload / new page view: fresh DOM, storage carried across, the
 * per-page-load guards reset. Anything that survives here survived because it
 * was STORED, which is the property the restore path is about.
 */
function reload() {
  const carried = new Map(dom.storage);
  const gpcWas = dom.gtagCalls; // no-op, keeps intent readable
  void gpcWas;
  dom.restore();
  dom = installDom({ hostname: 'vivreal.io' });
  for (const [k, v] of carried) dom.storage.set(k, v);
  resetConsentApplied();
  resetLeadEventForTests();
}

// ══ (a) ON THE APEX ════════════════════════════════════════════════════════

test('(a1) first visit: the banner renders and NOTHING third-party fires yet', () => {
  dom.setUrl('/?utm_source=gate3&utm_medium=cpc&utm_campaign=proof');
  const { vendors, state } = loadPage();

  assert.equal(state.gated, true);
  assert.equal(state.showBanner, true, 'an undecided visitor is asked');
  assert.equal(state.showWithdraw, false);
  assert.equal(vendors.length, 1, 'the configured registry vendor resolves');

  assert.deepEqual(vendorIds(), [], 'no vendor may fire before a decision');
  assert.equal(grantedUpdates(), 0, 'GA4 stays in the denied default');

  // vr_attr IS written pre-decision — deliberate, Open Question 5. The
  // asymmetry `/privacy` must describe: first-party cookie yes, vendors no.
  assert.equal(getAttribution()!.first.utm_campaign, 'proof');
});

test('(a2) DECLINE ⇒ no vendor tags, no consent upgrade, and no re-prompt', () => {
  loadPage();
  const state = denyConsent();

  assert.equal(state.showBanner, false);
  assert.deepEqual(vendorIds(), [], 'a refusal must inject nothing');
  assert.equal(grantedUpdates(), 0);
  assert.equal(dom.storage.get(COOKIE_CONSENT_KEY), 'rejected');

  reload();
  const after = loadPage();
  assert.equal(after.state.showBanner, false, 'the refusal is remembered');
  assert.deepEqual(vendorIds(), [], 'and it still injects nothing on a return visit');
  assert.equal(grantedUpdates(), 0);
});

test('(a3) ACCEPT ⇒ both vendor tags mount and GA4 is upgraded', () => {
  const { vendors } = loadPage();
  grantConsent(vendors);

  assert.deepEqual(vendorIds(), ['vr-vendor-clarity']);
  assert.equal(grantedUpdates(), 1);

  const injected = dom.scripts();
  assert.ok(
    injected.some((s) => s.innerHTML.includes('clarity.ms')),
    'the clarity tag is the real snippet',
  );
  assert.ok(
    injected.some((s) => s.innerHTML.includes('fakeclarity0')),
    'and it carries the configured project id',
  );
});

test('★ (a4) RELOAD after accepting ⇒ choice restored, tags mount, NO re-prompt', () => {
  const { vendors } = loadPage();
  grantConsent(vendors);

  reload();

  // Touch nothing. This is the returning-consenter case — the live app's D3
  // defect, proven absent here.
  const { state } = loadPage();

  assert.equal(state.showBanner, false, 'the visitor is not asked again');
  assert.equal(state.showWithdraw, true, 'but the withdrawal control is offered');
  assert.deepEqual(
    vendorIds(),
    ['vr-vendor-clarity'],
    'the tag mounts with no interaction at all',
  );
  assert.equal(grantedUpdates(), 1, 'GA4 is upgraded on the restore path');
  assert.equal(
    dom.gtagCalls().filter((c) => c[1] === 'cookie_consent_accept').length,
    0,
    'restore does not re-count the act of choosing',
  );
});

test('★ (a5) WITHDRAW ⇒ tags gone on the next load and the banner returns', () => {
  const { vendors } = loadPage();
  grantConsent(vendors);
  assert.deepEqual(vendorIds(), ['vr-vendor-clarity']);

  let reloaded = 0;
  withdrawConsent(() => {
    reloaded += 1;
  });
  assert.equal(reloaded, 1, 'the page reloads so withdrawal takes effect now');
  assert.equal(
    dom.storage.has(COOKIE_CONSENT_KEY),
    false,
    'the stored choice is cleared, not flipped to rejected — the visitor is undecided again',
  );

  reload();
  const { state } = loadPage();

  assert.equal(state.showBanner, true, 'the banner returns');
  assert.deepEqual(vendorIds(), [], 'no vendor is injected after withdrawal');
  assert.equal(grantedUpdates(), 0);
});

test('(a6) GPC ⇒ banner shown, but no vendor and no vr_attr, even after Accept', () => {
  dom.setGpc(true);
  dom.setUrl('/?utm_source=gate3&utm_campaign=proof');
  const { vendors, state } = loadPage();

  assert.equal(state.showBanner, true, 'the posture is uniform — everyone is asked');
  assert.equal(getAttribution(), null, 'GPC blocks the first-party cookie outright');

  grantConsent(vendors);
  assert.deepEqual(vendorIds(), [], 'GPC is a standing refusal for third parties');
});

test('(a7) the conversion event fires only inside a consented session', () => {
  const { vendors } = loadPage();

  trackLeadConversion({ method: 'footer' });
  assert.equal(
    dom.gtagCalls().filter((c) => c[1] === 'generate_lead').length,
    0,
    'undecided ⇒ no conversion event',
  );

  grantConsent(vendors);
  resetLeadEventForTests();
  trackLeadConversion({ method: 'footer' });
  assert.equal(
    dom.gtagCalls().filter((c) => c[1] === 'generate_lead').length,
    1,
    'consented ⇒ exactly one',
  );
});

test('★ (a8) a STALE rb2b entry left in config fails closed — accepted or not', () => {
  // Owner decision 2026-08-20 dropped RB2B. The realistic residual risk is not
  // the code, it is a site doc that still carries the entry. It must behave
  // exactly like any other unknown provider: nothing resolves, nothing injects,
  // and the surviving vendor is unaffected.
  const stale: AdditionalVendorConfig[] = [
    { provider: 'rb2b', id: 'FAKE00000000' },
    { provider: 'clarity', id: 'fakeclarity0' },
  ];
  const vendors = resolveVendorScripts(stale);
  assert.deepEqual(
    vendors.map((v) => v.domId),
    ['vr-vendor-clarity'],
    'the dropped provider does not resolve; the kept one still does',
  );

  grantConsent(vendors);
  assert.deepEqual(vendorIds(), ['vr-vendor-clarity']);
  const everything = dom
    .scripts()
    .map((s) => s.innerHTML)
    .join(' ')
    .toLowerCase();
  for (const needle of ['rb2b', 'reb2b', 'b2bjsstore']) {
    assert.equal(everything.includes(needle), false, `${needle} must never reach the page`);
  }
});

// ══ (b) ON A NON-APEX HOST — none of it exists ═════════════════════════════

const CUSTOMER_HOSTS = ['acme.com', 'www.acme.com', 'shop.acme.co.uk', 'vivreal.io.evil.com'];

for (const host of CUSTOMER_HOSTS) {
  test(`★ (b) ${host}: no banner, no vendor, no cookie, no gtag call, nothing stored`, () => {
    dom.setHostname(host);
    dom.setUrl('/?utm_source=gate3&utm_medium=cpc&utm_campaign=proof');

    const { vendors, state } = loadPage();

    assert.equal(state.gated, false, 'a customer site is not under Vivreal consent');
    assert.equal(state.showBanner, false, 'no banner may render');
    assert.equal(state.showWithdraw, false, 'no withdrawal strip may render');
    assert.deepEqual(vendorIds(), [], 'nothing may be injected into a customer page');
    assert.equal(document.cookie, '', 'no vr_attr cookie may be written');
    assert.equal(getAttribution(), null);
    assert.deepEqual(dom.gtagCalls(), [], 'no consent or conversion signal may be emitted');
    assert.equal(dom.storage.size, 0, 'nothing may be written to customer storage');

    // Even the click paths are inert, in case a future refactor mounts them.
    grantConsent(vendors);
    trackLeadConversion({ method: 'inline' });
    assert.deepEqual(vendorIds(), []);
    assert.deepEqual(dom.gtagCalls(), []);
    assert.equal(dom.storage.size, 0);
  });
}

test('★ (b) a customer site that configures CLARITY still gets nothing injected', () => {
  // The one legitimate off-apex case in the registry: clarity is allowed
  // anywhere. It still cannot be injected, because the consent controller that
  // injects it is apex-gated — which is the honest statement of Phase A's
  // scope: the registry is fleet-capable, the CONSENT SURFACE is not yet (C8).
  dom.setHostname('acme.com');
  const vendors = resolveVendorScripts([{ provider: 'clarity', id: 'fakeclarity0' }]);
  assert.equal(vendors.length, 1, 'clarity resolves for a customer site…');

  dom.storage.set(COOKIE_CONSENT_KEY, 'accepted');
  const state = runConsentMount(vendors);
  assert.equal(state.gated, false);
  assert.deepEqual(vendorIds(), [], '…but nothing injects it, because C2 is apex-only');
});
