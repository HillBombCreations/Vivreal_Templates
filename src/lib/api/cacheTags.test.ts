import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collectionTags, integrationTags } from './cacheTags.ts';

/**
 * These tags only do anything if they are byte-identical to the ones
 * `POST /api/revalidate` computes from a webhook event. When they are not,
 * nothing throws and nothing logs — the customer's edit is simply invisible
 * until the time TTL expires. That silence is why the 2026-08-30 investigation
 * had to reconstruct the tag from HTTP response byte counts to prove it was
 * even being emitted (vivreal-hq site-cache-invalidation/findings.md §3).
 *
 * So the interesting test is not "does it build a string" but "is it the SAME
 * string the route would clear", checked against the route's own source rather
 * than a copy of the format. `route.ts` imports `next/server`, so `node --test`
 * cannot execute it (same tradeoff as src/lib/cacheInvalidation.test.ts); the
 * template literals it clears with are extracted and compared literally.
 */

const SITE = '68adda65762dfc328d91382d';
const COLLECTION = '687936beae40f9611a0c459a';

test('a collection read is tagged with both the collection and the site', () => {
  assert.deepEqual(collectionTags(SITE, COLLECTION), [
    `site:${SITE}`,
    `collection:${COLLECTION}`,
  ]);
});

test('an integration read is tagged with both the integration type and the site', () => {
  assert.deepEqual(integrationTags(SITE, 'stripe'), [`site:${SITE}`, 'integration:stripe']);
});

test('a blank id is dropped, never emitted as a bare prefix', () => {
  // `site:` or `collection:` on its own matches nothing while looking like it
  // matches everything — the worst possible shape for a silent-failure tag.
  assert.deepEqual(collectionTags('', COLLECTION), [`collection:${COLLECTION}`]);
  assert.deepEqual(collectionTags(SITE, ''), [`site:${SITE}`]);
  assert.deepEqual(collectionTags('', ''), []);
  assert.deepEqual(integrationTags('', ''), []);
});

/* ------------------------------------------------------------------ */
/*  Contract with the webhook route                                    */
/* ------------------------------------------------------------------ */

const routeSource = fs.readFileSync(
  new URL('../../app/api/revalidate/route.ts', import.meta.url),
  'utf8',
);

test('every tag this module mints is a tag /api/revalidate knows how to clear', () => {
  for (const tag of [
    ...collectionTags(SITE, COLLECTION),
    ...integrationTags(SITE, 'stripe'),
  ]) {
    const prefix = tag.slice(0, tag.indexOf(':') + 1);
    assert.ok(
      routeSource.includes(`\`${prefix}\${`),
      `/api/revalidate must clear a "${prefix}" tag, or reads tagged with it are uninvalidatable`,
    );
  }
});

/* ------------------------------------------------------------------ */
/*  Wiring pins — the Phase 2 migrations                               */
/* ------------------------------------------------------------------ */

/**
 * `shows/index.tsx` and `team/index.tsx` are `server-only`, so `node --test`
 * cannot load them. These pin that the two detail-page reads the ISR plan
 * names in Blocker 5 actually went through the cached+tagged path — the whole
 * point of Phase 2 — rather than that they merely still compile.
 */
const showsSource = fs.readFileSync(new URL('./shows/index.tsx', import.meta.url), 'utf8');
const teamSource = fs.readFileSync(new URL('./team/index.tsx', import.meta.url), 'utf8');

test('the shows read backing detail pages is cached AND tagged', () => {
  assert.match(showsSource, /clientFetchCached</);
  assert.match(showsSource, /collectionTags\(SITE_ID, id\)/);
});

test('the team read backing detail pages is cached AND tagged', () => {
  assert.match(teamSource, /clientFetchCached</);
  assert.match(teamSource, /collectionTags\(SITE_ID, id\)/);
});

test('the paginated shows read stays UNCACHED — its key comes off a public query string', () => {
  // /api/shows passes `limit`/`skip` straight through from the request. Caching
  // that would let any caller mint unbounded Data Cache entries, so the split
  // between getShows (fixed window, cached) and getShowsPaginated (arbitrary
  // window, uncached) is deliberate and must survive refactors.
  assert.match(showsSource, /getShowsPaginated[\s\S]*?clientFetchSafe</);
});
