import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as stable from './stableImage.ts';

/**
 * Review of #212/#213 (nothing left behind): both image routes,
 * `/img/<slug>/<itemId>` (T4) and `/img/<slug>/<itemId>/<file>` (BLOG2). When
 * the item read failed or came back degraded and no item was found, the route
 * cannot know whether the picture exists: it answers 503 `no-store`, never a
 * cacheable 404 that an edge would keep serving after the read recovers. A
 * real miss on a healthy read stays the cacheable 404.
 *
 * `answer` is the route's answer for one read. On a tree without
 * `itemImageResponse` it is the expression both routes used before
 * (`stableImageResponse(signedUrl)`), so the REFUSE tests fail on their
 * assertions there, not on a missing export.
 */
type ItemImageRead = { signedUrl?: string; degraded: boolean; itemFound: boolean };
const answer = (read: ItemImageRead, fetchImpl: typeof fetch): Promise<Response> => {
  // Cast: the export this change adds; absent, today's route expression.
  const fn = (stable as Record<string, unknown>).itemImageResponse as
    | ((r: ItemImageRead, f: typeof fetch) => Promise<Response>)
    | undefined;
  return fn ? fn(read, fetchImpl) : stable.stableImageResponse(read.signedUrl, fetchImpl);
};

const SIGNED = 'https://media.vivreal.io/g/post.png?Expires=1&Signature=x&Key-Pair-Id=k';
const neverFetch = (async () => {
  throw new Error('nothing to fetch');
}) as typeof fetch; // the stub implements only the call shape the module uses
const picture = (async () => new Response(new Uint8Array(16), { headers: { 'Content-Type': 'image/png' } })) as typeof fetch; // as above

test('REFUSE: a degraded read that found no item is a 503 no-store, never a cacheable 404', async () => {
  const res = await answer({ degraded: true, itemFound: false }, neverFetch);
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('ALLOW: a healthy read with no such item stays the cacheable 404', async () => {
  const res = await answer({ degraded: false, itemFound: false }, neverFetch);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('cache-control') ?? '', /public, max-age=300/);
});

test('ALLOW: an item found on a degraded read is still served; found with no picture is the 404', async () => {
  const served = await answer({ signedUrl: SIGNED, degraded: true, itemFound: true }, picture);
  assert.equal(served.status, 200);
  const noPicture = await answer({ degraded: true, itemFound: true }, neverFetch);
  assert.equal(noPicture.status, 404, 'the item was read; it has no such picture');
});

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

for (const [route, call] of [
  ['../../app/img/[slug]/[itemId]/route.ts', 'itemImageSignedUrl(siteData, page, itemId)'],
  ['../../app/img/[slug]/[itemId]/[file]/route.ts', 'richTextImageSignedUrl(siteData, page, itemId, file)'],
] as const) {
  test(`SOURCE PIN: ${route} answers through itemImageResponse with the read's degraded flag`, () => {
    const code = source(route);
    assert.ok(code.includes(call), `sanity: ${route} reads the item`);
    assert.ok(code.includes('withDemoRobotsHeader(await itemImageResponse(read), isDemoSite(siteData))'), `${route} must answer through itemImageResponse`);
  });
}

test('SOURCE PIN: every item read in the glue carries its degraded flag', () => {
  const glue = source('./itemImage.ts');
  for (const piece of ['degraded: showsDegraded', 'degraded: teamDegraded', 'resolveStorefrontItemSummaryRead(', 'degraded: lookup.degraded']) {
    assert.ok(glue.includes(piece), `itemImage.ts must carry ${piece}`);
  }
});
