/**
 * The build-time fill pass: make, once per build and through the real
 * readers, the reads no prerender makes, and write the manifest that says
 * which keys the floor is EXPECTED to hold.
 * vivreal-hq docs/bugs/site-first-read-fallback/plan.md, section 5.2 and
 * Change 2 (review-2 note 1 folded in: rows 1 and 2 are listed too).
 *
 * WHY IT EXISTS. The recorder only sees reads the build makes. The prerender
 * of `/` and `/[slug]` makes rows 1 and 2 (the key shapes behind all 137
 * failed reads measured 10-16 to 10-23), but three kinds of read are made only
 * by a route the build never prerenders:
 *   row 4: the bindings of a nested two-level page (`slug: "features/ai-sites"`,
 *          served by the dynamic detail route);
 *   row 5: a product detail page's supplemental feeds (`limit=10`);
 *   row 6: a detail page's context collection.
 * This pass makes those reads in `generateStaticParams` (which runs once per
 * build with the site data in hand), so the recorder records them.
 *
 * THE MANIFEST. Every key the floor should hold for this site (rows 1, 2, 4,
 * 5, 6), the storefront collection ids to drop (row 7, owner decision 2) and
 * the policy values the build wrapper needs. The wrapper prints
 * `snapshot_uncovered` = expected keys with no recorded entry: a read that
 * failed at build, or a binding to a collection that no longer exists. That
 * is what makes a row-2 read that failed DURING the build visible instead of
 * a silent hole in the floor.
 *
 * KEYS ARE BUILT, NEVER WRITTEN. Every expected key comes from
 * `../readPaths.ts`, the builders the runtime readers use, and which
 * integration reads go through the product bridge comes from
 * `usesProductBridge`, which `buildPageContext` uses too. A key spelled here
 * and a key the runtime asks for cannot differ.
 *
 * NEVER THROWS, AND NEVER HIDES A FAILED READ (review-3 B1, B2).
 * - A read counts as FAILED when it threw OR resolved degraded: the real
 *   readers resolve a placeholder on an upstream 5xx rather than throw, and
 *   a nested page context reports its own `listReadFailed`. Each failed read
 *   is retried once, one at a time, after a short pause; what still fails is
 *   logged by query-free path plus hash and listed in the manifest's
 *   `failedKeys`. Its key stays unrecorded, so the wrapper counts it in
 *   `snapshot_uncovered` and the rollout gate stops a live app with holes.
 * - If PLANNING throws (one malformed page config is enough), a minimal
 *   manifest is written instead: the siteDetails key only and
 *   `fillError: true`. The wrapper then keeps only the site shell, prints
 *   `snapshot_fill_error` and counts it as uncovered, and the build still
 *   succeeds on a valid siteDetails, so a bad page config never blocks every
 *   save rebuild.
 *
 * Plain module. The readers are injected (they import `server-only`), so
 * `node --test` drives the planner and the executor (T16).
 */
import { createHash } from 'node:crypto';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { isPaymentsProvider, PAYMENTS_PROVIDER_TYPES } from '../../payments.ts';
import { isPageTurnedOff } from '../../pages/pageEnabled.ts';
import { slugsForStaticParams } from '../../pages/staticParams.ts';
import { NON_NESTABLE_FORMATS } from '../../pages/nestedItemRoute.ts';
import { readsProviderProduct } from '../../detail/storefrontSources.ts';
import { collectionObjectsPath, integrationObjectsPath, siteDetailsPath } from '../readPaths.ts';
import { FORCE_FLOOR_SITE_IDS } from './constants.ts';
import { collectionIdOf } from './eligibility.ts';
import { storefrontCollectionIds } from './storefrontExclusion.ts';

/** The page-list read size every composed page uses (`buildPageContext`). */
export const PAGE_LIST_LIMIT = 100;
/** The product detail page's supplemental feed size (`[slug]/[itemId]/page.tsx`). */
export const SUPPLEMENTAL_FEED_LIMIT = 10;

/**
 * At most this many fill reads in flight at once. Measured, Phase 0a
 * (2026-10-23): vivreal.io's fill pass is 66 list reads plus 17 nested page
 * contexts, and fired all at once it drew 25 HTTP 503s and one 500 from the
 * production Client API in under a second, every one inside the fill pass and
 * none in the prerender after it. A failed fill read is a hole in the floor
 * until the next build, and a burst like that lands on every fleet build. A
 * nested page context is itself several parallel reads, so the effective
 * ceiling is a small multiple of this.
 */
