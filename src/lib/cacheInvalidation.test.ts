import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { HARD_INVALIDATION } from './cacheInvalidation.ts';

/**
 * These tests drive Next's REAL revalidation path end to end rather than
 * asserting the literal argument the route passes:
 *
 *   executeRevalidates()            -- Next's real profile -> durations mapping
 *     -> FileSystemCache.revalidateTag()  -- Next's real tag-manifest write
 *       -> areTagsExpired()/areTagsStale() -- Next's real read-side predicates
 *
 * `areTagsExpired` is the predicate the incremental cache consults to decide
 * whether a cached entry is DROPPED. `areTagsStale` only decides whether it is
 * served once more while a background refetch runs. The defect this fixes was
 * that the site's invalidation only ever moved the second needle.
 *
 * These import Next internals on purpose: the whole point is that the fix
 * depends on how Next 16 treats the profile, not on how our call site is
 * spelled. `next` is pinned `~16.3.0`; if a Next upgrade moves these modules
 * the suite fails loudly, which is the correct signal.
 */
import { executeRevalidates } from 'next/dist/server/revalidation-utils.js';
import {
  tagsManifest,
  areTagsExpired,
  areTagsStale,
} from 'next/dist/server/lib/incremental-cache/tags-manifest.external.js';
import * as fileSystemCacheModule from 'next/dist/server/lib/incremental-cache/file-system-cache.js';
import { defaultConfig } from 'next/dist/server/config-shared.js';
import type { WorkStore } from 'next/dist/server/app-render/work-async-storage.external';

type TagDurations = { expire?: number };
type TagManifestEntry = { stale?: number; expired?: number };
type FileSystemCacheClass = new (ctx: Record<string, unknown>) => {
  revalidateTag(tags: string[], durations?: TagDurations): Promise<void>;
};

// `as`: CommonJS default-interop. `node --experimental-strip-types` resolves
// this module's default binding to `module.exports`, so the class can sit one
// level deeper than the shipped .d.ts claims. Probe both shapes.
const fileSystemCacheNamespace = fileSystemCacheModule as unknown as {
  default: FileSystemCacheClass | { default: FileSystemCacheClass };
};
const FileSystemCache: FileSystemCacheClass =
  'default' in fileSystemCacheNamespace.default
    ? fileSystemCacheNamespace.default.default
    : fileSystemCacheNamespace.default;

// Next's own shipped cacheLife table, so the 'max' comparison below uses the
// real profile and not a number invented by this test.
const cacheLifeProfiles = defaultConfig.cacheLife;

const TAG = 'site:68d1146a4e1b46a9083e6680';

/** Run one revalidation through Next and return what it wrote to the manifest. */
async function revalidateWith(profile: unknown): Promise<TagManifestEntry> {
  tagsManifest.clear();
  const cache = new FileSystemCache({});
  // `as unknown as WorkStore`: executeRevalidates only reads `incrementalCache`
  // and `cacheLifeProfiles` off the store, but WorkStore declares ~30 fields a
  // real render would populate. Building all of them would test nothing extra.
  const workStore = {
    incrementalCache: {
      revalidateTag: (tags: string[], durations?: TagDurations) =>
        cache.revalidateTag(tags, durations),
    },
    cacheLifeProfiles,
  } as unknown as WorkStore;
  // `as`: RevalidationState is not exported from revalidation-utils.
  const state = {
    pendingRevalidatedTags: [{ tag: TAG, profile, revalidatedAt: Date.now() }],
    pendingRevalidates: {},
    pendingRevalidateWrites: [],
  } as unknown as Parameters<typeof executeRevalidates>[1];

  await executeRevalidates(workStore, state);

  // Next writes `expired` from `Date.now()` (file-system-cache.js) but reads
  // `now` from `performance.timeOrigin + performance.now()`
  // (tags-manifest.external.js). Those two clocks are not the same clock: the
  // performance one was measured up to ~0.9ms BEHIND `Date.now()` on the dev
  // machine, so for under a millisecond after the write `expiredAt <= now` can
  // still read false. Production never sees this -- the render that consults
  // the manifest happens long after the webhook POST that wrote it -- but a
  // test that reads back instantly would be a coin flip. Step past it rather
  // than weaken the assertion.
  await delay(25);

  return tagsManifest.get(TAG) as TagManifestEntry;
}

// A cache entry written a minute before the edit. This is the `timestamp`
// argument the incremental cache passes: the entry's own creation time.
const entryWrittenAt = () => Date.now() - 60_000;

test('the shipped profile EXPIRES the tag, it does not merely mark it stale', async () => {
  const entry = await revalidateWith(HARD_INVALIDATION);
  const timestamp = entryWrittenAt();

  assert.equal(
    areTagsExpired([TAG], timestamp),
    true,
    'the cached entry must be dropped, so the next render refetches',
  );
  assert.equal(
    typeof entry.expired,
    'number',
    'an expiry must actually be written to the tag manifest',
  );
  assert.ok(
    entry.expired! <= Date.now(),
    `expiry must already be in the past, got ${entry.expired! - Date.now()}ms in the future`,
  );
});

test("'max' does NOT expire the tag — the defect this fix removes", async () => {
  const entry = await revalidateWith('max');
  const timestamp = entryWrittenAt();

  // 'max' marks the entry stale, which reads as "invalidation worked"...
  assert.equal(areTagsStale([TAG], timestamp), true);
  // ...but the entry survives, so the pre-edit bytes are served at least once
  // more. This is the assertion that fails if anyone reverts the fix.
  assert.equal(
    areTagsExpired([TAG], timestamp),
    false,
    "'max' is a soft invalidation; if this ever returns true, Next changed and the fix should be re-derived",
  );
  assert.ok(
    entry.expired! > Date.now(),
    "'max' pushes the expiry into the future instead of dropping the entry",
  );
});

test('the two profiles are genuinely different at the manifest level', async () => {
  const hard = await revalidateWith(HARD_INVALIDATION);
  const soft = await revalidateWith('max');
  assert.ok(
    soft.expired! - hard.expired! > 24 * 60 * 60 * 1000,
    'the soft profile defers expiry by more than a day; that gap IS the bug',
  );
});

/**
 * Wiring pin: the behaviour above is only reached if the route actually passes
 * the tested profile. `route.ts` imports `next/server` so `node --test` cannot
 * load it (same tradeoff as src/app/[slug]/page.test.ts).
 */
const routeSource = fs.readFileSync(
  new URL('../app/api/revalidate/route.ts', import.meta.url),
  'utf8',
);

test('the revalidate route invalidates through the tested profile', () => {
  assert.match(
    routeSource,
    /import \{ HARD_INVALIDATION \} from "@\/lib\/cacheInvalidation"/,
    'the route must use the profile these tests exercise',
  );
  assert.match(routeSource, /revalidateTag\(tag, HARD_INVALIDATION\)/);
});

test('the route no longer uses the soft profile', () => {
  assert.doesNotMatch(
    routeSource,
    /revalidateTag\([^)]*"max"\)/,
    "'max' leaves one guaranteed stale serve after a customer's edit",
  );
});
