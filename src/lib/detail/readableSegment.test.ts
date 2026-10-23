import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Discovery batch 3.10 item 13: readable show and team addresses with a
// permanent redirect from the id address. Every ALLOW has its REFUSE.
//
// Lazily imported: on a tree without the module the file still loads, and the
// assertions (not an import error) are what fail.
const mod = (await import('./readableSegment.ts').catch(() => null)) as typeof import('./readableSegment.ts') | null;
function api(): typeof import('./readableSegment.ts') {
  assert.ok(mod, 'src/lib/detail/readableSegment.ts exists');
  return mod;
}

const HOTSHOTS = { id: '68fb126ce945a954f02fb644', title: 'Hotshots' };
const FEB = { id: '68fb12b8e945a954f02fb64e', title: 'Monsignor Madness February' };
const NOV = { id: '68fb130be945a954f02fb65f', title: 'Monsignor Madness November' };

test('ALLOW: a show with no CMS slug answers at its title plus a six character id tail', () => {
  const segments = api().readableSegments([HOTSHOTS, FEB]);
  assert.equal(segments.get(HOTSHOTS.id), 'hotshots-2fb644');
  assert.equal(segments.get(FEB.id), 'monsignor-madness-february-2fb64e');
});

test('ALLOW: a CMS slug wins (top-level slug, then _system.slug), exactly like collection items', () => {
  const { readableSegments, cmsSlugOf } = api();
  assert.equal(cmsSlugOf({ slug: 'hot-shots' }), 'hot-shots');
  assert.equal(cmsSlugOf({ _system: { slug: 'from-system' } }), 'from-system');
  assert.equal(cmsSlugOf({ slug: 'top', _system: { slug: 'nested' } }), 'top');
  assert.equal(readableSegments([{ ...HOTSHOTS, cmsSlug: 'hot-shots' }]).get(HOTSHOTS.id), 'hot-shots');
});

test('ALLOW: a team member is addressed by name; apostrophes and accents read naturally', () => {
  const { readableSegments, slugifyTitle } = api();
  assert.equal(readableSegments([{ id: '68fb15cdf7818909629c484d', name: 'Will Cunnington' }]).get('68fb15cdf7818909629c484d'), 'will-cunnington-9c484d');
  assert.equal(slugifyTitle("Here's My Thing: A Show & Tell"), 'heres-my-thing-a-show-and-tell');
  assert.equal(slugifyTitle('Crème Brûlée Night'), 'creme-brulee-night');
});

test('ALLOW: the old id address resolves to the item and asks for a redirect to the readable one', () => {
  assert.deepEqual(api().resolveReadableSegment([HOTSHOTS, FEB], HOTSHOTS.id), { item: HOTSHOTS, segment: 'hotshots-2fb644', redirect: true });
});

test('ALLOW: a readable address from before a title edit still finds the item by its id tail, and redirects', () => {
  const renamed = { ...HOTSHOTS, title: 'Hotshots Live' };
  assert.deepEqual(api().resolveReadableSegment([renamed], 'hotshots-2fb644'), { item: renamed, segment: 'hotshots-live-2fb644', redirect: true });
});

test('REFUSE: the canonical readable address is served, never redirected (no loop)', () => {
  assert.deepEqual(api().resolveReadableSegment([HOTSHOTS, FEB], 'hotshots-2fb644'), { item: HOTSHOTS, segment: 'hotshots-2fb644', redirect: false });
});

test('REFUSE: an address that names nothing is a miss (the route’s 404 path), including an ambiguous id tail', () => {
  const { resolveReadableSegment } = api();
  assert.equal(resolveReadableSegment([HOTSHOTS], 'nope-zzzzzz'), null);
  assert.equal(resolveReadableSegment([HOTSHOTS], 'hotshots'), null);
  const twin = { id: '00000000000000000a2fb644', title: 'Other' };
  assert.equal(resolveReadableSegment([HOTSHOTS, twin], 'gone-2fb644'), null, 'two ids share the tail: no guess');
});

