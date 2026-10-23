/**
 * Build-time recorder of the reads the render floor will hold.
 * vivreal-hq docs/bugs/site-first-read-fallback/plan.md, section 3 (Option A,
 * step 2) and Change 2.
 *
 * INERT UNLESS THE BUILD WRAPPER TURNED IT ON. It records only when
 * `VIVREAL_SNAPSHOT_RECORD_DIR` is set, which `scripts/build-with-snapshot.mjs`
 * does for the `next build` it spawns and nothing else does. The deployed
 * server, `next start`, a plain `next build` and every test leave it off.
 *
 * WHAT IT RECORDS. Every SUCCESSFUL read of a floor-eligible path
 * (`./eligibility.ts`), once per path per process, called by the seam
 * (`./seam.ts`) outside the `unstable_cache` closure, so a read the build
 * served from its own data cache is recorded too. Preview reads and opted-out
 * reads (products, the filter list) never reach it.
 *
 * SERIALISED AT RECORD TIME. Callers mutate what a read hands back; the JSON
 * written is what the read returned, not what the caller later made of it.
 *
 * ONE FILE PER RECORDED PATH, written to a temp name and renamed (atomic on
 * one filesystem), named `shard-<pid>-<threadId>-<random>-<n>.json` so build
 * workers (processes and threads) never collide. One file per path rather
 * than one growing shard per worker keeps the bytes written linear in the
 * snapshot size; rewriting a whole shard on every new path is quadratic on a
 * large catalogue. The wrapper merges them.
 *
 * Node-only (`fs`), and only ever loaded on the Node runtime through
 * `../client.ts`. The file system and identity are injectable for tests (T6).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { threadId as workerThreadId } from 'node:worker_threads';
import { RECORD_DIR_ENV } from './constants.ts';
import { isFloorEligiblePath } from './eligibility.ts';

export interface SnapshotRecorder {
  /** Record one successful read. A no-op when inert, ineligible, or already recorded. */
  record(readPath: string, value: unknown): void;
  /** Write one fill-pass manifest shard (expected keys, excluded ids). A no-op when inert. */
  writeManifest(manifest: object): void;
  /** True when this process is recording (the build wrapper set the env var). */
  readonly active: boolean;
}

export interface SnapshotRecorderOptions {
  /** The record directory; the env var when omitted. */
  readonly dir?: string | undefined;
  readonly siteId: string;
  readonly writeFile?: (file: string, text: string) => void;
  readonly rename?: (from: string, to: string) => void;
}

export function createSnapshotRecorder(options: SnapshotRecorderOptions): SnapshotRecorder {
  const dir = 'dir' in options ? options.dir : process.env[RECORD_DIR_ENV];
  const writeFile = options.writeFile ?? ((file: string, text: string) => fs.writeFileSync(file, text, 'utf8'));
  const rename = options.rename ?? ((from: string, to: string) => fs.renameSync(from, to));
  const shardId = `${process.pid}-${workerThreadId}-${randomBytes(6).toString('hex')}`;
  const recorded = new Set<string>();
  let seq = 0;

  const writeAtomically = (prefix: string, text: string) => {
    seq += 1;
    const final = path.join(dir as string, `${prefix}-${shardId}-${seq}.json`);
    const tmp = `${final}.tmp`;
    writeFile(tmp, text);
    rename(tmp, final);
  };

  return {
    get active() {
      return !!dir;
    },
    record(readPath, value) {
      if (!dir) return;
      if (value === undefined || recorded.has(readPath)) return;
      if (!isFloorEligiblePath(readPath, options.siteId, [])) return;
      const text = JSON.stringify({ path: readPath, data: value });
      recorded.add(readPath);
      writeAtomically('shard', text);
    },
    writeManifest(manifest) {
      if (!dir) return;
      writeAtomically('manifest', JSON.stringify(manifest));
    },
  };
}
