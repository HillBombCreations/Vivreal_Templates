/**
 * Unit tests for the GA4 init string (change item C3; design test-plan item 3).
 *
 * Two properties, both fleet-safety properties:
 *
 *  - BYTE IDENTITY without the flag. <SiteAnalytics> ships to every site in the
 *    fleet. The literal below is copied from the shipping component and pinned
 *    here on purpose: if this test needs editing to go green, the change is
 *    reaching customer sites and needs to be a deliberate decision, not a diff
 *    nobody read.
 *  - ORDERING with the flag. `consent default` before `config`. Asserting mere
 *    PRESENCE would pass on a string that does nothing — Consent Mode's whole
 *    mechanism is the sequence.
 *
 * The GA4 ids here are obviously fake. No real measurement id belongs in a
 * fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGaInitScript } from './gaInitScript.ts';
import { installDom } from './__testing__/domHarness.ts';

const FAKE_ID = 'G-FAKE0000TEST';

// The exact string Vivreal_Templates has shipped fleet-wide since SiteAnalytics
// was introduced. Do not regenerate this from the implementation.
const SHIPPING_LITERAL =
  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FAKE0000TEST');";

test('no consentMode ⇒ byte-identical to the string shipping fleet-wide today', () => {
  assert.equal(buildGaInitScript(FAKE_ID), SHIPPING_LITERAL);
});

test('consentMode false / undefined / absent are all the legacy string', () => {
  assert.equal(buildGaInitScript(FAKE_ID, {}), SHIPPING_LITERAL);
  assert.equal(buildGaInitScript(FAKE_ID, { consentMode: false }), SHIPPING_LITERAL);
  assert.equal(buildGaInitScript(FAKE_ID, { consentMode: undefined }), SHIPPING_LITERAL);
});

test('the legacy string emits NO consent default at all', () => {
  // The fleet's existing sites must keep reporting exactly as before; a stray
  // default-denied would silently zero a customer's analytics.
  assert.equal(buildGaInitScript(FAKE_ID).includes('consent'), false);
  assert.equal(buildGaInitScript(FAKE_ID).includes('vr_internal'), false);
});

test('★ consentMode ⇒ consent default is emitted BEFORE config (ordering, not presence)', () => {
  const script = buildGaInitScript(FAKE_ID, { consentMode: true });

  const defaultAt = script.indexOf("gtag('consent','default'");
  const configAt = script.indexOf("gtag('config'");

  assert.notEqual(defaultAt, -1, 'a consent default must be emitted');
  assert.notEqual(configAt, -1, 'config must still be emitted');
  assert.ok(
    defaultAt < configAt,
    'a consent default that lands AFTER config does nothing — the ordering IS the gate',
  );
});

test('consentMode denies both ad_storage and analytics_storage by default', () => {
  const script = buildGaInitScript(FAKE_ID, { consentMode: true });
  assert.ok(
    script.includes("gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied'});"),
    'both storage types start denied',
  );
});

test('consentMode reads the vr_internal staff-traffic cookie into traffic_type', () => {
  const script = buildGaInitScript(FAKE_ID, { consentMode: true });
  assert.ok(script.includes('vr_internal='), 'the staff cookie is read');
  assert.ok(
    script.includes("gtag('config','G-FAKE0000TEST',vrInternal?{traffic_type:'internal'}:{});"),
    'internal traffic is tagged, everyone else gets the empty-config default',
  );
});

test('the vr_internal cookie read cannot take GA4 down with it', () => {
  const script = buildGaInitScript(FAKE_ID, { consentMode: true });
  assert.ok(
    /try\{vrInternal=.*\}catch\(e\)\{vrInternal=false;\}/.test(script),
    'document.cookie throws in partitioned contexts — the read must be guarded',
  );
});

test('the cookie regex survived the template literal intact', () => {
  // `\s` inside a JS template literal is an unrecognised escape and collapses
  // to a bare `s`, silently producing the WRONG regex. This pins the character
  // class that avoids it.
  const script = buildGaInitScript(FAKE_ID, { consentMode: true });
  assert.ok(script.includes('/(^|;[ ]*)vr_internal=/'), 'the emitted regex is intact');
  assert.equal(script.includes('(^|;s*)'), false, 'the escape did not collapse');
});

test('the emitted regex actually matches a vr_internal cookie and only that', () => {
  // Execute the shape the browser will execute, rather than trusting the text.
  const emitted = /\/\(\^\|;\[ \]\*\)vr_internal=\//.test(
    buildGaInitScript(FAKE_ID, { consentMode: true }),
  );
  assert.equal(emitted, true);

  const cookieRe = /(^|;[ ]*)vr_internal=/;
  assert.equal(cookieRe.test('vr_internal=1'), true);
  assert.equal(cookieRe.test('other=x; vr_internal=1'), true);
  assert.equal(cookieRe.test('other=x;vr_internal=1'), true);
  assert.equal(cookieRe.test('not_vr_internal=1'), false);
  assert.equal(cookieRe.test('other=x'), false);
});

test('the id is interpolated into both branches, unmodified', () => {
  for (const id of ['G-FAKE0000TEST', 'G-AAAAAAAAAA']) {
    assert.ok(buildGaInitScript(id).includes(`gtag('config','${id}');`));
    assert.ok(buildGaInitScript(id, { consentMode: true }).includes(`gtag('config','${id}',`));
  }
});

// ── T1: the consent default from the stored choice (marketing-measurement) ──
//
// On Vivreal's own site the init is injected only AFTER an accept, but it
// pushed a DENIED default and then `config` synchronously, before the
// controller's `consent update` could run. `config` fires the automatic
// page_view, so every first hit went out denied (gcs=G100, throwaway cid).
// `consentFromStoredChoice` sets the default from the stored choice instead.

// The exact consentMode string shipping today (origin/stable 308b177). A
// customer site that opts into consent mode emits this through <SiteAnalytics>;
// it must not change. Do not regenerate this from the implementation.
const CONSENT_MODE_LITERAL =
  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied'});var vrInternal=false;try{vrInternal=/(^|;[ ]*)vr_internal=/.test(document.cookie);}catch(e){vrInternal=false;}gtag('config','G-FAKE0000TEST',vrInternal?{traffic_type:'internal'}:{});";

test('byte identity: no analytics option and the customer consentMode option are unchanged', () => {
  assert.equal(buildGaInitScript(FAKE_ID), SHIPPING_LITERAL);
  assert.equal(buildGaInitScript(FAKE_ID, { consentMode: true }), CONSENT_MODE_LITERAL);
  assert.equal(
    buildGaInitScript(FAKE_ID, { consentMode: true, consentFromStoredChoice: false }),
    CONSENT_MODE_LITERAL,
  );
});

test('consentFromStoredChoice without consentMode cannot change the legacy fleet string', () => {
  assert.equal(buildGaInitScript(FAKE_ID, { consentFromStoredChoice: true }), SHIPPING_LITERAL);
});

/**
 * Execute the emitted init the way a browser runs an inline classic script,
 * against the dom harness, and return the dataLayer entries as plain arrays.
 * `dataLayer` is passed in because a bare `dataLayer` in a browser script is
 * `window.dataLayer`; the harness window is not `globalThis`.
 */
