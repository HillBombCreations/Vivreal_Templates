import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySocialBands,
  canonicalIntegrationType,
  isSocialBandProvider,
  socialBandConfigs,
  socialBandItems,
} from './socialBand.ts';
import type { ContentItem } from '@/types/ContentItem';

/**
 * B3.1-G / B3.2-G and their controls
 * (docs/projects/isr-and-social-pass/plan.md).
 *
 * B3.2's control has two halves and the SECOND is the one that matters: the
 * stored post must be byte identical before and after a skip. If the skip
 * mutates the post it has become an edit, which is the objection that ruled
 * out option B for the whole feature.
 */

function post(id: string, platform: string, date: string): ContentItem {
  return {
    id,
    title: '',
    imageUrl: `https://client.vivreal.io/media?key=${id}.jpg`,
    date,
    href: `https://example.test/${id}`,
    source: 'integration',
    integrationType: platform,
    raw: { link: `https://example.test/${id}`, platform, channel: platform, kind: 'photo' },
  };
}

function band(provider: string, sectionConfig?: Record<string, unknown>) {
  return {
    type: { kind: 'layout' },
    config: { bindings: [{ integrationProvider: provider, ...(sectionConfig ? { sectionConfig } : {}) }] },
  };
}

const IG = [post('ig1', 'instagram', '2026-09-20T09:00:00Z'), post('ig2', 'instagram', '2026-09-10T09:00:00Z')];
const TT = [post('tt1', 'tiktok', '2026-09-15T09:00:00Z')];
const POOL: Record<string, ContentItem[]> = { instagram: IG, tiktok: TT };
const itemsFor = (platform: string) => POOL[platform];

/* ------------------------------------------------------------------ */
/*  B3.1 — one combined band                                           */
/* ------------------------------------------------------------------ */

test('[B3.1-G] two platforms appear in ONE band, in date order', () => {
  const cfgs = socialBandConfigs([band('instagram', { platforms: ['instagram', 'tiktok'] })]);
  const items = socialBandItems(cfgs.get('instagram')!, itemsFor);

  assert.deepEqual(items.map((i) => i.id), ['ig1', 'tt1', 'ig2']);
  // Mixed, not grouped: the TikTok post sits BETWEEN the two Instagram ones
  // because it was posted between them. A band that concatenated per platform
  // would also pass a bare "both are present" check.
  assert.equal(items[1].raw?.platform, 'tiktok');
});

test('[B3.1-C] unticking a platform removes its posts from what the page renders', () => {
  // The control that matters more than the gate. This runs on the SAME path
  // the live render uses, before the renderer sees an item, so it is not an
  // editor-only assertion.
  const cfgs = socialBandConfigs([band('instagram', { platforms: ['instagram'] })]);
  const items = socialBandItems(cfgs.get('instagram')!, itemsFor);
  assert.deepEqual(items.map((i) => i.id), ['ig1', 'ig2']);
  assert.ok(!items.some((i) => i.raw?.platform === 'tiktok'));
});

test('[B3.1] unticking EVERYTHING empties the band, rather than re-adding the provider', () => {
  // `platforms: []` is an owner having unticked the band. Re-adding the bound
  // provider "to be safe" would make the tick unable to turn anything off,
  // which is a control that lies.
  const cfgs = socialBandConfigs([band('instagram', { platforms: [] })]);
  assert.deepEqual(socialBandItems(cfgs.get('instagram')!, itemsFor), []);
});

test('[B3.1] a band authored before the ticks existed still shows its own provider', () => {
  // Absent `platforms` is not an empty `platforms`. Every band on every live
  // site today has no such key, and must be byte-identical after this ships.
  const cfgs = socialBandConfigs([band('instagram')]);
  assert.deepEqual(socialBandItems(cfgs.get('instagram')!, itemsFor).map((i) => i.id), ['ig1', 'ig2']);
});

test('[B3.1] two bands disagreeing about one provider do NOT merge, rather than merging wrongly', () => {
  // The limit this module's header states. One key, two answers: showing a
  // platform the second band unticked is the exact failure B3.1-C catches, so
  // the provider falls back to itself and the degrade is visible.
  const cfgs = socialBandConfigs([
    band('instagram', { platforms: ['instagram', 'tiktok'] }),
    band('instagram', { platforms: ['instagram'] }),
  ]);
  assert.deepEqual(cfgs.get('instagram')!.platforms, ['instagram']);
});

test('[B3.1-C] a non-social integration is never a band', () => {
  // A products grid must not be routed through any of this.
  assert.equal(socialBandConfigs([band('stripe', { platforms: ['stripe'] })]).size, 0);
  assert.equal(socialBandConfigs([band('x', { platforms: ['x'] })]).size, 0);
  assert.equal(isSocialBandProvider('stripe'), false);
  assert.equal(isSocialBandProvider('TikTok'), true);
});

test('[B3.1] a band nested inside a group is found', () => {
  const cfgs = socialBandConfigs([
    { type: { kind: 'group' }, config: { children: [band('instagram', { platforms: ['instagram', 'tiktok'] })] } },
  ]);
  assert.deepEqual(cfgs.get('instagram')!.platforms, ['instagram', 'tiktok']);
});

