/**
 * The render floor: answer a failed or empty live read from the build-time
 * site snapshot. vivreal-hq docs/bugs/site-first-read-fallback/plan.md,
 * sections 5.1, 5.5 and 5.6.
 *
 * WHAT IT IS. During `next build`, every successful floor-eligible read is
 * recorded by its exact path (`./recorder.ts`), and the build wrapper
 * (`scripts/build-with-snapshot.mjs`) writes the merged records into
 * `<distDir>/server/app/site-snapshot.json` inside the deploy artifact. At
 * runtime, when a live read and the per-instance data cache have both produced
 * nothing, `clientFetchCached` asks this module for that path. A local file
 * read cannot be freeze-killed and touches no network, so a render that used
 * to become the placeholder (or a 5xx) becomes the site as of its last build.
 *
 * ORDER OF ANSWERS, first that produces a value wins: the live read, the data
 * cache's last good value, THIS floor, the caller's fallback. The floor is
 * never preferred over either live tier and is never written into the data
 * cache, so the next read of the path goes live again.
 *
 * LAZY. The file is parsed on the first read that needs it, never on the
 * happy path. The only happy-path cost is `notePresence()`, once per
 * instance: one `stat` and one short read of the file's head (the fields
 * before `entries`), which is what logs `site.snapshot.present` and tells a
 * forced floor (5.6) apart from a normal one without a parse.
 *
 * EVERY ANSWER IS A FRESH CLONE, marked through `./floorValue.ts` so a caller
 * about to make a negative claim can tell it came from the floor. The parsed
 * snapshot is module scoped and shared across requests, and callers do
 * mutate what they get back.
 *
 * Plain module, no `server-only` and no `fs`: the file access, the clock and
 * the reporting sinks are injected, so `node --test` drives it (T7) and the
 * Node-only file reads live in `./snapshotFile.ts`.
 */
import { stripQueryString } from '../errorCapture.ts';
import { FORCE_FLOOR_SITE_IDS, SNAPSHOT_VERSION } from './constants.ts';
import { isFloorEligiblePath, keyShape } from './eligibility.ts';
import { markFloorValue } from './floorValue.ts';
import { pruneExpiredRichTextUrls } from './richTextExpiry.ts';

export interface SnapshotEntry {
  readonly data: unknown;
}

export interface SnapshotFile {
  readonly version: number;
  readonly siteId: string;
  readonly builtAt: string;
  readonly commit: string;
  readonly forceFloor: boolean;
  readonly excludedCollectionIds: readonly string[];
  readonly entries: Readonly<Record<string, SnapshotEntry>>;
}

/** Why a floor answer was given. `own_read` and the memo reasons come from the seam. */
export type FloorReason = 'own_read' | 'memo' | 'join' | 'values_missing' | 'forced';

export type FloorMissReason =
  | 'build'
  | 'opted_out'
  | 'ineligible'
  | 'missing_file'
  | 'excluded'
  | 'miss';

export type FloorLookup<T> = { hit: true; value: T } | { hit: false; reason: FloorMissReason };

/** What a structured floor line carries besides the path. */
export interface FloorAnswerContext {
  readonly reason: FloorReason;
  readonly revalidation: boolean | null;
  readonly elapsedMs: number | null;
}

export interface SnapshotFloorDeps {
  /** This deployment's SITE_ID. */
  readonly siteId: string;
  /** Absolute path of the snapshot file. Called lazily. */
  readonly filePath: () => string;
  /** The whole file as text; throws when it cannot be read. */
  readonly readFile: (path: string) => string;
  /** The file's size, or null when it does not exist. No parse. */
  readonly statFile: (path: string) => { bytes: number } | null;
  /** The first `bytes` of the file as text (the fields before `entries`). */
  readonly readHead: (path: string, bytes: number) => string;
  /** True inside `next build`, where there is no snapshot yet and the floor must stay out. */
  readonly isBuild: () => boolean;
  readonly now: () => number;
  /** Structured info line (`console.log`). */
  readonly log: (line: string) => void;
  /** Structured error line (`console.error`). */
  readonly logError: (line: string) => void;
  /** Sentry hook for the three signals; the caller throttles. */
  readonly report: (signal: 'floor' | 'miss' | 'missing', fields: Record<string, unknown>) => void;
  /** A stable, non-reversible hash of a full path, so a log line can name a key without its ids. */
  readonly hashPath: (path: string) => string;
}

export interface SnapshotFloor {
  /** Once per instance: log `site.snapshot.present` or `site.snapshot.missing`. No parse. */
  notePresence(): void;
  /**
   * The floor answer for `path`, a fresh marked clone, or why there is none.
   * Logs `site.snapshot.miss` when the path is eligible, the file is loaded,
   * and it holds no entry for this exact key.
   */
  lookup<T>(path: string, opts?: { optedOut?: boolean }): FloorLookup<T>;
  /** Log `site.snapshot.floor` (and report it) for an answer the caller is about to return. */
  noteAnswer(path: string, ctx: FloorAnswerContext): void;
  /**
   * True when this deployment's snapshot is a FORCED floor that this runtime
   * may honour: the file says `forceFloor: true` AND this SITE_ID is in
   * `FORCE_FLOOR_SITE_IDS` (the wrapper checked the same list at build; this
   * is the second, independent guard).
   */
  isForced(): boolean;
}

const HEAD_BYTES = 1024;