export const FILL_CONCURRENCY = 4;

/** Pause before the one sequential retry of the fill reads that failed. */
export const FILL_RETRY_DELAY_MS = 2_000;

/** Run `tasks` with at most `limit` in flight; every task is settled, none rejects the whole. */
export async function settleWithConcurrency(
  tasks: ReadonlyArray<() => Promise<unknown>>,
  limit: number,
): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next;
      next += 1;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
  return results;
}

/**
 * True when a page's integration binding is read through the product bridge
 * (`getProductsAsContentItems`, never floored) rather than as a plain
 * `integrationObjects` list. Shared with `buildPageContext`, so the fill pass
 * expects exactly the plain reads the page makes.
 */
export function usesProductBridge(type: string, pageFormat: string | undefined): boolean {
  return isPaymentsProvider(type) || pageFormat === 'products';
}

export interface BindingTargetsLike {
  readonly collectionIds: readonly string[];
  readonly integrationTypes: readonly string[];
}

export interface FillManifest {
  readonly version: 1;
  readonly siteId: string;
  /** Row 1: the key whose absence fails the build. */
  readonly siteDetailsKey: string;
  /** Rows 1, 2, 4, 5 and 6, deduplicated, minus every key naming an excluded collection. */
  readonly expectedKeys: readonly string[];
  /** Row 7: collections a storefront sells. Dropped at merge, refused at runtime. */
  readonly excludedCollectionIds: readonly string[];
  /** For the wrapper's check that no provider-product key survived the merge. */
  readonly paymentsProviderTypes: readonly string[];
  /** For the wrapper's forced-floor guard (plan 5.6), one source with the runtime's. */
  readonly forceFloorSiteIds: readonly string[];
}

export interface FillPlan {
  readonly manifest: FillManifest;
  /** Row 2: the plain list reads of home and every prerendered single-segment page. */
  readonly pageListReads: readonly ListRead[];
  /** Row 4: nested pages, read through the same `buildPageContext` the detail route renders them with. */
  readonly nestedPages: readonly PageConfig[];
  /** Row 5: supplemental feed types, read at `limit=10`. */
  readonly supplementalTypes: readonly string[];
  /** Row 6: detail context collections, read at `limit=100`. */
  readonly contextCollectionIds: readonly string[];
}

export type ListRead =
  | { readonly kind: 'collection'; readonly id: string }
  | { readonly kind: 'integration'; readonly type: string };

function listReadsOf(page: PageConfig, targets: BindingTargetsLike): ListRead[] {
  return [
    ...targets.collectionIds.map((id): ListRead => ({ kind: 'collection', id })),
    ...targets.integrationTypes
      .filter((type) => !usesProductBridge(type, page.format))
      .map((type): ListRead => ({ kind: 'integration', type })),
  ];
}

function keyOf(read: ListRead): string {
  return read.kind === 'collection'
    ? collectionObjectsPath(read.id, { limit: PAGE_LIST_LIMIT })
    : integrationObjectsPath(read.type, { limit: PAGE_LIST_LIMIT });
}

