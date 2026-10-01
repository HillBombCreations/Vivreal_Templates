/**
 * A HERO THAT READS A COLLECTION MUST HAVE THAT COLLECTION PREFETCHED.
 *
 * `buildPageContext` fetches exactly the ids `collectBindingTargets` returns
 * and exposes them through `data.getItems(id)`. Every hero variant shipped
 * before kit-builds-2026-09 took AUTHORED labels, so the collector only ever
 * had to read `bindings[]`, `page.collections` and `page.collectionId`.
 *
 * The `'feature-item'` variant (salon + live-events kits) is the first hero
 * whose lockup IS an item of a bound collection: the renderer's
 * `resolveFeatureItem` reads `page.hero.featureItem.collectionId` and calls
 * `data.getItems(collectionId)`. Nothing here collected it, so on a page whose
 * hero is the ONLY consumer of that collection `getItems` returned `[]`, and
 * `resolveFeatureItem` returns `undefined` for an empty list, so the hero fell
 * back to the plain title lockup. No error, no warning, no missing-data signal
 * anywhere: the page renders 200 with the hero silently degraded.
 *
 * It resolved at all only by ACCIDENT, on a page that also bound the same
 * collection for some other reason. `REFUSE: the fixture's id can only have
 * arrived via the hero` below is what stops this file from re-creating that
 * accident in test form.
 *
 * Verified against the two ends, 2026-09-30, reading committed refs:
 *   - producer: Vivreal_Site_Migrator `fix/site-chrome-top-level-home`,
 *     `packages/site-loader/src/shared/blueprintToPageConfig.js`
 *     `resolveHeroForWire` resolves the authored `featureItem.collectionKey`
 *     to `featureItem.collectionId` and THROWS on an unresolvable key, so by
 *     the time Templates sees it, it is an id.
 *   - consumer: vivreal-site-renderer `master` d2430d5,
 *     `src/composition/resolveHero.ts:436` `resolveFeatureItem`.
 *
 * Neither is published. Measured 2026-09-30 against the CLEAN 1.74.3 dist at
 * `VR_Client_API/node_modules/@hillbombcreations/site-renderer`, NOT the copy
 * under this repo's own `node_modules`, which is a dev dist laid over the
 * published package (2001 dist files against 1896, `package.json` five days
 * older than the dist beside it) and cannot be quoted for what shipped. The
 * three kit-builds-2026-09 hero variant literals `'feature-item'`,
 * `'docked-info'` and `'emblem'` hit 0 files there, against a KIND-MATCHED
 * control of five already-shipped hero variant literals that hit 6 to 15 files
 * each (`'minimal'` 15, `'masthead'` 10, `'site-carousel-hero'` 9,
 * `'search-lede'` 8, `'bleed-composite'` 6). So the search finds hero variant
 * literals, and these three are absent rather than unsearchable.
 *
 * That is the whole reason this file pins BEHAVIOUR rather than types: the
 * collector must already be correct when the renderer ships, and it is
 * name-agnostic so it does not have to be re-landed for the variant after this
 * one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`
// (see package.json "test"), which has no tsconfig `paths` resolution.
import { collectTargets, type PageBindingsByRole } from './bindingTargets.ts';
import type { PageConfig } from '@/types/SiteData';

interface Fixture {
  /**
   * `unknown` on purpose. These fixtures exercise hero shapes the Templates
   * `PageHero` mirror does not declare, which is the point: the collector
   * must not be coupled to the variant list.
   */
  hero?: unknown;
  blocks?: unknown;
  collections?: { collectionId?: string; role?: string }[];
  integrations?: { type?: string; name?: string; role?: string }[];
  collectionId?: string | null;
}

/**
 * `as unknown as PageConfig`: the fixture deliberately carries loosely-typed
 * `hero`/`blocks` (see above), so it cannot satisfy `PageConfig` structurally.
 */
const page = (over: Fixture = {}): PageConfig =>
  ({
    name: 'What is on',
    slug: 'whats-on',
    format: 'standard',
    collectionId: null,
    labels: {},
    ...over,
  }) as unknown as PageConfig;

/**
 * Reproduces `getPageBindingsByRole` (`@/lib/api/siteData`), which cannot be
 * imported here (that module imports `server-only`). `SOURCE PIN: the legacy
 * role buckets` below fails if the real one stops bucketing on these names.
 */
const bucketsLike = (p: Fixture): PageBindingsByRole => {
  const cols = p.collections ?? [];
  const ints = p.integrations ?? [];
  const bucket = (role: string) => ({
    collections: cols.filter((c) => (c.role ?? 'primary') === role),
    integrations: ints.filter((i) => (i.role ?? 'primary') === role),
  });
  return {
    primary: bucket('primary'),
    secondary: bucket('secondary'),
    supplemental: bucket('supplemental'),
    sidebar: bucket('sidebar'),
  };
};

