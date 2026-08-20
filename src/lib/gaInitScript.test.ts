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
import { buildGaInitScript } from './gaInitScript.ts';

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
