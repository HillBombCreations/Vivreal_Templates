import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`,
// same convention as llmsTxtProxy.test.ts.
import {
  llmsTxtRedirectResponseInit,
  LLMS_TXT_REDIRECT_STATUS,
  LLMS_TXT_REDIRECT_LOCATION,
  LLMS_TXT_REDIRECT_CACHE_CONTROL,
} from './llmsTxtRedirect.ts';

/**
 * review.md TQ-1 — before this file, `.well-known/llms.txt`'s redirect had
 * ZERO behavioural coverage: `route.test.ts` only regex-matched the source
 * text of `route.ts`. `route.ts` itself imports `next/server`, which
 * `node --test` cannot load in this repo (see `llmsTxtProxy.test.ts`'s
 * header for the same, already-documented tradeoff) —
 * `llmsTxtRedirectResponseInit` is the framework-free extraction that makes
 * the redirect's REAL behaviour testable anyway.
 *
 * Hotfix 2026-08-29 — the first version resolved the target against
 * `request.url` and every customer site redirected to
 * `https://localhost:3000/llms.txt`, because that is the host Amplify's
 * compute puts on the request. The contract pinned below is the opposite:
 * the `Location` is site-relative and the function takes no request at all,
 * so there is no origin to get wrong.
 */

test('Location is the site-relative /llms.txt, not an absolute URL', () => {
  const { headers } = llmsTxtRedirectResponseInit();
  assert.equal(headers.Location, '/llms.txt');
  assert.equal(LLMS_TXT_REDIRECT_LOCATION, '/llms.txt');
  // The regression, stated as an assertion: no scheme, no host, no port.
  assert.doesNotMatch(headers.Location, /^[a-z]+:\/\//i);
  assert.doesNotMatch(headers.Location, /localhost|:3000/);
});

test('carries no query string — the target is always exactly /llms.txt', () => {
  const { headers } = llmsTxtRedirectResponseInit();
  assert.equal(new URL(headers.Location, 'https://acme-comedy.com').pathname, '/llms.txt');
  assert.equal(new URL(headers.Location, 'https://acme-comedy.com').search, '');
});

test('resolves to each tenant\'s OWN origin when a client applies it, never a fixed one', () => {
  const { headers } = llmsTxtRedirectResponseInit();
  assert.equal(
    new URL(headers.Location, 'https://acme-comedy.com/.well-known/llms.txt').toString(),
    'https://acme-comedy.com/llms.txt',
  );
  assert.equal(
    new URL(headers.Location, 'https://thecomedycollective.com/.well-known/llms.txt').origin,
    'https://thecomedycollective.com',
  );
  // Local dev keeps its port for the same reason: the client resolves it.
  assert.equal(
    new URL(headers.Location, 'http://localhost:3000/.well-known/llms.txt').toString(),
    'http://localhost:3000/llms.txt',
  );
});

test('redirect status is the literal 301 (permanent), not 302/307/308', () => {
  assert.equal(LLMS_TXT_REDIRECT_STATUS, 301);
  assert.equal(llmsTxtRedirectResponseInit().status, 301);
});

test('the 301 is cache-bounded, matching what the old 200 at this path carried', () => {
  const { headers } = llmsTxtRedirectResponseInit();
  assert.equal(headers['Cache-Control'], 'public, max-age=300, s-maxage=300');
  assert.equal(LLMS_TXT_REDIRECT_CACHE_CONTROL, headers['Cache-Control']);
});