// ─── THE GAP ─────────────────────────────────────────────────────────────────

test('ALLOW: a hero that is the ONLY consumer of a collection gets it prefetched (legacy page)', () => {
  const p = page({ hero: { variant: 'feature-item', title: 'Tonight', featureItem: { collectionId: 'col_shows' } } });

  const { collectionIds } = collectTargets(p, bucketsLike({}));

  assert.deepEqual(
    collectionIds,
    ['col_shows'],
    'the hero is the only thing on this page that reads a collection, so the collector is the only thing that can ask for it',
  );
});

test('ALLOW: the same hero on a BLOCKS-authored page (resolveHero reads page.hero on both paths)', () => {
  // The hero block carries no bindings of its own, because the renderer's hero
  // resolver takes `ctx.page`, not the block config (vivreal-site-renderer
  // `src/composition/blocks.ts:1786`, read 2026-09-30). So the collection
  // reference lives at page level whichever path composed the page, and a fix
  // inside the blocks-first branch alone would miss the legacy page (and the
  // reverse).
  const p = page({
    blocks: [{ id: 'hero', type: { kind: 'home-section', dispatchId: 'hero' }, config: {} }],
    hero: { variant: 'feature-item', title: 'Tonight', featureItem: { collectionId: 'col_shows' } },
  });

  const { collectionIds } = collectTargets(p, null);

  assert.deepEqual(collectionIds, ['col_shows']);
});

test('REFUSE: the fixture id can only have arrived via the hero (the mutation control)', () => {
  // THE POINT OF THIS FILE. Drop the hero from the byte-identical fixture the
  // two ALLOW cases use; if anything else on that page also referenced
  // `col_shows`, this stays green and both ALLOW cases above were passing for
  // the wrong reason, which is the production defect exactly, restated as a
  // test that cannot fail.
  assert.deepEqual(collectTargets(page(), bucketsLike({})).collectionIds, [], 'legacy path');
  assert.deepEqual(
    collectTargets(
      page({ blocks: [{ id: 'hero', type: { kind: 'home-section', dispatchId: 'hero' }, config: {} }] }),
      null,
    ).collectionIds,
    [],
    'blocks-first path',
  );
});

// ─── THE PER-PLATFORM TICKS GO THROUGH ONE ALLOWLIST ──────────────────

/** A social band block, with whatever ticks the case under test needs. */
const socialBand = (provider: string, sectionConfig?: Record<string, unknown>) => ({
  id: 'band',
  type: { kind: 'layout', dispatchId: 'media-mosaic' },
  config: { bindings: [{ integrationProvider: provider, ...(sectionConfig ? { sectionConfig } : {}) }] },
});

test('ALLOW: a ticked social platform is prefetched, so a combined band is not half-empty', () => {
  const { integrationTypes } = collectTargets(
    page({ blocks: [socialBand('instagram', { platforms: ['instagram', 'TikTok'] })] }),
    null,
  );
  assert.deepEqual(integrationTypes.sort(), ['instagram', 'tiktok']);
});

test('REFUSE: a tick on a NON-social type is not prefetched, and cannot become a storefront', () => {
  // Two readers of the same key had two allowlists. This collector added any
  // string; `socialBandConfigs` refuses everything outside the four social
  // providers. The gap is not merely a wasted fetch: two consumers resolve a
  // provider by SEARCHING this list rather than being handed one, and
  // `[slug]/[itemId]/page.tsx` picks a page's storefront with
  // `integrationTypes.find(isPaymentsProvider)`. A ticked `stripe` on a social
  // band would have answered that search.
  const { integrationTypes } = collectTargets(
    page({
      blocks: [socialBand('instagram', { platforms: ['instagram', 'stripe', 'square', 'x', 'shopify'] })],
    }),
    null,
  );
  assert.deepEqual(
    integrationTypes,
    ['instagram'],
    'only the band provider and its social ticks may be collected',
  );

  // The paired allow, and the reason this is not "ticks are ignored": the
  // bound provider is still collected from `integrationProvider`, and a
  // genuine social tick beside the refused ones still gets through.
  const mixed = collectTargets(
    page({ blocks: [socialBand('tiktok', { platforms: ['tiktok', 'facebook', 'stripe'] })] }),
    null,
  );
  assert.deepEqual(mixed.integrationTypes.sort(), ['facebook', 'tiktok']);
});

