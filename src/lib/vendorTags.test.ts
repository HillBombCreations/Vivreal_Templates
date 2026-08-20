/**
 * Unit tests for the named-vendor registry (C9; design test-plan item 7).
 *
 * The registry is the ONLY line of defence on this path — Templates sites carry
 * no document-level CSP — so every rejection route is asserted individually
 * rather than in aggregate. "Fails closed somewhere" is not a property anyone
 * can reason about; "fails closed on each of these inputs" is.
 *
 * RB2B was dropped by owner decision on 2026-08-20, so the registry carries one
 * provider. Its SHAPE is unchanged and deliberately still tested as a registry
 * rather than as a single hard-coded tag: an unknown provider must fail closed,
 * and a second vendor must be one entry away.
 *
 * NO REAL VENDOR ID APPEARS IN THIS FILE. The ids below are obviously fake and
 * chosen to match the shape rules, nothing more.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVendorScript, resolveVendorScripts } from './vendorTags.ts';

// Shape-valid, obviously fake.
const FAKE_CLARITY_ID = 'fakeclarity0';

// ── the happy path ─────────────────────────────────────────────────────────

test('clarity resolves to an injectable snippet', () => {
  const script = resolveVendorScript({ provider: 'clarity', id: FAKE_CLARITY_ID });
  assert.notEqual(script, null);
  assert.equal(script!.domId, 'vr-vendor-clarity');
  assert.ok(script!.innerHTML.includes(`"clarity","script","${FAKE_CLARITY_ID}"`));
});

test('★ clarity builds its script URL from the one validated id', () => {
  // The live snippet hard-codes the project id into the URL as well as passing
  // it as `i`. Ported blindly, the two would silently disagree the moment the
  // id changed.
  const script = resolveVendorScript({ provider: 'clarity', id: FAKE_CLARITY_ID })!;
  assert.ok(
    script.innerHTML.includes('"https://www.clarity.ms/tag/"+i+"?ref=bwt"'),
    'the URL is built from the same id, not a literal',
  );
  const literalIds = script.innerHTML.match(/[a-z0-9]{6,24}/g) ?? [];
  assert.equal(
    literalIds.filter((found) => found === FAKE_CLARITY_ID).length,
    1,
    'the id appears exactly once, as the snippet argument',
  );
});

test('resolution does not depend on the host — the apex gate lives in the controller', () => {
  // Clarity is fleet-safe: a customer who configures it is entitled to run it
  // on their own site. What stops a resolved snippet reaching a customer page
  // is SiteConsent's apex gate, proven in instrumentation.integration.test.ts.
  const a = resolveVendorScript({ provider: 'clarity', id: FAKE_CLARITY_ID });
  const b = resolveVendorScript({ provider: 'clarity', id: FAKE_CLARITY_ID });
  assert.deepEqual(a, b);
});

// ── ★ fail-closed: the id ──────────────────────────────────────────────────

test('★ a non-matching clarity id renders NOTHING', () => {
  for (const id of [
    'FAKECLARITY0', // clarity ids are lower-case + digits only
    'abc', // under the 6 floor
    'a'.repeat(25), // over the 24 ceiling
    'fake-clarity', // hyphens are not in the charset
    'fake clarity',
    'fake);alert(1)//',
    '',
    ' fakeclarity0',
    'fakeclarity0 ',
  ]) {
    assert.equal(
      resolveVendorScript({ provider: 'clarity', id }),
      null,
      `clarity id ${JSON.stringify(id)} must render nothing`,
    );
  }
});

test('★ a trailing newline does not slip past the anchor', () => {
  // JavaScript's `$` also matches BEFORE a trailing newline, so a naive
  // /^[a-z0-9]{6,24}$/ accepts "fakeclarity0\n".
  assert.equal(resolveVendorScript({ provider: 'clarity', id: 'fakeclarity0\n' }), null);
  assert.equal(resolveVendorScript({ provider: 'clarity', id: 'fakeclarity0\r\n' }), null);
});

// ── ★ fail-closed: the provider ────────────────────────────────────────────

test('★ an unknown provider renders NOTHING', () => {
  for (const provider of [
    'unknown',
    'hotjar',
    'gtm',
    'rb2b', // dropped 2026-08-20 — must now fail closed like any other unknown
    'Clarity', // the enum is case-sensitive
    'CLARITY',
    '',
    'constructor', // prototype-chain probes must not resolve
    '__proto__',
    'toString',
  ]) {
    assert.equal(
      resolveVendorScript({ provider, id: FAKE_CLARITY_ID }),
      null,
      `provider ${JSON.stringify(provider)} must render nothing`,
    );
  }
});

test('★ a malformed entry renders NOTHING', () => {
  const bad: unknown[] = [
    null,
    undefined,
    {},
    { provider: 'clarity' }, // no id
    { id: FAKE_CLARITY_ID }, // no provider
    { provider: 'clarity', id: 12345678 },
    { provider: 'clarity', id: null },
    { provider: null, id: FAKE_CLARITY_ID },
    'clarity',
    42,
    [],
  ];
  for (const entry of bad) {
    assert.equal(
      resolveVendorScript(entry as never),
      null,
      `entry ${JSON.stringify(entry)} must render nothing`,
    );
  }
});

// ── the array resolver ─────────────────────────────────────────────────────

test('resolves a mixed array, dropping only the invalid entries', () => {
  const scripts = resolveVendorScripts([
    { provider: 'unknown', id: 'whatever' },
    { provider: 'clarity', id: FAKE_CLARITY_ID },
    { provider: 'clarity', id: 'BAD' },
    { provider: 'rb2b', id: 'FAKE00000000' },
  ]);
  assert.deepEqual(
    scripts.map((s) => s.domId),
    ['vr-vendor-clarity'],
  );
});

test('absent / empty / non-array config resolves to nothing (the fleet default)', () => {
  assert.deepEqual(resolveVendorScripts(undefined), []);
  assert.deepEqual(resolveVendorScripts(null), []);
  assert.deepEqual(resolveVendorScripts([]), []);
  assert.deepEqual(resolveVendorScripts({} as never), []);
  assert.deepEqual(resolveVendorScripts('clarity' as never), []);
});

test('a duplicated provider collapses to the first valid entry', () => {
  const scripts = resolveVendorScripts([
    { provider: 'clarity', id: FAKE_CLARITY_ID },
    { provider: 'clarity', id: 'secondproj0' },
  ]);
  assert.equal(scripts.length, 1);
  assert.ok(scripts[0].innerHTML.includes(FAKE_CLARITY_ID));
});

// ── the snippet is inert data until the consent controller injects it ──────

test('★ the snippet carries no config-supplied URL or script body', () => {
  // The whole point of the enum: `id` is the ONLY value crossing the config
  // boundary. If a future edit lets a URL through, this goes red.
  const clarity = resolveVendorScript({ provider: 'clarity', id: FAKE_CLARITY_ID })!;
  const hosts = clarity.innerHTML.match(/https:\/\/[a-z0-9.-]+/g) ?? [];
  assert.deepEqual(hosts, ['https://www.clarity.ms']);
});

test('★ no RB2B remnant survives anywhere in the registry output', () => {
  // Owner decision 2026-08-20: RB2B is dropped entirely. A snippet is the one
  // place a stale vendor could still be shipping without anyone noticing.
  const all = resolveVendorScripts([
    { provider: 'clarity', id: FAKE_CLARITY_ID },
    { provider: 'rb2b', id: 'FAKE00000000' },
  ])
    .map((s) => `${s.domId} ${s.innerHTML}`)
    .join(' ');
  for (const needle of ['rb2b', 'reb2b', 'b2bjsstore']) {
    assert.equal(all.toLowerCase().includes(needle), false, `${needle} must be gone`);
  }
});