/* ------------------------------------------------------------------ */
/*  B3.2 — the per post skip                                           */
/* ------------------------------------------------------------------ */

test('[B3.2-G] a skipped post is absent and the band closes up around it', () => {
  const cfgs = socialBandConfigs([
    band('instagram', { platforms: ['instagram', 'tiktok'], skippedPostIds: ['tt1'] }),
  ]);
  const items = socialBandItems(cfgs.get('instagram')!, itemsFor);

  assert.deepEqual(items.map((i) => i.id), ['ig1', 'ig2']);
  // "The rest of the band is unchanged" is not decoration: a skip that
  // silently reordered or dropped a neighbour passes a naive absence check.
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'ig1');
  assert.equal(items[1].id, 'ig2');
});

test('[B3.2-C] an unskipped post from the same account is still present in the SAME render', () => {
  const cfgs = socialBandConfigs([band('instagram', { skippedPostIds: ['ig2'] })]);
  const items = socialBandItems(cfgs.get('instagram')!, itemsFor);
  assert.deepEqual(items.map((i) => i.id), ['ig1']);
});

test('[B3.2-C] the stored post is BYTE IDENTICAL before and after a skip', () => {
  // The half that decides whether this is a hide or an edit. Snapshotted over
  // the whole pool, not just the skipped row: a skip that mutated a NEIGHBOUR
  // would pass a check on the skipped one alone.
  const before = JSON.stringify(POOL);
  const cfgs = socialBandConfigs([
    band('instagram', { platforms: ['instagram', 'tiktok'], skippedPostIds: ['ig1', 'tt1'] }),
  ]);
  const items = socialBandItems(cfgs.get('instagram')!, itemsFor);

  assert.deepEqual(items.map((i) => i.id), ['ig2']);
  assert.equal(JSON.stringify(POOL), before, 'the skip mutated a stored post, so it is an edit');
});

test('[B3.2] a skip on one PAGE does not hide the post on another page', () => {
  // Renamed to what it proves. It was called "on another SECTION", which is a
  // stronger claim than two separate `socialBandConfigs` calls can make: two
  // calls are two PAGES, because a page is the unit this function is given.
  // The same-page case is the test below, and it does not hold.
  const skipped = socialBandConfigs([band('instagram', { skippedPostIds: ['ig1'] })]);
  const other = socialBandConfigs([band('instagram')]);
  assert.deepEqual(socialBandItems(skipped.get('instagram')!, itemsFor).map((i) => i.id), ['ig2']);
  assert.deepEqual(socialBandItems(other.get('instagram')!, itemsFor).map((i) => i.id), ['ig1', 'ig2']);
});

test('[B3.2] KNOWN LIMIT: two bands on ONE page bound to one provider SHARE their skips', () => {
  // Stated as a test rather than left in a docblock, because the docblock
  // above `socialBandConfigs` says skips are unioned and the test next to it
  // was named as though they were not. One of the two had to be wrong and a
  // reader had no way to tell which.
  //
  // The cause is the renderer's by-provider getter: `getIntegrationItems(type)`
  // takes a provider and nothing else, so one provider has exactly one entry
  // and two bands wanting different contents have one place to put them.
  // Unioning is the chosen degrade (it only ever shows LESS, never a post an
  // owner hid), not an accident.
  const cfgs = socialBandConfigs([
    band('instagram', { skippedPostIds: ['ig1'] }),
    band('instagram', { skippedPostIds: ['ig2'] }),
  ]);
  assert.deepEqual([...cfgs.get('instagram')!.skipped].sort(), ['ig1', 'ig2']);
  assert.deepEqual(socialBandItems(cfgs.get('instagram')!, itemsFor).map((i) => i.id), []);

  // The paired allow, which is what stops this reading as "skips leak
  // everywhere": ONE band on the page hides only what it asked to hide.
  const alone = socialBandConfigs([band('instagram', { skippedPostIds: ['ig1'] })]);
  assert.deepEqual(socialBandItems(alone.get('instagram')!, itemsFor).map((i) => i.id), ['ig2']);
});

test('[B3.1] an undated post sorts LAST rather than wherever the sort put it', () => {
  const undated = { ...post('ig3', 'instagram', ''), date: undefined };
  const pool: Record<string, ContentItem[]> = { instagram: [undated, ...IG] };
  const cfgs = socialBandConfigs([band('instagram')]);
  const items = socialBandItems(cfgs.get('instagram')!, (p) => pool[p]);
  assert.deepEqual(items.map((i) => i.id), ['ig1', 'ig2', 'ig3']);
});

/* ------------------------------------------------------------------ */
/*  The LOOP, not the function                                         */
/* ------------------------------------------------------------------ */