test('REFUSE: a non-social BINDING is untouched by the tick filter', () => {
  // The control for the control. The filter is on `sectionConfig.platforms`
  // only. A storefront binding collects exactly as it always did, or this
  // change would have taken every products page down with it.
  const { integrationTypes } = collectTargets(
    page({
      blocks: [
        {
          id: 'shop',
          type: { kind: 'layout', dispatchId: 'products' },
          config: { bindings: [{ integrationProvider: 'stripe' }] },
        },
      ],
    }),
    null,
  );
  assert.deepEqual(integrationTypes, ['stripe']);
});

// ─── THE MECHANISM REFUSES WHEN IT SHOULD ────────────────────────────────────

test('REFUSE: a hero with no collection reference collects nothing, and never an empty id', () => {
  for (const [label, hero] of [
    ['absent hero', undefined],
    ['plain authored-label hero', { variant: 'minimal', title: 'About' }],
    ['feature-item with no id', { variant: 'feature-item', title: 'Tonight', featureItem: {} }],
    ['empty-string id', { variant: 'feature-item', featureItem: { collectionId: '' } }],
    ['whitespace-only id', { variant: 'feature-item', featureItem: { collectionId: '   ' } }],
    ['non-string id', { variant: 'feature-item', featureItem: { collectionId: 42 } }],
  ] as const) {
    assert.deepEqual(collectTargets(page({ hero }), bucketsLike({})).collectionIds, [], label);
  }
});

test('the id is collected TRIMMED, because that is the key the renderer asks for', () => {
  // `resolveFeatureItem` reads the id through `heroText`, which trims
  // (vivreal-site-renderer master d2430d5, `resolveHero.ts:262`, read
  // 2026-09-30). `buildPageContext` keys `itemsByCollection` by the id this
  // collector returned. Collect `' col_shows '` verbatim and the map holds a
  // key `getItems('col_shows')` never asks for: a padded id would prefetch the
  // collection and STILL render the empty hero.
  const p = page({ hero: { variant: 'feature-item', featureItem: { collectionId: '  col_shows  ' } } });

  assert.deepEqual(collectTargets(p, bucketsLike({})).collectionIds, ['col_shows']);
});

test('a collection the hero shares with a binding is fetched ONCE', () => {
  const p = page({
    collections: [{ collectionId: 'col_shows', role: 'primary' }],
    hero: { variant: 'feature-item', featureItem: { collectionId: 'col_shows' } },
  });

  assert.deepEqual(
    collectTargets(p, bucketsLike(p)).collectionIds,
    ['col_shows'],
    'the accidental-resolution page must not grow a duplicate fetch now that both readers are collected',
  );
});

// ─── THE FIX DOES NOT NAME ONE VARIANT ───────────────────────────────────────

test('GENERALISES: a hero collection reference NOT called featureItem is collected too', () => {
  // `'feature-item'` is the first hero variant to read a collection and is
  // explicitly not expected to be the last (vivreal-site-renderer
  // `types/SiteData.ts`: "All twenty previously shipped variants take AUTHORED
  // labels; not one reads a collection, and that is the gap"). A collector
  // that matched `featureItem` by name would have to be re-landed for the next
  // one, and until it was, that variant would ship the same silent empty hero.
  const p = page({
    hero: { variant: 'some-future-variant', spotlight: { collectionId: 'col_looks' } },
  });

  assert.deepEqual(collectTargets(p, bucketsLike({})).collectionIds, ['col_looks']);
});

test('GENERALISES: nested and repeated hero references are collected and deduped', () => {
  const p = page({
    hero: {
      variant: 'feature-item',
      featureItem: { collectionId: 'col_shows' },
      panels: [{ collectionId: 'col_looks' }, { inner: { collectionId: 'col_shows' } }],
    },
  });

  assert.deepEqual(collectTargets(p, bucketsLike({})).collectionIds.sort(), ['col_looks', 'col_shows']);
});

test('REFUSE: the hero walk is depth-bounded, so a cyclic or absurd hero cannot hang the render', () => {
  // A self-referencing object is not something the wire produces, but the walk
  // runs on unvalidated CMS data on every generic page render, so "cannot hang"
  // has to be a property of the walker rather than of the data.
  const hero: Record<string, unknown> = { variant: 'feature-item', featureItem: { collectionId: 'col_shows' } };
  hero.self = hero;

  const { collectionIds } = collectTargets(page({ hero }), bucketsLike({}));

  assert.deepEqual(collectionIds, ['col_shows']);
});

// ─── THE EXTRACTION CHANGED NOTHING ELSE ─────────────────────────────────────

