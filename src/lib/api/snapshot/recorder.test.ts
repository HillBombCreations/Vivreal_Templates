import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSnapshotRecorder } from './recorder.ts';
import { RECORD_DIR_ENV } from './constants.ts';
import { collectionObjectsPath, siteDetailsPath } from '../readPaths.ts';

/** T6 (site-first-read-fallback plan): the recorder itself, against a real directory. */

const SITE = '6900a3f732b0727413c502b7';
const MENU = collectionObjectsPath('menu', { limit: 100 });

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-rec-'));
}
const shards = (dir: string) => fs.readdirSync(dir).filter((n) => n.startsWith('shard-') && n.endsWith('.json'));

test('T6 REFUSE: inert with the env var unset, nothing is written anywhere', () => {
  const before = process.env[RECORD_DIR_ENV];
  delete process.env[RECORD_DIR_ENV];
  try {
    const writes: string[] = [];
    const rec = createSnapshotRecorder({ siteId: SITE, writeFile: (f) => writes.push(f), rename: () => {} });
    rec.record(MENU, { items: [] });
    rec.writeManifest({ expectedKeys: [] });
    assert.equal(rec.active, false);
    assert.deepEqual(writes, []);
  } finally {
    if (before !== undefined) process.env[RECORD_DIR_ENV] = before;
  }
});

test('T6 ALLOW: with a directory, each eligible path is written once, atomically, named by pid-thread-random', () => {
  const dir = tmp();
  try {
    const rec = createSnapshotRecorder({ dir, siteId: SITE });
    rec.record(MENU, { items: [{ title: 'Lemon Tart' }], totalCount: 1 });
    rec.record(MENU, { items: [{ title: 'second read' }], totalCount: 1 });
    rec.record(siteDetailsPath(SITE), { siteDetails: { values: { a: 1 } } });
    const names = shards(dir);
    assert.equal(names.length, 2, 'one file per path, first success wins');
    for (const n of names) assert.match(n, new RegExp(`^shard-${process.pid}-\\d+-[0-9a-f]{12}-\\d+\\.json$`));
    assert.equal(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp')).length, 0, 'no temp file left behind');
    const menu = names.map((n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'))).find((e) => e.path === MENU);
    assert.equal(menu.data.items[0].title, 'Lemon Tart');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('T6: serialised at record time, so a caller mutating the value afterwards does not change the shard', () => {
  const dir = tmp();
  try {
    const rec = createSnapshotRecorder({ dir, siteId: SITE });
    const value = { items: [{ title: 'Lemon Tart' }], totalCount: 1 };
    rec.record(MENU, value);
    value.items[0].title = 'MUTATED BY THE PAGE';
    const [name] = shards(dir);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).data.items[0].title, 'Lemon Tart');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('T6 REFUSE: ineligible paths (another site, a product type, a search) and undefined values are never written', () => {
  const dir = tmp();
  try {
    const rec = createSnapshotRecorder({ dir, siteId: SITE });
    rec.record(siteDetailsPath('68bfac783bc7c024975c90cb'), { siteDetails: { values: {} } });
    rec.record('/tenant/integrationObjects?limit=100&type=stripe', { items: [] });
    rec.record(collectionObjectsPath('menu', { limit: 100, search: 'tart' }), { items: [] });
    rec.record(MENU, undefined);
    assert.deepEqual(shards(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('writeManifest writes a manifest shard the wrapper reads', () => {
  const dir = tmp();
  try {
    createSnapshotRecorder({ dir, siteId: SITE }).writeManifest({ siteId: SITE, expectedKeys: [MENU] });
    const [name] = fs.readdirSync(dir).filter((n) => n.startsWith('manifest-'));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')).expectedKeys, [MENU]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