export function planSnapshotFill(input: {
  readonly siteId: string;
  readonly siteData: Pick<SiteData, 'pageConfigs' | 'homePageConfig'>;
  readonly targetsOf: (page: PageConfig) => BindingTargetsLike;
}): FillPlan {
  const pages = (input.siteData.pageConfigs ?? []).filter(Boolean);
  const home = input.siteData.homePageConfig ?? null;
  const allPages = home ? [home, ...pages] : pages;

  // Row 2: exactly the pages the build prerenders. The slug set is the one
  // `generateStaticParams` itself returns, so this cannot drift from it.
  const prerendered = new Set(slugsForStaticParams(pages));
  const prerenderedPages = [...(home ? [home] : []), ...pages.filter((p) => !!p.slug && prerendered.has(p.slug))];
  const pageListReads = prerenderedPages.flatMap((page) => listReadsOf(page, input.targetsOf(page)));

  // Row 4: nested pages the detail route serves (the same three gates it applies before rendering).
  const nestedPages = pages.filter(
    (p) => !!p.slug && p.slug.includes('/') && !isPageTurnedOff(p) && !NON_NESTABLE_FORMATS.has(p.format ?? ''),
  );
  const nestedReads = nestedPages.flatMap((page) => listReadsOf(page, input.targetsOf(page)));

  const servedPages = allPages.filter((p) => !isPageTurnedOff(p));

  // Row 5: a storefront page's product detail renders its non-payments
  // `detailPage.integrations` as supplemental feeds.
  const supplementalTypes = new Set<string>();
  for (const page of servedPages) {
    const paymentsProvider = input.targetsOf(page).integrationTypes.find((t) => isPaymentsProvider(t));
    if (!readsProviderProduct(page, paymentsProvider)) continue;
    for (const binding of page.detailPage?.integrations ?? []) {
      const type = (binding.type ?? binding.name ?? '').toLowerCase();
      if (type && !isPaymentsProvider(type)) supplementalTypes.add(type);
    }
  }

  // Row 6: the context collection `resolveDetailContext` reads, under the same
  // three conditions it reads it.
  const contextCollectionIds = new Set<string>();
  for (const page of servedPages) {
    const context = page.detailPage?.context;
    if (context?.collectionId && context.match?.field && typeof context.match?.value === 'string') {
      contextCollectionIds.add(context.collectionId);
    }
  }

  const excludedCollectionIds = storefrontCollectionIds(allPages, (page) => input.targetsOf(page).integrationTypes);
  const siteDetailsKey = siteDetailsPath(input.siteId);
  const expected = new Set<string>([
    siteDetailsKey,
    ...pageListReads.map(keyOf),
    ...nestedReads.map(keyOf),
    ...[...supplementalTypes].map((type) => integrationObjectsPath(type, { limit: SUPPLEMENTAL_FEED_LIMIT })),
    ...[...contextCollectionIds].map((id) => collectionObjectsPath(id, { limit: PAGE_LIST_LIMIT })),
  ]);
  const expectedKeys = [...expected].filter((key) => {
    const id = collectionIdOf(key);
    return !id || !excludedCollectionIds.includes(id);
  });

  return {
    manifest: {
      version: 1,
      siteId: input.siteId,
      siteDetailsKey,
      expectedKeys,
      excludedCollectionIds,
      paymentsProviderTypes: [...PAYMENTS_PROVIDER_TYPES],
      forceFloorSiteIds: [...FORCE_FLOOR_SITE_IDS],
    },
    pageListReads,
    nestedPages,
    supplementalTypes: [...supplementalTypes],
    contextCollectionIds: [...contextCollectionIds],
  };
}

export interface FillDeps {
  readonly siteId: string;
  readonly recorder: { readonly active: boolean; writeManifest(manifest: object): void };
  readonly targetsOf: (page: PageConfig) => BindingTargetsLike;
  readonly getCollectionItems: (collectionId: string, opts: { limit: number }) => Promise<unknown>;
  readonly getIntegrationItems: (type: string, opts: { limit: number }) => Promise<unknown>;
  readonly buildNestedPageContext: (page: PageConfig) => Promise<unknown>;
  readonly log: (line: string) => void;
  /** Reads in flight at once; `FILL_CONCURRENCY` when omitted. */
  readonly concurrency?: number;
  /** The pause before the retry; injectable for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** One fill read, and the snapshot keys it is responsible for. */
interface FillTask {
  readonly run: () => Promise<unknown>;
  readonly keys: readonly string[];
}

/**
 * Did this read happen? A reader that threw did not; neither did one that
 * resolved its degraded placeholder (`degraded: true`, every list reader on an
 * upstream 5xx) or a page context whose list reads failed (`listReadFailed`).
 */
function readFailed(result: PromiseSettledResult<unknown>): boolean {
  if (result.status === 'rejected') return true;
  const value = result.value as { degraded?: unknown; listReadFailed?: unknown } | null | undefined;
  return value?.degraded === true || value?.listReadFailed === true;
}

const keyHash = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 12);
const stripQuery = (key: string) => key.split('?')[0];