export function createSnapshotFloor(deps: SnapshotFloorDeps): SnapshotFloor {
  let loaded: SnapshotFile | null = null;
  let loadState: 'unloaded' | 'loaded' | 'absent' = 'unloaded';
  let presenceNoted = false;
  let headForced = false;
  let headBuiltAt: string | null = null;

  const missing = (resolvedPath: string, why: string) => {
    deps.logError(JSON.stringify({ event: 'site.snapshot.missing', resolvedPath, why, siteId: deps.siteId }));
    deps.report('missing', { why });
  };

  const load = (): SnapshotFile | null => {
    if (loadState !== 'unloaded') return loaded;
    const resolvedPath = deps.filePath();
    let parsed: unknown;
    try {
      parsed = JSON.parse(deps.readFile(resolvedPath));
    } catch (err) {
      loadState = 'absent';
      // A missing file is a delivery defect, not an outage: the deploy shipped
      // without the floor. Logged at error level, once, never per read.
      missing(resolvedPath, (err as { code?: string } | null)?.code === 'ENOENT' ? 'not_found' : 'unreadable');
      return null;
    }
    const file = parsed as Partial<SnapshotFile> | null;
    if (
      !file ||
      file.version !== SNAPSHOT_VERSION ||
      file.siteId !== deps.siteId ||
      !deps.siteId ||
      typeof file.entries !== 'object' ||
      file.entries === null
    ) {
      loadState = 'absent';
      missing(resolvedPath, file?.siteId !== deps.siteId ? 'site_mismatch' : 'invalid');
      return null;
    }
    // Cast: every field the runtime reads was checked or defaulted above.
    loaded = {
      ...(file as SnapshotFile),
      excludedCollectionIds: Array.isArray(file.excludedCollectionIds) ? file.excludedCollectionIds : [],
      forceFloor: file.forceFloor === true,
    };
    loadState = 'loaded';
    return loaded;
  };

  const baseFields = (path: string) => ({
    path: stripQueryString(path),
    pathHash: deps.hashPath(path),
    keyShape: keyShape(path),
  });

  return {
    notePresence() {
      if (presenceNoted || deps.isBuild()) return;
      presenceNoted = true;
      const resolvedPath = deps.filePath();
      const stat = deps.statFile(resolvedPath);
      if (!stat) {
        loadState = 'absent';
        missing(resolvedPath, 'not_found');
        return;
      }
      let head = '';
      try {
        head = deps.readHead(resolvedPath, HEAD_BYTES);
      } catch {
        // The stat said it exists; a failed head read only costs the two
        // display fields below. The full load reports a real problem.
        head = '';
      }
      headBuiltAt = /"builtAt":"([^"]*)"/.exec(head)?.[1] ?? null;
      const commit = /"commit":"([^"]*)"/.exec(head)?.[1] ?? null;
      headForced = /"forceFloor":true/.test(head);
      deps.log(
        JSON.stringify({
          event: 'site.snapshot.present',
          bytes: stat.bytes,
          builtAt: headBuiltAt,
          commit,
          resolvedPath,
          entries: null,
          siteId: deps.siteId,
        }),
      );
    },

    lookup<T>(path: string, opts?: { optedOut?: boolean }): FloorLookup<T> {
      if (deps.isBuild()) return { hit: false, reason: 'build' };
      if (opts?.optedOut) return { hit: false, reason: 'opted_out' };
      if (!isFloorEligiblePath(path, deps.siteId, [])) return { hit: false, reason: 'ineligible' };
      const snapshot = load();
      if (!snapshot) return { hit: false, reason: 'missing_file' };
      if (!isFloorEligiblePath(path, deps.siteId, snapshot.excludedCollectionIds)) {
        return { hit: false, reason: 'excluded' };
      }
      const entry = Object.prototype.hasOwnProperty.call(snapshot.entries, path) ? snapshot.entries[path] : undefined;
      if (!entry || entry.data === undefined) {
        // The inert-fix detector: the file is here and the key the runtime
        // built is not in it. A key recorded in a different shape from the one
        // the runtime asks for shows up here, not as an ordinary fallback.
        deps.log(JSON.stringify({ event: 'site.snapshot.miss', ...baseFields(path), siteId: deps.siteId }));
        deps.report('miss', baseFields(path));
        return { hit: false, reason: 'miss' };
      }
      const value = structuredClone(entry.data) as T;
      pruneRichText(value, deps.now());
      return { hit: true, value: markFloorValue(value) };
    },

    noteAnswer(path, ctx) {
      const fields = {
        ...baseFields(path),
        reason: ctx.reason,
        revalidation: ctx.revalidation,
        elapsedMs: ctx.elapsedMs,
        builtAt: loaded?.builtAt ?? headBuiltAt,
      };
      deps.log(JSON.stringify({ event: 'site.snapshot.floor', ...fields, siteId: deps.siteId }));
      deps.report('floor', fields);
    },

    isForced() {
      if (deps.isBuild()) return false;
      if (!presenceNoted) this.notePresence();
      if (!headForced) return false;
      const snapshot = load();
      return (
        !!snapshot &&
        snapshot.forceFloor === true &&
        snapshot.siteId === deps.siteId &&
        FORCE_FLOOR_SITE_IDS.includes(deps.siteId)
      );
    },
  };
}

/**
 * Remove dead and dying inline rich-text image URLs from a floor answer, in
 * place (it is already a private clone). Both payload shapes that carry the
 * map carry it at the top level: siteDetails and a list read's envelope.
 */
function pruneRichText(value: unknown, nowMs: number): void {
  if (typeof value !== 'object' || value === null) return;
  const holder = value as { richTextImageUrls?: unknown };
  if (typeof holder.richTextImageUrls === 'object' && holder.richTextImageUrls !== null) {
    holder.richTextImageUrls = pruneExpiredRichTextUrls(holder.richTextImageUrls as Record<string, string>, nowMs);
  }
}
