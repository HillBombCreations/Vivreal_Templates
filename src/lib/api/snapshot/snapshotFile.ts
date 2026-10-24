/**
 * Node-only file access for the render floor (`./floor.ts`).
 *
 * WHERE THE FILE IS. The build wrapper writes `site-snapshot.json` to
 * `.next/server/app/` and, when standalone output exists, to
 * `.next/standalone/.next/server/app/`. Both `next start` and the standalone
 * `server.js` run with the server's working directory at the root that holds
 * that `.next` (standalone `server.js` changes into its own directory first),
 * so one cwd-relative path finds it in both. The resolved absolute path is
 * logged in `site.snapshot.present`, so the deployed location is read, never
 * inferred (plan section 5.1, settled in Phase 0b).
 *
 * `turbopackIgnore` keeps the bundler's file tracing from treating this
 * runtime path as a build input (it does not exist at compile time, and
 * tracing `process.cwd()` would pull the whole project into the standalone
 * output). The edge guard keeps an accidental edge import from touching `fs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SNAPSHOT_FILE_NAME } from './constants.ts';

declare const EdgeRuntime: string | undefined;

const isNodeRuntime = (): boolean => typeof EdgeRuntime === 'undefined';

export function snapshotFilePath(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), '.next', 'server', 'app', SNAPSHOT_FILE_NAME);
}

export function readSnapshotFile(file: string): string {
  if (!isNodeRuntime()) throw Object.assign(new Error('snapshot floor is Node-only'), { code: 'EDGE' });
  return fs.readFileSync(file, 'utf8');
}

export function statSnapshotFile(file: string): { bytes: number } | null {
  if (!isNodeRuntime()) return null;
  try {
    return { bytes: fs.statSync(file).size };
  } catch {
    // ENOENT (or unreadable): the caller logs `site.snapshot.missing`.
    return null;
  }
}

export function readSnapshotHead(file: string, bytes: number): string {
  if (!isNodeRuntime()) return '';
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** 12 hex chars of sha256: names a full path in a log line without carrying its ids. */
export function hashSnapshotPath(p: string): string {
  return createHash('sha256').update(p).digest('hex').slice(0, 12);
}
