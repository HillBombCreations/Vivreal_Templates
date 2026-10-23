import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { SiteData } from '@/types/SiteData';
import nextConfig from '../../../next.config.ts';
import { keyFileAnswer, readIndexNowKey } from './keyFile.ts';
import { KEY_FILE_REWRITE } from './keyFileRewrite.ts';

// Discovery batch 2.2 (design section 6, row "Key"). Every ALLOW has its REFUSE.

const KEY = '0123456789abcdef0123456789abcdef';
const LIVE = { lifecycleState: 'live', indexNowKey: KEY } as SiteData;

test('ALLOW: a live site answers /<key>.txt with 200, text/plain, body exactly the key', () => {
  const answer = keyFileAnswer(LIVE, KEY);
  assert.equal(answer.status, 200);
  assert.equal(answer.body, KEY);
  assert.equal(answer.headers['Content-Type'], 'text/plain; charset=utf-8');
  assert.equal(answer.headers['Cache-Control'], 'public, max-age=3600');
});

test('REFUSE: a different, well-formed 32 hex name is a 404', () => {
  assert.equal(keyFileAnswer(LIVE, 'ffffffffffffffffffffffffffffffff').status, 404);
});

test('REFUSE: a demo answers 404 even if a key were present', () => {
  assert.equal(keyFileAnswer({ ...LIVE, lifecycleState: 'demo' } as SiteData, KEY).status, 404);
});

test('REFUSE (absent C1): a site with no key answers 404 for every name', () => {
  const noKey = { lifecycleState: 'live' } as SiteData;
  assert.equal(keyFileAnswer(noKey, KEY).status, 404);
  assert.equal(keyFileAnswer(noKey, '').status, 404);
});

test('REFUSE: a malformed key from upstream is never served (uppercase, short, not a string)', () => {
  for (const bad of [KEY.toUpperCase(), KEY.slice(1), `${KEY}0`, 42, null]) {
    assert.equal(readIndexNowKey(bad), undefined, String(bad));
    assert.equal(keyFileAnswer({ lifecycleState: 'live', indexNowKey: bad } as unknown as SiteData, String(bad)).status, 404);
  }
});

test('REFUSE: unreadable site data answers 503, never "no key here"', () => {
  assert.equal(keyFileAnswer({ ...LIVE, degraded: true } as SiteData, KEY).status, 503);
});

// The rewrite, through Next's own matcher (the function `resolve-routes.js`
// runs for every config rewrite), and present in the real config.
const require = createRequire(import.meta.url);
// cast: createRequire returns `any`; this is the 16.3 signature of getPathMatch.
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match') as {
  getPathMatch: (path: string) => (pathname: string) => false | Record<string, string>;
};
const match = getPathMatch(KEY_FILE_REWRITE.source);

test('ALLOW: /<32 lowercase hex>.txt matches the rewrite, carrying the name', () => {
  assert.deepEqual(match(`/${KEY}.txt`), { key: KEY });
});

test('REFUSE: robots.txt, llms.txt, short, long and nested names never match', () => {
  for (const path of ['/robots.txt', '/llms.txt', `/${KEY.slice(1)}.txt`, `/${KEY}0.txt`, `/a/${KEY}.txt`, `/${KEY}`]) {
    assert.equal(match(path), false, path);
  }
});

test('REFUSE: Next matches paths case-insensitively, so an UPPERCASE name reaches the route, which answers 404', () => {
  assert.deepEqual(match(`/${KEY.toUpperCase()}.txt`), { key: KEY.toUpperCase() });
  assert.equal(keyFileAnswer(LIVE, KEY.toUpperCase()).status, 404);
});

test('the rewrite is in next.config.ts beforeFiles, pointing at the key route', async () => {
  const rewrites = await nextConfig.rewrites?.();
  assert.ok(rewrites && !Array.isArray(rewrites), 'sanity: the config has phased rewrites');
  // cast: NextConfig types rules loosely; only source and destination are read.
  const before = (rewrites.beforeFiles ?? []) as Array<{ source: string; destination: string }>;
  assert.ok(before.some((r) => r.source === KEY_FILE_REWRITE.source && r.destination === '/api/indexnow/key/:key'));
});

test('ALLOW (review 2026-10-23): a demo’s 404 carries X-Robots-Tag from the route itself (cold edge map)', () => {
  const answer = keyFileAnswer({ ...LIVE, lifecycleState: 'demo' } as SiteData, KEY);
  assert.equal(answer.status, 404);
  assert.equal(answer.headers['X-Robots-Tag'], 'noindex, nofollow');
});

test('REFUSE: a live site’s 404 and 200 carry no X-Robots-Tag', () => {
  assert.equal(keyFileAnswer(LIVE, 'ffffffffffffffffffffffffffffffff').headers['X-Robots-Tag'], undefined);
  assert.equal(keyFileAnswer(LIVE, KEY).headers['X-Robots-Tag'], undefined);
});
