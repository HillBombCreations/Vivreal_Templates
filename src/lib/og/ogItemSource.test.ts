import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planOgItemCard } from './ogCard.ts';

// Discovery batch 3.10 item 14 (review 2026-10-23): the show share card uses
// the poster on a shows page that relies on the SHOWS_ID fallback too. Driven
// through `resolveOgItem` + `planOgItemCard`, the two decisions the route makes.
//
// Lazily imported, so on a tree without the module the assertion, not the
// import, is what fails.
const mod = (await import('./ogItemSource.ts').catch(() => null)) as typeof import('./ogItemSource.ts') | null;
function api(): typeof import('./ogItemSource.ts') {
  assert.ok(mod, 'src/lib/og/ogItemSource.ts exists');
  return mod;
}

const POSTER = 'https://media.vivreal.io/shows/hotshots.jpg?Signature=x';
const SHOW = { id: '68fb126ce945a954f02fb644', title: 'Hotshots', imageUrl: POSTER };

function sources(overrides: Partial<import('./ogItemSource.ts').OgItemSources> = {}) {
  const calls: string[] = [];
  return {
    calls,
    value: {
      showsCollectionId: 'ENV_SHOWS_ID',
      readShows: async (id: string) => {
        calls.push(`shows:${id}`);
        return [SHOW];
      },
      storefrontSummary: async () => {
        calls.push('summary');
        return null;
      },
      lookup: async () => {
        // A SHOWS_ID page has no binding, so the bound lookup finds nothing.
        calls.push('lookup');
        return undefined;
      },
      ...overrides,
    },
  };
}

test('ALLOW: a shows page on the SHOWS_ID fallback draws the show’s poster', async () => {
  const s = sources();
  const item = await api().resolveOgItem('shows', SHOW.id, s.value);
  const plan = planOgItemCard(item, 'Shows');
  assert.deepEqual(plan, { kind: 'photo', signedUrl: POSTER, heading: 'Hotshots' });
  assert.deepEqual(s.calls, ['shows:ENV_SHOWS_ID'], 'read from the fallback collection, no bound lookup needed');
});

test('REFUSE: without the fix the same page fell to the page card (the bound lookup alone finds nothing)', async () => {
  const s = sources();
  assert.deepEqual(planOgItemCard(await s.value.lookup(), 'Shows'), { kind: 'card', heading: 'Shows' });
});

test('REFUSE: a show id not in the list falls back to the bound lookup, then the page card', async () => {
  const s = sources();
  const plan = planOgItemCard(await api().resolveOgItem('shows', 'ffffffffffffffffffffffff', s.value), 'Shows');
  assert.deepEqual(plan, { kind: 'card', heading: 'Shows' });
  assert.deepEqual(s.calls, ['shows:ENV_SHOWS_ID', 'lookup']);
});

test('REFUSE: a non-shows page never reads the shows list; a shows page with no collection at all skips it', async () => {
  const collection = sources();
  await api().resolveOgItem('collection-list', SHOW.id, collection.value);
  assert.deepEqual(collection.calls, ['lookup']);
  const none = sources({ showsCollectionId: '' });
  await api().resolveOgItem('shows', SHOW.id, none.value);
  assert.deepEqual(none.calls, ['lookup']);
});

test('ALLOW: a products page still answers from its storefront summary first', async () => {
  const s = sources({ storefrontSummary: async () => ({ title: 'Loaf', imageUrl: POSTER }) });
  assert.deepEqual(await api().resolveOgItem('products', 'p1', s.value), { title: 'Loaf', imageUrl: POSTER });
});
