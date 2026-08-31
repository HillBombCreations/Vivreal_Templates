import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PageConfig } from '@/types/SiteData';
import { slugsForStaticParams } from './staticParams.ts';

/**
 * `generateStaticParams` decides which URLs a fleet build prerenders. Every
 * exclusion here has a live failure mode behind it, so each gets its own test
 * naming that failure rather than restating the code.
 */

const page = (slug: string, format = 'standard'): PageConfig =>
  ({ name: slug, slug, format, collectionId: null, labels: {} }) as PageConfig;

test('a plain page list becomes a slug list in the same order', () => {
  assert.deepEqual(
    slugsForStaticParams([page('about'), page('shows', 'shows'), page('shop', 'products')]),
    ['about', 'shows', 'shop'],
  );
});

test('depth-2 slugs are excluded — [slug]/[itemId] serves them, not [slug]', () => {
  // The migrator stores these as one config with an embedded slash. Emitting it
  // here prerenders `/features%2Fai-sites`, a URL nothing links to, while the
  // real `/features/ai-sites` still arrives at the other route.
  assert.deepEqual(
    slugsForStaticParams([page('about'), page('features/ai-sites'), page('a/b/c')]),
    ['about'],
  );
});

test('the synthetic subscribers page is excluded — the route 404s it on purpose', () => {
  assert.deepEqual(
    slugsForStaticParams([page('about'), page('subscribers', 'subscribers')]),
    ['about'],
  );
});

test('a page merely SLUGGED subscribers is still emitted — the format is the gate', () => {
  // `[slug]/page.tsx` guards on `format === "subscribers"`, not on the slug, so
  // this function must too or the two disagree about what is reachable.
  assert.deepEqual(slugsForStaticParams([page('subscribers', 'standard')]), ['subscribers']);
});

test('home is excluded — `/` serves it', () => {
  assert.deepEqual(slugsForStaticParams([page('home', 'home'), page('about')]), ['about']);
});

test('a blank slug is dropped, never emitted as an empty param', () => {
  // An empty param collides with the home route.
  assert.deepEqual(slugsForStaticParams([page(''), page('about')]), ['about']);
});

test('duplicate slugs collapse to one', () => {
  // Two prerender entries for one URL is a build error waiting to happen.
  assert.deepEqual(slugsForStaticParams([page('about'), page('about')]), ['about']);
});

test('the always-on slugs are appended', () => {
  // privacy/terms render from STATIC_PAGE_TITLES with no page config at all.
  assert.deepEqual(slugsForStaticParams([page('about')], ['privacy', 'terms']), [
    'about',
    'privacy',
    'terms',
  ]);
});

test('an authored page of the same slug keeps its place, and is not duplicated', () => {
  assert.deepEqual(slugsForStaticParams([page('privacy', 'static'), page('about')], ['privacy']), [
    'privacy',
    'about',
  ]);
});

test('no pages yields only the always-on slugs, and no pages at all yields nothing', () => {
  assert.deepEqual(slugsForStaticParams([], ['privacy']), ['privacy']);
  assert.deepEqual(slugsForStaticParams(undefined), []);
  assert.deepEqual(slugsForStaticParams([]), []);
});

test('with always-on slugs the result is NEVER empty, whatever the site data', () => {
  // Load-bearing, not cosmetic. An empty `generateStaticParams` makes Next
  // classify `/[slug]` as fully static, and with the render gate off every URL
  // on that route then returns HTTP 500 (measured: 45 DYNAMIC_SERVER_USAGE
  // errors, 500 on /about, /our-story, /shop, /schedule). The route passes
  // `Object.keys(STATIC_PAGE_TITLES)` as `alwaysOn` for exactly this reason,
  // so the guarantee has to hold for every degenerate input a site can send.
  const alwaysOn = ['privacy', 'terms'];
  const degenerate: (PageConfig[] | undefined)[] = [
    undefined,
    [],
    [page('', 'standard')],
    [page('subscribers', 'subscribers')],
    [page('home', 'home')],
    [page('a/b')],
  ];
  for (const pages of degenerate) {
    assert.ok(
      slugsForStaticParams(pages, alwaysOn).length > 0,
      `empty params for ${JSON.stringify(pages)} would 500 every /[slug] URL`,
    );
  }
});

test('a malformed config entry cannot crash a build', () => {
  // siteData comes off the wire; `pageConfigs` has been observed carrying
  // holes. A throw here fails the whole site build, not one page.
  const ragged = [undefined, null, {}, page('about')] as unknown as PageConfig[];
  assert.deepEqual(slugsForStaticParams(ragged), ['about']);
});