/** The manifest written when planning itself threw: the site shell and nothing else. */
function shellOnlyManifest(siteId: string): FillManifest & { readonly fillError: true } {
  const siteDetailsKey = siteDetailsPath(siteId);
  return {
    version: 1,
    siteId,
    siteDetailsKey,
    expectedKeys: [siteDetailsKey],
    excludedCollectionIds: [],
    paymentsProviderTypes: [...PAYMENTS_PROVIDER_TYPES],
    forceFloorSiteIds: [...FORCE_FLOOR_SITE_IDS],
    fillError: true,
  };
}

/**
 * Run the fill pass: inert unless the recorder is recording (the build
 * wrapper's `next build`). Resolves, never rejects.
 */
export async function fillSnapshotAtBuild(
  siteData: Pick<SiteData, 'pageConfigs' | 'homePageConfig'>,
  deps: FillDeps,
): Promise<void> {
  if (!deps.recorder.active) return;
  let plan: FillPlan;
  try {
    plan = planSnapshotFill({ siteId: deps.siteId, siteData, targetsOf: deps.targetsOf });
  } catch (err) {
    // B2: a planner fault (a malformed page config) must not fail the build.
    // The shell-only manifest keeps siteDetails required and makes the fault
    // visible as `snapshot_fill_error` (counted uncovered) on the job line.
    deps.recorder.writeManifest(shellOnlyManifest(deps.siteId));
    deps.log(
      JSON.stringify({ event: 'site.snapshot.fill', fillError: true, error: String((err as Error)?.message ?? err) }),
    );
    return;
  }
  // The manifest first: if a read below hangs the build out, the wrapper
  // still knows what was expected.
  deps.recorder.writeManifest(plan.manifest);

  const listKey = (read: ListRead) =>
    read.kind === 'collection'
      ? collectionObjectsPath(read.id, { limit: PAGE_LIST_LIMIT })
      : integrationObjectsPath(read.type, { limit: PAGE_LIST_LIMIT });
  const tasks: FillTask[] = [
    ...plan.pageListReads.map((read) => ({
      run: () =>
        read.kind === 'collection'
          ? deps.getCollectionItems(read.id, { limit: PAGE_LIST_LIMIT })
          : deps.getIntegrationItems(read.type, { limit: PAGE_LIST_LIMIT }),
      keys: [listKey(read)],
    })),
    ...plan.nestedPages.map((page) => ({
      run: () => deps.buildNestedPageContext(page),
      keys: listReadsOf(page, deps.targetsOf(page)).map(listKey),
    })),
    ...plan.supplementalTypes.map((type) => ({
      run: () => deps.getIntegrationItems(type, { limit: SUPPLEMENTAL_FEED_LIMIT }),
      keys: [integrationObjectsPath(type, { limit: SUPPLEMENTAL_FEED_LIMIT })],
    })),
    ...plan.contextCollectionIds.map((id) => ({
      run: () => deps.getCollectionItems(id, { limit: PAGE_LIST_LIMIT }),
      keys: [collectionObjectsPath(id, { limit: PAGE_LIST_LIMIT })],
    })),
  ];

  const first = await settleWithConcurrency(tasks.map((t) => t.run), deps.concurrency ?? FILL_CONCURRENCY);
  let failedTasks = tasks.filter((_, i) => readFailed(first[i]));
  const firstPassFailed = failedTasks.length;
  if (failedTasks.length > 0) {
    // One retry each, one at a time, after a pause: a burst of 5xx is most
    // often a passing capacity limit, and a hole here lasts until next build.
    await (deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(FILL_RETRY_DELAY_MS);
    const retried = await settleWithConcurrency(failedTasks.map((t) => t.run), 1);
    failedTasks = failedTasks.filter((_, i) => readFailed(retried[i]));
  }
  const failedKeys = [...new Set(failedTasks.flatMap((t) => t.keys))];
  if (failedKeys.length > 0) {
    // A second manifest shard carries what still failed; the wrapper unions them.
    deps.recorder.writeManifest({ ...plan.manifest, failedKeys });
  }
  deps.log(
    JSON.stringify({
      event: 'site.snapshot.fill',
      expected: plan.manifest.expectedKeys.length,
      reads: tasks.length,
      failedFirstPass: firstPassFailed,
      failed: failedTasks.length,
      failedKeys: failedKeys.map((k) => `${stripQuery(k)} ${keyHash(k)}`),
      nestedPages: plan.nestedPages.length,
      excludedCollections: plan.manifest.excludedCollectionIds.length,
    }),
  );
}