test('[B3.1] a band reads the items AS FETCHED, whatever order the bands were authored in', () => {
  // THE TEST THAT DRIVES THE LOOP. Everything above drives `socialBandItems`
  // through a closure over a frozen pool, which is the one shape that cannot
  // see this: the bug is not in resolving a band, it is in resolving the
  // SECOND band against a map the FIRST one has already rewritten.
  //
  // The scenario is the smallest one that shows it. A TikTok band hides
  // `tt1`. An Instagram band ticks both platforms and hides nothing. Reading
  // the live map, the Instagram band inherits the TikTok band's skip whenever
  // the TikTok band happens to be authored first: same data, same page, two
  // different renders decided by the order the owner dragged the blocks in.
  const pool = (): Map<string, ContentItem[]> =>
    new Map([
      ['instagram', [post('ig1', 'instagram', '2026-09-20T09:00:00Z')]],
      [
        'tiktok',
        [
          post('tt1', 'tiktok', '2026-09-15T09:00:00Z'),
          post('tt2', 'tiktok', '2026-09-10T09:00:00Z'),
        ],
      ],
    ]);

  const tiktokBand = band('tiktok', { skippedPostIds: ['tt1'] });
  const instagramBand = band('instagram', { platforms: ['instagram', 'tiktok'] });

  for (const [label, blocks] of [
    ['tiktok band authored FIRST', [tiktokBand, instagramBand]],
    ['instagram band authored FIRST', [instagramBand, tiktokBand]],
  ] as const) {
    const items = pool();
    applySocialBands(items, blocks);

    assert.deepEqual(
      items.get('instagram')!.map((i) => i.id),
      ['ig1', 'tt1', 'tt2'],
      `${label}: the Instagram band must not inherit the TikTok band's skip`,
    );
    // The paired assertion, and it is what stops the fix being "ignore the
    // skips". The band that DID ask to hide `tt1` still hides it.
    assert.deepEqual(
      items.get('tiktok')!.map((i) => i.id),
      ['tt2'],
      `${label}: the TikTok band's own skip must still apply`,
    );
  }
});

test('[B3.1-C] applying the bands leaves a provider nobody bound alone', () => {
  // The control for the loop. A page can bind a storefront alongside a social
  // band, and `applySocialBands` writes into the SAME map those items live
  // in, so "it only rewrites what it was asked to" has to be asserted rather
  // than assumed.
  const products = [post('sku1', 'stripe', '2026-09-01T09:00:00Z')];
  const items = new Map<string, ContentItem[]>([
    ['instagram', [...IG]],
    ['stripe', products],
  ]);
  applySocialBands(items, [band('instagram', { skippedPostIds: ['ig1'] })]);

  assert.equal(items.get('stripe'), products, 'the storefront entry was replaced');
  assert.deepEqual(items.get('instagram')!.map((i) => i.id), ['ig2']);
});

/* ------------------------------------------------------------------ */
/*  The wire crossing: lower-case inside, stored spelling outside      */
/* ------------------------------------------------------------------ */

test('[wire] a platform leaving for a query carries the spelling it is STORED under', () => {
  // The hazard this pins: everything in this module compares lower-cased, and
  // `platform` is stored camelCase for LinkedIn and matched EXACTLY upstream
  // (`VR_CMS_API` sync/linkedIn.js writes `platform: 'linkedIn'`;
  // `VR_Client_API` tenant/getIntegrationObjects.js builds
  // `{ groupID, platform: type }` with no normalisation anywhere in the file).
  // A lower-cased `linkedin` on the wire therefore matches nothing, forever,
  // and nothing goes red: the owner's band just renders empty.
  assert.equal(canonicalIntegrationType('linkedin'), 'linkedIn');
  assert.equal(canonicalIntegrationType('LinkedIn'), 'linkedIn');
  assert.equal(canonicalIntegrationType('  LINKEDIN  '), 'linkedIn');

  // The control that keeps this from being "uppercase the I in everything":
  // the other three ARE stored lower-case and must come back unchanged.
  for (const platform of ['instagram', 'tiktok', 'facebook']) {
    assert.equal(canonicalIntegrationType(platform), platform);
    assert.equal(canonicalIntegrationType(platform.toUpperCase()), platform);
  }

  // And the control for the other direction: a type this module knows nothing
  // about is passed through untouched rather than invented a spelling for.
  for (const other of ['stripe', 'square', 'shopify', 'mailchimp', 'x']) {
    assert.equal(canonicalIntegrationType(other), other);
  }
});

test('[wire] the MAP stays lower-cased, because that is the key the renderer asks with', () => {
  // The other half of the crossing, and the reason canonicalisation cannot
  // simply be done everywhere. The renderer reads
  // `getIntegrationItems((type ?? '').toLowerCase())`, so an entry stored
  // under `linkedIn` would never be found. Lower-case in the map, stored
  // spelling on the wire, and `canonicalIntegrationType` is the only crossing.
  const items = new Map<string, ContentItem[]>([
    ['linkedin', [post('li1', 'linkedin', '2026-09-20T09:00:00Z')]],
  ]);
  applySocialBands(items, [band('linkedIn')]);

  assert.deepEqual([...items.keys()], ['linkedin'], 'the band must key its result lower-cased');
  assert.deepEqual(items.get('linkedin')!.map((i) => i.id), ['li1']);
});
