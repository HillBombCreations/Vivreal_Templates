import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// route.ts imports `next/server`, which the plain-Node test runner cannot load,
// so the behaviour worth pinning lives in src/lib/delivery/quoteRequest.ts and
// is tested by being CALLED there. This file pins the properties that are
// structural to the route module itself, each of which is a decision that would
// otherwise be silently reversible.

const source = fs.readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

test('the upstream path sits under /sites/:siteId, where the rate limiter is', () => {
  // The `/tenant/*` routes carry no limiter. This endpoint is public and
  // unauthenticated, so putting it there would mean inheriting nothing.
  assert.match(source, /\/sites\/\$\{encodeURIComponent\(siteId\)\}\/\$\{UPSTREAM_PATH\}/);
  assert.match(source, /const UPSTREAM_PATH = 'delivery-quote'/);
});

test('the runtime is declared explicitly', () => {
  // Routes here declare it per route and both values are in real use; an
  // undeclared runtime is a decision nobody made.
  assert.match(source, /export const runtime = 'edge'/);
});

test('the body is forwarded from the prepared object, never rebuilt field by field', () => {
  // A rebuilt body drops every field added after this file was written, and
  // `deliveryDays` is the live example.
  assert.match(source, /body: JSON\.stringify\(prepared\.body\)/);
  assert.doesNotMatch(source, /zip: prepared/, 'the proxy must not pick fields out of the body');
});

test('the response is relayed as text, not parsed and re-serialised', () => {
  // The quote carries resolved calendar dates. Round-tripping a body through
  // JSON.parse and back is how one quietly changes shape in transit.
  assert.match(source, /await upstream\.text\(\)/);
  assert.doesNotMatch(source, /await upstream\.json\(\)/);
});

test('upstream caching and back-off headers are passed through, not invented', () => {
  assert.match(source, /upstream\.headers\.get\('cache-control'\)/);
  assert.match(source, /upstream\.headers\.get\('retry-after'\)/);
});

test('the visitor IP is read the way public edge routes here read it', () => {
  // CloudFront strips `x-real-ip`, so a route trusting it scopes every visitor
  // to one empty bucket.
  assert.match(source, /headers\.get\('cloudfront-viewer-address'\)/);
  assert.match(source, /headers\.get\('x-forwarded-for'\)/);
  // Matched on the header READ, not the word: the docblock names `x-real-ip`
  // to explain why it is never consulted.
  assert.doesNotMatch(source, /headers\.get\('x-real-ip'\)/);
});

test('no upstream error text is returned to an anonymous caller', () => {
  assert.doesNotMatch(source, /detail:/);
});
