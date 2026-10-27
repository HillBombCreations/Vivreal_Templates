/**
 * The consent key names are shared by two modules that cannot import each
 * other (`consent.ts` is client-only, `gaInitScript.ts` is also server-side).
 * These tests pin that the GA init actually reads the names the controller
 * writes, so renaming one without the other is red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COOKIE_CONSENT_KEY, CONSENT_COOKIE_NAME } from './consentKeys.ts';
import * as consent from './consent.ts';
import { buildGaInitScript } from './gaInitScript.ts';

test('the stored-choice GA init reads the localStorage key and the cookie the controller writes', () => {
  const script = buildGaInitScript('G-FAKE0000TEST', { consentMode: true, consentFromStoredChoice: true });
  assert.ok(
    script.includes(`getItem('${COOKIE_CONSENT_KEY}')`),
    'the init must read the same localStorage key consent.ts writes',
  );
  assert.ok(
    script.includes(`${CONSENT_COOKIE_NAME}=accepted`),
    'the init must read the same cookie consent.ts writes',
  );
});

test('consent.ts re-exports the same two names, so existing importers are unchanged', () => {
  assert.equal(consent.COOKIE_CONSENT_KEY, COOKIE_CONSENT_KEY);
  assert.equal(consent.CONSENT_COOKIE_NAME, CONSENT_COOKIE_NAME);
});
