import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`,
// same convention as llmsTxtProxy.test.ts.
import { llmsTxtRedirectTarget, LLMS_TXT_REDIRECT_STATUS } from './llmsTxtRedirect.ts';

/**
 * review.md TQ-1 — before this file, `.well-known/llms.txt`'s redirect had
 * ZERO behavioural coverage: `route.test.ts` only regex-matched the source
 * text of `route.ts`, which a route that matched every pattern but returned
 * the wrong status or the wrong target would still pass. `route.ts` itself
 * imports `next/server`, which `node --test` cannot load in this repo (see
 * `llmsTxtProxy.test.ts`'s header for the same, already-documented
 * tradeoff) — `llmsTxtRedirectTarget`/`LLMS_TXT_REDIRECT_STATUS` are the
 * framework-free extraction that makes the redirect's REAL behaviour
 * testable anyway. These assertions exercise the genuine production
 * function and fail on a wrong target, a dropped query string, or a
 * changed status code.
 */

test('redirect target is exactly /llms.txt at the request\'s own origin, not a hardcoded host', () => {
  const target = llmsTxtRedirectTarget('https://acme-comedy.com/.well-known/llms.txt');
  assert.equal(target.toString(), 'https://acme-comedy.com/llms.txt');
});

test('preserves a non-default port (local dev)', () => {
  const target = llmsTxtRedirectTarget('http://localhost:3000/.well-known/llms.txt');
  assert.equal(target.toString(), 'http://localhost:3000/llms.txt');
});

test('drops any query string on the request URL — the target is always exactly /llms.txt', () => {
  const target = llmsTxtRedirectTarget('https://acme-comedy.com/.well-known/llms.txt?utm_source=test');
  assert.equal(target.pathname, '/llms.txt');
  assert.equal(target.search, '');
});

test('a different tenant site redirects to ITS OWN origin, never a fixed one', () => {
  const target = llmsTxtRedirectTarget('https://thecomedycollective.com/.well-known/llms.txt');
  assert.equal(target.origin, 'https://thecomedycollective.com');
});

test('redirect status is the literal 301 (permanent), not 302/307/308', () => {
  assert.equal(LLMS_TXT_REDIRECT_STATUS, 301);
});
