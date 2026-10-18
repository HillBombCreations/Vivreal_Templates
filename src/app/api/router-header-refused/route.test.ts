import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as route from './route.ts';

/**
 * The refusal route the router-header rewrites land on
 * (design-templates-router-header-strip-2026-10-18.md, Option B). A refused
 * request must never get a 200, never get flight, and never be cacheable.
 */

const FORGED = new Request('https://site.test/api/router-header-refused?v=1', {
  headers: {
    'next-router-prefetch': '1',
    'next-router-segment-prefetch': '/_tree',
  },
});

function assertRefusal(res: Response): void {
  assert.equal(res.status, 400);
  const cacheControl = res.headers.get('cache-control') ?? '';
  assert.match(cacheControl, /\bprivate\b/);
  assert.match(cacheControl, /\bno-store\b/);
  assert.doesNotMatch(cacheControl, /s-maxage/);
  assert.match(res.headers.get('content-type') ?? '', /^text\/plain\b/);
  assert.doesNotMatch(res.headers.get('content-type') ?? '', /x-component/);
}

test('REFUSE: GET of a forged router-header request is a no-store 400, never flight', async () => {
  const res = route.GET(FORGED);
  assertRefusal(res);
  assert.equal(await res.text(), 'Bad request\n');
});

test('REFUSE: HEAD is the same no-store 400 with no body', async () => {
  const res = route.HEAD(FORGED);
  assertRefusal(res);
  assert.equal(res.body, null);
});

test('REFUSE: the route requested directly is the same no-store 400', () => {
  assertRefusal(route.GET(new Request('https://site.test/api/router-header-refused')));
});

test('the route is force-dynamic, so it can never be prerendered with a static s-maxage', () => {
  assert.equal(route.dynamic, 'force-dynamic');
});