test('REFUSE: two items that would share an address both keep their id, so a readable URL never shows the wrong one', () => {
  const segments = api().readableSegments([{ ...FEB, cmsSlug: 'monsignor' }, { ...NOV, cmsSlug: 'monsignor' }]);
  assert.equal(segments.get(FEB.id), FEB.id);
  assert.equal(segments.get(NOV.id), NOV.id);
});

test('REFUSE: an item with no title, or a non-Mongo id, keeps its id address unchanged', () => {
  const segments = api().readableSegments([{ id: '68fb126ce945a954f02fb699' }, { id: 'legacy-7', title: 'Old' }]);
  assert.equal(segments.get('68fb126ce945a954f02fb699'), '68fb126ce945a954f02fb699');
  assert.equal(segments.get('legacy-7'), 'legacy-7');
});

test('ALLOW (live fixture): every Comedy Collective show and team member from the live read gets a readable address', () => {
  const fixture = JSON.parse(readFileSync(new URL('../seo/__fixtures__/liveDetailDates.json', import.meta.url), 'utf8')) as {
    shows: Array<{ _id: string; objectValue: { title?: string } }>;
    team: Array<{ _id: string; objectValue: { name?: string } }>;
  };
  const { readableSegments } = api();
  const shows = fixture.shows.map((s) => ({ id: s._id, title: s.objectValue.title }));
  const team = fixture.team.map((m) => ({ id: m._id, name: m.objectValue.name }));
  for (const [items, label] of [[shows, 'show'], [team, 'member']] as const) {
    const segments = readableSegments(items);
    for (const item of items) {
      const segment = segments.get(item.id) ?? '';
      assert.notEqual(segment, item.id, `${label} ${item.id} still uses its id`);
      assert.match(segment, /^[a-z0-9-]+-[0-9a-f]{6}$/, segment);
    }
  }
});

// The route cannot load here (JSX), so its wiring is pinned in source.
const route = readFileSync(new URL('../../app/[slug]/[itemId]/page.tsx', import.meta.url), 'utf8');
const siteData = readFileSync(new URL('../api/siteData/index.tsx', import.meta.url), 'utf8');

test('SOURCE PIN: both arms redirect an id address permanently, and the sitemap lists readable addresses', () => {
  assert.ok(route.includes('if (resolvedShow?.redirect) permanentRedirect(readableRedirectTarget(slug, resolvedShow.segment, (await searchParams) ?? {}));'));
  assert.ok(route.includes('if (resolvedMember?.redirect) permanentRedirect(readableRedirectTarget(slug, resolvedMember.segment, (await searchParams) ?? {}));'));
  assert.ok(siteData.includes('segment: showSegments.get(show.id) ?? show.id'));
  assert.ok(siteData.includes('segment: memberSegments.get(member.id) ?? member.id'));
});

test('ALLOW (review 2026-10-23): the readable redirect keeps the query string, utm tags and all', () => {
  assert.equal(typeof api().readableRedirectTarget, 'function', 'readableRedirectTarget exists');
  assert.equal(
    api().readableRedirectTarget('shows', 'hotshots-2fb644', { utm_source: 'instagram', utm_campaign: 'fall show', ref: ['a', 'b'] }),
    '/shows/hotshots-2fb644?utm_source=instagram&utm_campaign=fall+show&ref=a&ref=b',
  );
});

test('REFUSE (review 2026-10-23): a router cache key (_rsc) never rides the permanent redirect, and no query adds no "?"', () => {
  assert.equal(typeof api().readableRedirectTarget, 'function', 'readableRedirectTarget exists');
  assert.equal(api().readableRedirectTarget('shows', 'hotshots-2fb644', { _rsc: 'x1', utm_medium: 'social' }), '/shows/hotshots-2fb644?utm_medium=social');
  assert.equal(api().readableRedirectTarget('team', 'will-cunnington-9c484d', {}), '/team/will-cunnington-9c484d');
});

test('cleanup (review 2026-10-23): the shows reader no longer names the removed getShowById', () => {
  assert.ok(!readFileSync(new URL('../api/shows/index.tsx', import.meta.url), 'utf8').includes('getShowById'));
});
