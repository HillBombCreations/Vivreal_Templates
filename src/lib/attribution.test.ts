/**
 * Unit tests for the canonical `vr_attr` attribution snippet (v2 contract) as
 * ported into Vivreal_Templates, PLUS the Templates-only apex host gate.
 *
 * Provenance: every case in the first four suites is ported 1:1 from
 * `Vivreal_Portal_Mobile/tests/unit/lib/attribution.test.ts` (18 cases). That
 * suite runs under vitest + jsdom, which Templates does not carry — the repo's
 * runner is `node --experimental-strip-types --test`. The assertions are
 * therefore re-expressed on `node:assert/strict` against the DOM harness in
 * `__testing__/domHarness.ts`; the CASES and the CONTRACT they pin are
 * unchanged. Proving the port carried the BEHAVIOUR (not just the shape) is the
 * whole point of copying them.
 *
 * The fifth suite is new and Templates-specific: the fleet-leak gate.
 *
 * Design: docs/projects/vivreal-io-relaunch/DESIGN-G12-G14-INSTRUMENTATION.md
 * (C1; test plan items 1, 2, 4).
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type DomHarness } from './__testing__/domHarness.ts';
import { captureAttribution, getAttribution } from './attribution.ts';
import { runAttributionCapture } from './attributionCapture.ts';

const COOKIE_NAME = 'vr_attr';

let dom: DomHarness;

beforeEach(() => {
  dom = installDom({ hostname: 'vivreal.io', protocol: 'https:' });
});

afterEach(() => {
  dom.restore();
});

// ── captureAttribution — cookie write/read (ported) ─────────────────────────

test('writes the v2 cookie on first touch and getAttribution reads it back', () => {
  dom.setUrl('/lp/founders?utm_source=linkedin&utm_medium=cpc&utm_campaign=spring_founders');
  captureAttribution();

  const attr = getAttribution();
  assert.notEqual(attr, null);
  assert.equal(attr!.v, 2);
  assert.equal(attr!.first.utm_source, 'linkedin');
  assert.equal(attr!.first.utm_medium, 'cpc');
  assert.equal(attr!.first.utm_campaign, 'spring_founders');
  assert.equal(attr!.first.landing_path, '/lp/founders');
  assert.equal(attr!.first.source, 'linkedin');
  assert.equal(typeof attr!.first.first_seen_at, 'number');
  // First touch initialises last = first.
  assert.deepEqual(attr!.last, attr!.first);
});

test('derives a coarse source from an external referrer when no utm present', () => {
  dom.setUrl('/');
  dom.setReferrer('https://www.google.com/search?q=vivreal');
  captureAttribution();

  const attr = getAttribution()!;
  assert.equal(attr.first.source, 'google');
  assert.equal(attr.first.referrer, 'https://www.google.com/search?q=vivreal');
});

test('derives source=direct with no utm and no referrer', () => {
  captureAttribution();
  assert.equal(getAttribution()!.first.source, 'direct');
});

test('returns null from getAttribution when no cookie exists', () => {
  assert.equal(getAttribution(), null);
});

test('returns null for a malformed cookie value', () => {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent('not-json{')}; Path=/`;
  assert.equal(getAttribution(), null);
});

test('returns null for a wrong-version cookie', () => {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify({ v: 1, utm_source: 'legacy' }),
  )}; Path=/`;
  assert.equal(getAttribution(), null);
});

// ── first-touch frozen, last-touch on signal (ported) ───────────────────────

test('never overwrites first on a later tagged visit; overwrites last', () => {
  dom.setUrl('/?utm_source=linkedin&utm_campaign=alpha');
  captureAttribution();

  dom.setUrl('/pricing?utm_source=google&utm_campaign=beta');
  captureAttribution();

  const attr = getAttribution()!;
  assert.equal(attr.first.utm_source, 'linkedin');
  assert.equal(attr.first.utm_campaign, 'alpha');
  assert.equal(attr.last.utm_source, 'google');
  assert.equal(attr.last.utm_campaign, 'beta');
});

test('overwrites last on a gclid-only hit', () => {
  dom.setUrl('/?utm_source=linkedin');
  captureAttribution();

  dom.setUrl('/?gclid=abc123');
  captureAttribution();

  const attr = getAttribution()!;
  assert.equal(attr.first.utm_source, 'linkedin');
  assert.equal(attr.last.gclid, 'abc123');
  assert.equal(attr.last.utm_source, undefined);
});

test('overwrites last on a fbclid-only hit', () => {
  dom.setUrl('/?utm_source=x');
  captureAttribution();

  dom.setUrl('/?fbclid=fb789');
  captureAttribution();

  assert.equal(getAttribution()!.last.fbclid, 'fb789');
});

test('overwrites last on an external-referrer hit with no params', () => {
  dom.setUrl('/?utm_source=linkedin');
  captureAttribution();

  dom.setUrl('/blog/post');
  dom.setReferrer('https://www.reddit.com/r/webdev');
  captureAttribution();

  const attr = getAttribution()!;
  assert.equal(attr.first.utm_source, 'linkedin');
  assert.equal(attr.last.source, 'reddit');
  assert.equal(attr.last.landing_path, '/blog/post');
});

test('internal vivreal.io navigation does NOT clobber last', () => {
  dom.setUrl('/?utm_source=linkedin&utm_campaign=alpha');
  captureAttribution();

  // Plain internal navigation: no utm, no click ids, internal referrer.
  dom.setUrl('/app/register');
  dom.setReferrer('https://vivreal.io/pricing');
  captureAttribution();

  const attr = getAttribution()!;
  assert.equal(attr.last.utm_source, 'linkedin');
  assert.equal(attr.last.utm_campaign, 'alpha');
  assert.equal(attr.last.landing_path, '/');
});

test('signal-less hit on an empty jar still writes a first touch (direct)', () => {
  dom.setUrl('/app/register');
  dom.setReferrer('https://vivreal.io/');
  captureAttribution();

  const attr = getAttribution()!;
  assert.equal(attr.first.source, 'direct');
  assert.equal(attr.first.referrer, undefined);
});

// ── privacy gates (ported) ─────────────────────────────────────────────────

test('skips writing entirely when Global Privacy Control is on', () => {
  dom.setGpc(true);
  dom.setUrl('/?utm_source=linkedin');
  captureAttribution();

  assert.equal(dom.cookie(COOKIE_NAME), null);
  assert.equal(getAttribution(), null);
});

test('skips writing when consentDenied is passed', () => {
  dom.setUrl('/?utm_source=linkedin');
  captureAttribution({ consentDenied: true });

  assert.equal(dom.cookie(COOKIE_NAME), null);
});

test('GPC also blocks last-touch refresh of an existing cookie', () => {
  dom.setUrl('/?utm_source=linkedin');
  captureAttribution();

  dom.setGpc(true);
  dom.setUrl('/?utm_source=google');
  captureAttribution();

  assert.equal(getAttribution()!.last.utm_source, 'linkedin');
});

// ── truncation bounds (ported) ─────────────────────────────────────────────

test('truncates utm fields to 256 chars and long fields to 512', () => {
  const longUtm = 'a'.repeat(300);
  const longClick = 'b'.repeat(600);
  dom.setUrl(`/?utm_source=${longUtm}&gclid=${longClick}`);
  captureAttribution();

  const attr = getAttribution()!;
  assert.equal(attr.first.utm_source!.length, 256);
  assert.equal(attr.first.gclid!.length, 512);
});

test('truncates the derived source to 64 chars', () => {
  dom.setUrl(`/?utm_source=${'s'.repeat(100)}`);
  captureAttribution();
  assert.equal(getAttribution()!.first.source!.length, 64);
});

test('truncates referrer to 512 chars', () => {
  dom.setReferrer(`https://www.example.com/${'p'.repeat(600)}`);
  captureAttribution();
  assert.equal(getAttribution()!.first.referrer!.length, 512);
});

// ── NEW: the fleet-leak gate (Templates only) ──────────────────────────────
//
// The highest-consequence failure in this design is a `vr_attr` cookie written
// on a CUSTOMER's domain by the fleet app. `runAttributionCapture` is the only
// entry point <AttributionCapture> calls; these cases assert it in BOTH
// directions, including the suffix-confusion host.

const OFF_APEX_HOSTS = [
  'acme.com',
  'www.acme.com',
  'shop.acme.co.uk',
  'vivreal.io.evil.com', // suffix confusion — must NOT match
  'notvivreal.io', // no dot boundary — must NOT match
  'localhost',
];

for (const host of OFF_APEX_HOSTS) {
  test(`runAttributionCapture writes NOTHING on ${host}`, () => {
    dom.setHostname(host);
    dom.setUrl('/?utm_source=linkedin&utm_campaign=alpha');
    runAttributionCapture();

    assert.equal(
      dom.cookie(COOKIE_NAME),
      null,
      `${host} must never receive a vr_attr cookie from the fleet app`,
    );
    assert.equal(document.cookie, '', `${host} document.cookie must be untouched`);
  });
}

const APEX_HOSTS = ['vivreal.io', 'preview.vivreal.io', 'VIVREAL.IO', 'staging.vivreal.io'];

for (const host of APEX_HOSTS) {
  test(`runAttributionCapture writes on ${host}`, () => {
    dom.setHostname(host);
    dom.setUrl('/?utm_source=linkedin&utm_campaign=alpha');
    runAttributionCapture();

    const attr = getAttribution();
    assert.notEqual(attr, null, `${host} is the apex and must capture`);
    assert.equal(attr!.first.utm_campaign, 'alpha');
  });
}

test('runAttributionCapture honours consentDenied on the apex', () => {
  dom.setUrl('/?utm_source=linkedin');
  runAttributionCapture({ consentDenied: true });
  assert.equal(dom.cookie(COOKIE_NAME), null);
});

test('runAttributionCapture honours GPC on the apex', () => {
  dom.setGpc(true);
  dom.setUrl('/?utm_source=linkedin');
  runAttributionCapture();
  assert.equal(dom.cookie(COOKIE_NAME), null);
});

test('undecided consent still writes (Open Question 5 — first touch is not deferrable)', () => {
  // Pins today's deliberate semantic so a future change to it is a CONSCIOUS
  // one: no stored banner choice at all, and the cookie is still written.
  assert.equal(localStorage.getItem('cookie_consent_v1'), null);
  dom.setUrl('/?utm_source=linkedin&utm_campaign=undecided');
  runAttributionCapture();
  assert.equal(getAttribution()!.first.utm_campaign, 'undecided');
});