test('legacy path: collections, integrations and the products filter collection', () => {
  const p = page({
    collectionId: 'col_filters',
    collections: [{ collectionId: 'col_a', role: 'primary' }, { collectionId: 'col_b', role: 'sidebar' }],
    integrations: [{ type: 'Stripe', role: 'primary' }, { name: 'TikTok', role: 'secondary' }],
  });

  const { collectionIds, integrationTypes } = collectTargets(p, bucketsLike(p));

  assert.deepEqual(collectionIds.sort(), ['col_a', 'col_b', 'col_filters']);
  assert.deepEqual(integrationTypes.sort(), ['stripe', 'tiktok']);
});

test('legacy path: a binding with an UNRECOGNISED role is still dropped', () => {
  // Not an endorsement, a pin. `getPageBindingsByRole` buckets on four literal
  // role names, so a binding carrying anything else lands in no bucket and is
  // never collected. Threading the real buckets through `collectTargets`
  // (rather than re-unioning `page.collections`) is what preserves that; this
  // test fails if the extraction quietly widened it.
  const p = page({ collections: [{ collectionId: 'col_odd', role: 'hero' }] });

  assert.deepEqual(collectTargets(p, bucketsLike(p)).collectionIds, []);
});

test('blocks-first path: nested group children, and page.collectionId is NOT added', () => {
  const p = page({
    collectionId: 'col_legacy',
    blocks: [
      {
        id: 'g',
        type: { kind: 'group' },
        config: {
          children: [
            { id: 'c', type: { kind: 'collection' }, config: { bindings: [{ collectionId: 'col_nested' }] } },
          ],
        },
      },
      { id: 'i', type: { kind: 'integration' }, config: { bindings: [{ integrationProvider: 'Stripe' }] } },
      { id: 'noconfig', type: { kind: 'collection' } },
    ],
  });

  const { collectionIds, integrationTypes } = collectTargets(p, null);

  assert.deepEqual(collectionIds, ['col_nested'], 'page.collectionId stays legacy-only (R2 fuses it onto the block)');
  assert.deepEqual(integrationTypes, ['stripe']);
});

// ─── CHECK THE CALLER ────────────────────────────────────────────────────────

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('SOURCE PIN: collectBindingTargets delegates, so the tested collector is the one that runs', () => {
  // `./bindings.ts` imports `server-only`, which is not installed (Next
  // provides it). Measured 2026-09-30: importing it under
  // `node --experimental-strip-types` fails ERR_MODULE_NOT_FOUND. So the only
  // way to hold the production entry point to the behaviour above is to pin
  // that it still delegates rather than growing a second implementation.
  const code = source('./bindings.ts');
  assert.ok(code.includes('collectTargets('), 'the verdict must come from the pure, tested ./bindingTargets.ts');
  assert.ok(
    /return collectTargets\(page,/.test(code),
    'the WHOLE page must be threaded through; passing only page.blocks would drop page.hero again',
  );
});

test('SOURCE PIN: buildPageContext fetches the collected ids and keys the map by the SAME id', () => {
  // The end of the chain. A collected id is worth nothing unless it reaches
  // `getCollectionItems` AND lands in `itemsByCollection` under the identical
  // string, because `resolveFeatureItem` looks the hero's collection up by
  // that exact key.
  const code = source('./buildPageContext.ts');
  assert.ok(code.includes('collectBindingTargets(page)'), 'the page context must ask the collector');
  assert.ok(
    /collectionIds\.map\(async \(id\) => \{[\s\S]*?getCollectionItems\(id,/.test(code),
    'every collected id must be fetched',
  );
  assert.ok(
    /collectionEntries\.map\(\(\{ key, items \}\) => \[key, items\]\)/.test(code),
    'the fetched items must be keyed by the collected id, unmodified',
  );
  assert.ok(
    /getItems: \(id\) => itemsByCollection\.get\(id\)/.test(code),
    'and read back by that same id; this is the link the trim test depends on',
  );
});

test('SOURCE PIN: the legacy role buckets', () => {
  // `bucketsLike` above stands in for `getPageBindingsByRole`. If the real one
  // stops bucketing on these four names, the double is lying and the legacy
  // tests in this file stop meaning anything.
  const code = source('../siteData/index.tsx');
  const fn = code.slice(code.indexOf('export function getPageBindingsByRole'));
  for (const role of ['primary', 'secondary', 'supplemental', 'sidebar']) {
    assert.ok(fn.includes(`${role}: {`), `getPageBindingsByRole must still bucket '${role}'`);
  }
  assert.ok(fn.includes("(c.role ?? 'primary') === 'primary'"), 'unroled collections must still default to primary');
});