function runInit(script: string): unknown[][] {
  const win = (globalThis as unknown as { window: { dataLayer: unknown[] } }).window; // the harness window, typed for this read
  new Function('window', 'document', 'dataLayer', script)(win, globalThis.document, win.dataLayer);
  return win.dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

function storedChoiceInit(): string {
  return buildGaInitScript(FAKE_ID, { consentMode: true, consentFromStoredChoice: true });
}

const ALL_GRANTED = {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'denied',
};
const ALL_DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

function assertDefaultBeforeConfig(layer: unknown[][], expected: Record<string, string>): void {
  assert.equal(layer[0]?.[0], 'js', 'js is first');
  const consentAt = layer.findIndex((e) => e[0] === 'consent');
  const configAt = layer.findIndex((e) => e[0] === 'config');
  assert.notEqual(consentAt, -1, 'a consent default is pushed');
  assert.notEqual(configAt, -1, 'config is pushed');
  assert.ok(consentAt < configAt, 'the consent default lands before config');
  assert.equal(layer[consentAt]?.[1], 'default');
  assert.deepEqual(layer[consentAt]?.[2], expected);
}

test('ALLOW: stored accept in localStorage gives a granted default before config', () => {
  const dom = installDom();
  try {
    dom.storage.set('cookie_consent_v2', 'accepted');
    assertDefaultBeforeConfig(runInit(storedChoiceInit()), ALL_GRANTED);
  } finally {
    dom.restore();
  }
});

test('ALLOW: only the vr_consent=accepted cookie (localStorage throws) gives a granted default', () => {
  const dom = installDom();
  try {
    const win = (globalThis as unknown as { window: { localStorage: unknown } }).window; // the harness window, typed for this override
    win.localStorage = {
      getItem() {
        throw new Error('SecurityError: storage blocked');
      },
    };
    globalThis.document.cookie = 'other=x';
    globalThis.document.cookie = 'vr_consent=accepted';
    assertDefaultBeforeConfig(runInit(storedChoiceInit()), ALL_GRANTED);
  } finally {
    dom.restore();
  }
});

test('REFUSE: no stored choice gives all four denied, still before config', () => {
  const dom = installDom();
  try {
    assertDefaultBeforeConfig(runInit(storedChoiceInit()), ALL_DENIED);
  } finally {
    dom.restore();
  }
});

test("REFUSE: a stored 'rejected' or any other string is denied", () => {
  for (const stored of ['rejected', 'Accepted', 'accepted ', '', 'true']) {
    const dom = installDom();
    try {
      dom.storage.set('cookie_consent_v2', stored);
      assertDefaultBeforeConfig(runInit(storedChoiceInit()), ALL_DENIED);
    } finally {
      dom.restore();
    }
  }
});

test('REFUSE: a cookie that only resembles the accept mirror is denied', () => {
  for (const cookie of ['vr_consent=accepted_x', 'not_vr_consent=accepted', 'vr_consent=rejected']) {
    const dom = installDom();
    try {
      globalThis.document.cookie = cookie;
      assertDefaultBeforeConfig(runInit(storedChoiceInit()), ALL_DENIED);
    } finally {
      dom.restore();
    }
  }
});

test('the stored-choice init keeps the vr_internal staff tag on config', () => {
  const dom = installDom();
  try {
    dom.storage.set('cookie_consent_v2', 'accepted');
    globalThis.document.cookie = 'vr_internal=1';
    const layer = runInit(storedChoiceInit());
    const config = layer.find((e) => e[0] === 'config');
    assert.deepEqual(config, ['config', FAKE_ID, { traffic_type: 'internal' }]);
  } finally {
    dom.restore();
  }
});

test('gaInitScript.ts imports nothing but consentKeys.ts (it is also loaded by a server component)', () => {
  const source = readFileSync(new URL('./gaInitScript.ts', import.meta.url), 'utf8');
  const specifiers = Array.from(source.matchAll(/^import[^;]*from\s+'([^']+)';/gm), (m) => m[1]);
  assert.deepEqual(specifiers, ['./consentKeys.ts']);
});

// ── Global Privacy Control (owner approved 2026-10-26, review of PR #218) ──
//
// GPC opts the visitor out of sharing, and an Accept click is not a sharing
// opt-in. Under GPC the ad signals stay denied; analytics is still granted on
// accept, as the privacy page describes.

const GPC_ACCEPTED = {
  analytics_storage: 'granted',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

test('REFUSE: GPC plus a stored accept denies the three ad signals, analytics granted, before config', () => {
  const dom = installDom();
  try {
    dom.setGpc(true);
    dom.storage.set('cookie_consent_v2', 'accepted');
    assertDefaultBeforeConfig(runInit(storedChoiceInit()), GPC_ACCEPTED);
  } finally {
    dom.restore();
  }
});

test('REFUSE: GPC plus only the vr_consent cookie also denies the ad signals', () => {
  const dom = installDom();
  try {
    dom.setGpc(true);
    globalThis.document.cookie = 'vr_consent=accepted';
    assertDefaultBeforeConfig(runInit(storedChoiceInit()), GPC_ACCEPTED);
  } finally {
    dom.restore();
  }
});

test('ALLOW: GPC false or absent plus a stored accept keeps the plan default (ad_storage, ad_user_data granted)', () => {
  for (const gpc of [false, undefined]) {
    const dom = installDom();
    try {
      dom.setGpc(gpc);
      dom.storage.set('cookie_consent_v2', 'accepted');
      assertDefaultBeforeConfig(runInit(storedChoiceInit()), ALL_GRANTED);
    } finally {
      dom.restore();
    }
  }
});

test('REFUSE: GPC with no stored choice stays all denied', () => {
  const dom = installDom();
  try {
    dom.setGpc(true);
    assertDefaultBeforeConfig(runInit(storedChoiceInit()), ALL_DENIED);
  } finally {
    dom.restore();
  }
});
