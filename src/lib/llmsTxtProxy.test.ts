import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`,
// same convention as redirects.test.ts.
import { fetchLlmsTxt } from './llmsTxtProxy.ts';

/**
 * portal-simplification-pass B2.1 — GET /llms.txt must return populated
 * content, not a 404. `fetchLlmsTxt` is the ONE generator both route.ts
 * files call (llmsTxtProxy.ts's header). It intentionally has no
 * `next/server` import, unlike the route.ts files themselves, which import
 * `next/server` and so cannot be loaded by this runner at all — see
 * leadAttribution.ts / page.test.ts for the same tradeoff already in this
 * repo. Route wiring (edge + force-dynamic + "calls this, doesn't duplicate
 * it") is pinned separately in src/app/llms.txt/route.test.ts.
 *
 * Before B2.2, `./llmsTxtProxy.ts` does not exist — this file fails to even
 * import, which is this suite's expression of "GET /llms.txt 404s today."
 */

const ORIGINAL_ENV = { ...process.env };
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = originalFetch;
});

const SAMPLE_LLMS_TXT = [
  '# The Comedy Collective',
  '',
  '> A stand-up comedy venue.',
  '',
  'Site: https://thecomedycollective.com',
  '',
  '## Pages',
  '',
  '- [Shows](https://thecomedycollective.com/shows)',
  '',
].join('\n');

test('returns the upstream body, status, and content type when the site is configured', async () => {
  process.env.API_KEY = 'test-api-key';
  process.env.SITE_ID = 'test-site-id';
  process.env.NEXT_PUBLIC_CLIENT_API = 'https://client.vivreal.io';

  // Narrower than the full `fetch` overload set — this stub only needs to
  // satisfy the one-argument GET call llmsTxtProxy.ts makes.
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    assert.match(
      String(input),
      /^https:\/\/client\.vivreal\.io\/sites\/test-site-id\/\.well-known\/llms\.txt$/
    );
    return new Response(SAMPLE_LLMS_TXT, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }) as typeof fetch;

  const result = await fetchLlmsTxt();

  assert.equal(result.status, 200);
  assert.ok(result.body.length > 0, 'llms.txt body must be populated, not empty');
  assert.match(result.body, /^# The Comedy Collective/);
  assert.match(result.body, /## Pages/);
  assert.equal(result.headers['Content-Type'], 'text/plain; charset=utf-8');
});

test('falls back to a markdown content type when the upstream omits one', async () => {
  process.env.API_KEY = 'test-api-key';
  process.env.SITE_ID = 'test-site-id';

  // A string body makes the Response constructor auto-populate
  // Content-Type (per the Fetch spec's "extract a body" step), so a
  // genuinely header-less upstream response has to be built from bytes
  // instead — that's the only body type the spec doesn't default.
  globalThis.fetch = (async () =>
    new Response(new TextEncoder().encode(SAMPLE_LLMS_TXT), {
      status: 200,
    })) as typeof fetch;

  const result = await fetchLlmsTxt();

  assert.equal(result.headers['Content-Type'], 'text/markdown; charset=utf-8');
});

test('503s with no upstream call when the site has no API_KEY/SITE_ID configured', async () => {
  delete process.env.API_KEY;
  delete process.env.SITE_ID;

  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error('fetch should not be called');
  }) as typeof fetch;

  const result = await fetchLlmsTxt();

  assert.equal(result.status, 503);
  assert.equal(called, false, 'an unconfigured site must not call the upstream at all');
});

test('502s when the upstream fetch throws', async () => {
  process.env.API_KEY = 'test-api-key';
  process.env.SITE_ID = 'test-site-id';

  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;

  const result = await fetchLlmsTxt();

  assert.equal(result.status, 502);
});
