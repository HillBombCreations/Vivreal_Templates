import { test } from 'node:test';
import assert from 'node:assert/strict';
import { socialBandConfigs, socialBandItems, isSocialBandProvider } from './socialBand.ts';
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

test('[B3.2] a skip on one section does not hide the post on another', () => {
  // Per section, which is reason 2 for storing it on the binding. The skip is
  // read per band, so a second page reading the same platform is untouched.
  const skipped = socialBandConfigs([band('instagram', { skippedPostIds: ['ig1'] })]);
  const other = socialBandConfigs([band('instagram')]);
  assert.deepEqual(socialBandItems(skipped.get('instagram')!, itemsFor).map((i) => i.id), ['ig2']);
  assert.deepEqual(socialBandItems(other.get('instagram')!, itemsFor).map((i) => i.id), ['ig1', 'ig2']);
});

test('[B3.1] an undated post sorts LAST rather than wherever the sort put it', () => {
  const undated = { ...post('ig3', 'instagram', ''), date: undefined };
  const pool: Record<string, ContentItem[]> = { instagram: [undated, ...IG] };
  const cfgs = socialBandConfigs([band('instagram')]);
  const items = socialBandItems(cfgs.get('instagram')!, (p) => pool[p]);
  assert.deepEqual(items.map((i) => i.id), ['ig1', 'ig2', 'ig3']);
});
