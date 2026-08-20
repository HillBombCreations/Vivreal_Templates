/**
 * Unit tests for the named-vendor registry (C9; design test-plan item 7).
 *
 * The registry is the ONLY line of defence on this path — Templates sites carry
 * no document-level CSP — so every rejection route is asserted individually
 * rather than in aggregate. "Fails closed somewhere" is not a property anyone
 * can reason about; "fails closed on each of these eleven inputs" is.
 *
 * NO REAL VENDOR ID APPEARS IN THIS FILE. The ids below are obviously fake and
 * chosen to match the shape rules, nothing more.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVendorScript, resolveVendorScripts } from './vendorTags.ts';

// Shape-valid, obviously fake.
const FAKE_RB2B_ID = 'FAKE00000000';
const FAKE_CLARITY_ID = 'fakeclarity0';

const APEX = 'vivreal.io';
const CUSTOMER = 'acme.com';

// ── the happy paths ────────────────────────────────────────────────────────

test('rb2b resolves on the vivreal.io apex', () => {
  const script = resolveVendorScript({ provider: 'rb2b', id: FAKE_RB2B_ID }, APEX);
  assert.notEqual(script, null);
  assert.equal(script!.domId, 'vr-vendor-rb2b');
  assert.ok(script!.innerHTML.includes(`reb2b.load("${FAKE_RB2B_ID}")`));
});

test('★ rb2b feeds the validated id into BOTH positions, never a hard-coded one', () => {
  // The live snippet interpolates the key into reb2b.load() but hard-codes the
  // same key into the script URL path. Ported blindly, the two would silently
  // disagree the moment the id changed.
  const script = resolveVendorScript({ provider: 'rb2b', id: FAKE_RB2B_ID }, APEX)!;
  assert.ok(
    script.innerHTML.includes('"https://s3-us-west-2.amazonaws.com/b2bjsstore/b/"+key+"/"+key+".js.gz"'),
    'the URL path is built from the same key, not a literal',
  );
  // Nothing that looks like a second, different id is present.
  const literalIds = script.innerHTML.match(/[A-Z0-9]{8,24}/g) ?? [];
  for (const found of literalIds) {
    assert.equal(found, FAKE_RB2B_ID, `unexpected literal id in the snippet: ${found}`);
  }
});

test('clarity resolves on the apex and on any customer host that configures it', () => {
  for (const host of [APEX, CUSTOMER, 'shop.acme.co.uk']) {
    const script = resolveVendorScript({ provider: 'clarity', id: FAKE_CLARITY_ID }, host);
    assert.notEqual(script, null, `clarity is allowed on ${host}`);
    assert.equal(script!.domId, 'vr-vendor-clarity');
  }
});

test('clarity builds its script URL from the one validated id', () => {
  const script = resolveVendorScript({ provider: 'clarity', id: FAKE_CLARITY_ID }, APEX)!;
  assert.ok(script.innerHTML.includes('"https://www.clarity.ms/tag/"+i+"?ref=bwt"'));
  assert.ok(script.innerHTML.includes(`"clarity","script","${FAKE_CLARITY_ID}"`));
});

// ── ★ fail-closed: the id ──────────────────────────────────────────────────

test('★ a non-matching rb2b id renders NOTHING', () => {
  for (const id of [
    'not a key!',
    'lowercase0000', // rb2b is upper-case + digits only
    'SHORT',
    'A'.repeat(25), // over the 24 ceiling
    'FAKE-0000-0000', // hyphens are not in the charset
    "FAKE');alert(1)//",
    '',
    ' FAKE00000000',
    'FAKE00000000 ',
  ]) {
    assert.equal(
      resolveVendorScript({ provider: 'rb2b', id }, APEX),
      null,
      `rb2b id ${JSON.stringify(id)} must render nothing`,
    );
  }
});

test('★ a trailing newline does not slip past the anchor', () => {
  // JavaScript's `$` also matches BEFORE a trailing newline, so a naive
  // /^[A-Z0-9]{8,24}$/ accepts "FAKE00000000\n".
  assert.equal(resolveVendorScript({ provider: 'rb2b', id: 'FAKE00000000\n' }, APEX), null);
  assert.equal(
    resolveVendorScript({ provider: 'clarity', id: 'fakeclarity0\n' }, APEX),
    null,
  );
});

test('★ a non-matching clarity id renders NOTHING', () => {
  for (const id of ['UPPERCASE000', 'abc', 'a'.repeat(25), 'fake-clarity', '']) {
    assert.equal(
      resolveVendorScript({ provider: 'clarity', id }, APEX),
      null,
      `clarity id ${JSON.stringify(id)} must render nothing`,
    );
  }
});

// ── ★ fail-closed: the provider ────────────────────────────────────────────

test('★ an unknown provider renders NOTHING', () => {
  for (const provider of [
    'unknown',
    'hotjar',
    'gtm',
    'RB2B', // the enum is case-sensitive
    'Clarity',
    '',
    'constructor',
    '__proto__',
  ]) {
    assert.equal(
      resolveVendorScript({ provider, id: FAKE_RB2B_ID }, APEX),
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
    { provider: 'rb2b' }, // no id
    { id: FAKE_RB2B_ID }, // no provider
    { provider: 'rb2b', id: 12345678 },
    { provider: 'rb2b', id: null },
    { provider: null, id: FAKE_RB2B_ID },
    'rb2b',
    42,
    [],
  ];
  for (const entry of bad) {
    assert.equal(
      resolveVendorScript(entry as never, APEX),
      null,
      `entry ${JSON.stringify(entry)} must render nothing`,
    );
  }
});

// ── ★ fail-closed: the host allowlist ──────────────────────────────────────

test('★ rb2b renders NOTHING on a customer host, even with a perfectly valid id', () => {
  // Person-level de-anonymisation must not be enablable on a customer site.
  // This is why the allowlist is CODE and not config: a site doc that somehow
  // carried this entry still cannot fire the tag.
  for (const host of [CUSTOMER, 'www.acme.com', 'shop.acme.co.uk', 'vivreal.io.evil.com', null]) {
    assert.equal(
      resolveVendorScript({ provider: 'rb2b', id: FAKE_RB2B_ID }, host),
      null,
      `rb2b must never resolve on ${host}`,
    );
  }
});

test('rb2b resolves on apex subdomains (staging/preview)', () => {
  for (const host of ['preview.vivreal.io', 'staging.vivreal.io']) {
    assert.notEqual(resolveVendorScript({ provider: 'rb2b', id: FAKE_RB2B_ID }, host), null);
  }
});

// ── the array resolver ─────────────────────────────────────────────────────

test('resolves a mixed array, dropping only the invalid entries', () => {
  const scripts = resolveVendorScripts(
    [
      { provider: 'rb2b', id: FAKE_RB2B_ID },
      { provider: 'unknown', id: 'whatever' },
      { provider: 'clarity', id: FAKE_CLARITY_ID },
      { provider: 'clarity', id: 'BAD' },
    ],
    APEX,
  );
  assert.deepEqual(
    scripts.map((s) => s.domId),
    ['vr-vendor-rb2b', 'vr-vendor-clarity'],
  );
});

test('★ on a customer host only clarity survives the same array', () => {
  const scripts = resolveVendorScripts(
    [
      { provider: 'rb2b', id: FAKE_RB2B_ID },
      { provider: 'clarity', id: FAKE_CLARITY_ID },
    ],
    CUSTOMER,
  );
  assert.deepEqual(
    scripts.map((s) => s.domId),
    ['vr-vendor-clarity'],
  );
});

test('absent / empty / non-array config resolves to nothing (the fleet default)', () => {
  assert.deepEqual(resolveVendorScripts(undefined, APEX), []);
  assert.deepEqual(resolveVendorScripts(null, APEX), []);
  assert.deepEqual(resolveVendorScripts([], APEX), []);
  assert.deepEqual(resolveVendorScripts({} as never, APEX), []);
  assert.deepEqual(resolveVendorScripts('rb2b' as never, APEX), []);
});

test('a duplicated provider collapses to the first valid entry', () => {
  const scripts = resolveVendorScripts(
    [
      { provider: 'clarity', id: FAKE_CLARITY_ID },
      { provider: 'clarity', id: 'secondproj0' },
    ],
    APEX,
  );
  assert.equal(scripts.length, 1);
  assert.ok(scripts[0].innerHTML.includes(FAKE_CLARITY_ID));
});

// ── the snippets are inert data until the consent controller injects them ──

test('neither snippet carries a config-supplied URL or script body', () => {
  // The whole point of the enum: `id` is the ONLY value crossing the config
  // boundary. If a future edit lets a URL through, this goes red.
  const rb2b = resolveVendorScript({ provider: 'rb2b', id: FAKE_RB2B_ID }, APEX)!;
  const clarity = resolveVendorScript({ provider: 'clarity', id: FAKE_CLARITY_ID }, APEX)!;
  const hosts = [
    ...(rb2b.innerHTML.match(/https:\/\/[a-z0-9.-]+/g) ?? []),
    ...(clarity.innerHTML.match(/https:\/\/[a-z0-9.-]+/g) ?? []),
  ];
  assert.deepEqual(hosts, [
    'https://s3-us-west-2.amazonaws.com',
    'https://www.clarity.ms',
  ]);
});
