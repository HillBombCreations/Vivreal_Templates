/**
 * Unit tests for the fleet gate (design C1/C2/C9 — "All three want the same
 * runtime gate", test-plan item 2).
 *
 * This predicate is the single thing standing between Vivreal's own
 * instrumentation and ~every customer site in the fleet, so it is tested in
 * both directions and specifically against the suffix-confusion shapes an
 * `includes()` or a bare `endsWith()` would let through.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, type DomHarness } from './__testing__/domHarness.ts';
import { isVivrealApex, currentHostname, onVivrealApex, VIVREAL_APEX } from './vivrealApex.ts';

let dom: DomHarness | null = null;

afterEach(() => {
  dom?.restore();
  dom = null;
});

test('the apex constant is vivreal.io', () => {
  assert.equal(VIVREAL_APEX, 'vivreal.io');
});

test('matches the apex and its subdomains', () => {
  for (const host of [
    'vivreal.io',
    'www.vivreal.io',
    'preview.vivreal.io',
    'staging.vivreal.io',
    'a.b.vivreal.io',
    'VIVREAL.IO',
    'Preview.Vivreal.IO',
    'vivreal.io.', // fully-qualified form with the root dot
    '  vivreal.io  ', // defensive: whitespace
  ]) {
    assert.equal(isVivrealApex(host), true, `${host} must be treated as the apex`);
  }
});

test('rejects every customer-shaped host, including suffix confusion', () => {
  for (const host of [
    'acme.com',
    'www.acme.com',
    'shop.acme.co.uk',
    'vivreal.io.evil.com', // the classic: apex as a LEFT-hand label
    'evil-vivreal.io', // no dot boundary before the apex
    'notvivreal.io',
    'vivreal.io.com',
    'xvivreal.io',
    'vivreal.iox',
    'localhost',
    '127.0.0.1',
    '',
    '   ',
  ]) {
    assert.equal(isVivrealApex(host), false, `${host} must NOT be treated as the apex`);
  }
});

test('non-string / absent input is fail-closed', () => {
  assert.equal(isVivrealApex(undefined), false);
  assert.equal(isVivrealApex(null), false);
  assert.equal(isVivrealApex(undefined as unknown as string), false);
});

test('currentHostname / onVivrealApex are SSR-safe (no window ⇒ not the apex)', () => {
  // No DOM installed in this case — this is the server-render path.
  assert.equal(currentHostname(), null);
  assert.equal(onVivrealApex(), false);
});

test('onVivrealApex reads the live browser hostname', () => {
  dom = installDom({ hostname: 'acme.com' });
  assert.equal(onVivrealApex(), false);
  dom.setHostname('vivreal.io');
  assert.equal(onVivrealApex(), true);
  dom.setHostname('preview.vivreal.io');
  assert.equal(onVivrealApex(), true);
  dom.setHostname('vivreal.io.evil.com');
  assert.equal(onVivrealApex(), false);
});
