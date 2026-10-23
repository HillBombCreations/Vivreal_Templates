/**
 * The one seam every cached VR_Client_API read goes through, with the render
 * floor wired in. `clientFetchCached` (`../client.ts`) is the thin call site:
 * it supplies the Next-bound pieces (the `unstable_cache` read, the preview
 * read, Sentry) and this module decides. Plain module, so `node --test`
 * drives the whole decision (T2, T6, T15) rather than a copy of it.
 * vivreal-hq docs/bugs/site-first-read-fallback/plan.md, Change 3.
 *
 * The order, and why:
 *  1. A preview read (draft mode, per-session token) goes its own way, before
 *     anything here: never cached, never recorded, never floored.
 *  2. A FORCED floor (the temporary QA branch only, `./floor.ts` `isForced`)
 *     answers every eligible read from the snapshot without going upstream.
 *     This is the release gate's positive control (plan 5.6).
 *  3. Otherwise the live read runs through the failure memo. On success the
 *     value is recorded for the build's snapshot (inert outside the build),
 *     here, outside the `unstable_cache` closure, so a build-time cache hit is
 *     recorded as well.
 *  4. On failure the caller's handler runs first (it re-throws a 402 and sends
 *     the capture: a live-read failure stays a real signal), then the floor is
 *     asked for this exact path. A hit is returned and logged as
 *     `site.snapshot.floor`; a miss falls through to today's fallback and its
 *     log lines. The memo short-circuit and a failed join ask the floor too.
 */
import type { FailureMemo, MemoFloorReason } from '../failureMemo.ts';
import { readWithFailureMemo } from '../failureMemo.ts';
import type { FloorReason, SnapshotFloor } from './floor.ts';
import type { SnapshotRecorder } from './recorder.ts';

export interface FloorSeamDeps {
  readonly memo: FailureMemo;
  readonly floor: SnapshotFloor;
  readonly recorder: SnapshotRecorder;
  readonly now: () => number;
  /** True inside an ISR regeneration, null when that cannot be read. For the log line only. */
  readonly revalidation: () => boolean | null;
}

export interface FloorSeamRead<T> {
  readonly path: string;
  readonly fallback: T;
  /** `{ floor: false }` from the caller: products and the filter list never use the floor. */
  readonly floorOptOut: boolean;
  /** Set for a preview request: the uncached read to run instead of everything below. */
  readonly preview: (() => Promise<T>) | null;
  /** The live read (in production, the `unstable_cache`-wrapped fetch). */
  readonly read: () => Promise<T>;
  /** First on any failure: re-throw what must propagate (a 402), capture the rest. */
  readonly onFailure: (err: unknown) => void;
  /** Only when the fallback is returned: today's "returning fallback" log lines. */
  readonly onFallback: (err: unknown) => void;
}

export async function readCachedWithFloor<T>(deps: FloorSeamDeps, req: FloorSeamRead<T>): Promise<T> {
  if (req.preview) return req.preview();

  deps.floor.notePresence();

  const answerFromFloor = (reason: FloorReason, elapsedMs: number | null): T | undefined => {
    if (req.floorOptOut) return undefined;
    const found = deps.floor.lookup<T>(req.path);
    if (!found.hit) return undefined;
    deps.floor.noteAnswer(req.path, { reason, revalidation: deps.revalidation(), elapsedMs });
    return found.value;
  };

  if (!req.floorOptOut && deps.floor.isForced()) {
    const forced = answerFromFloor('forced', null);
    if (forced !== undefined) return forced;
  }

  const startedAt = deps.now();
  return readWithFailureMemo<T>(
    deps.memo,
    req.path,
    async () => {
      const value = await req.read();
      if (!req.floorOptOut) deps.recorder.record(req.path, value);
      return value;
    },
    req.fallback,
    (err) => {
      req.onFailure(err);
      const floor = answerFromFloor('own_read', deps.now() - startedAt);
      if (floor !== undefined) return floor;
      req.onFallback(err);
      return req.fallback;
    },
    (reason: MemoFloorReason) => answerFromFloor(reason, deps.now() - startedAt),
  );
}
