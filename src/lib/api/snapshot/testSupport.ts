/**
 * Test support for the snapshot floor: an in-memory snapshot file and a floor
 * wired to it, with every read and log line counted. Not imported by app code.
 */
import { createSnapshotFloor, type SnapshotFile, type SnapshotFloor } from './floor.ts';
import { SNAPSHOT_VERSION } from './constants.ts';

export interface FloorHarness {
  readonly floor: SnapshotFloor;
  readonly logs: string[];
  readonly errors: string[];
  readonly reports: Array<{ signal: string; fields: Record<string, unknown> }>;
  /** How often the whole file was read (the parse). The happy path must keep this at 0. */
  readonly fullReads: () => number;
  readonly events: (name: string) => Record<string, unknown>[];
}

export function snapshotOf(siteId: string, entries: Record<string, unknown>, extra: Partial<SnapshotFile> = {}): SnapshotFile {
  return {
    version: SNAPSHOT_VERSION,
    siteId,
    builtAt: '2026-10-24T01:23:45.000Z',
    commit: 'abc1234',
    forceFloor: false,
    excludedCollectionIds: [],
    ...extra,
    entries: Object.fromEntries(Object.entries(entries).map(([k, data]) => [k, { data }])),
  };
}

export function floorHarness(opts: {
  siteId: string;
  file: SnapshotFile | string | null;
  isBuild?: boolean;
  now?: number;
}): FloorHarness {
  const logs: string[] = [];
  const errors: string[] = [];
  const reports: Array<{ signal: string; fields: Record<string, unknown> }> = [];
  let fullReads = 0;
  const text = opts.file === null ? null : typeof opts.file === 'string' ? opts.file : JSON.stringify(opts.file);
  const floor = createSnapshotFloor({
    siteId: opts.siteId,
    filePath: () => '/srv/.next/server/app/site-snapshot.json',
    readFile: () => {
      fullReads += 1;
      if (text === null) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return text;
    },
    statFile: () => (text === null ? null : { bytes: Buffer.byteLength(text) }),
    readHead: (_p, n) => (text ?? '').slice(0, n),
    isBuild: () => opts.isBuild === true,
    now: () => opts.now ?? Date.UTC(2026, 9, 24, 2, 0, 0),
    log: (l) => logs.push(l),
    logError: (l) => errors.push(l),
    report: (signal, fields) => reports.push({ signal, fields }),
    hashPath: (p) => `h${p.length}`,
  });
  const all = () => [...logs, ...errors].map((l) => JSON.parse(l) as Record<string, unknown>);
  return {
    floor,
    logs,
    errors,
    reports,
    fullReads: () => fullReads,
    events: (name) => all().filter((e) => e.event === name),
  };
}
