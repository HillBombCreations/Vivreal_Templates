import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSnapshotFloor } from './floor.ts';
import { isFloorValue } from './floorValue.ts';
import { floorHarness, snapshotOf } from './testSupport.ts';
import { readSnapshotFile, readSnapshotHead, statSnapshotFile, hashSnapshotPath } from './snapshotFile.ts';
import { collectionObjectsPath, siteDetailsPath } from '../readPaths.ts';
import { FORCE_FLOOR_SITE_IDS } from './constants.ts';

/** T7 and the runtime half of T15 (site-first-read-fallback plan). */

const SITE = '6900a3f732b0727413c502b7';
const MENU = collectionObjectsPath('menu', { limit: 100 });
const SITE_DETAILS = siteDetailsPath(SITE);
const ENTRIES = {
  [SITE_DETAILS]: { name: 'Floor Cafe', siteDetails: { values: { name: 'Floor Cafe' } } },
  [MENU]: { items: [{ _id: 'i1', objectValue: { title: 'Lemon Tart' } }], totalCount: 1, richTextImageUrls: {} },
};

test('T7: lazy. notePresence on the happy path stats and reads the head, never parses the file', () => {
  const h = floorHarness({ siteId: SITE, file: snapshotOf(SITE, ENTRIES) });
  h.floor.notePresence();
  h.floor.notePresence();
  assert.equal(h.fullReads(), 0, 'no full read until a lookup needs one');
  const present = h.events('site.snapshot.present');
  assert.equal(present.length, 1, 'once per instance');
  assert.equal(present[0].builtAt, '2026-10-24T01:23:45.000Z');
  assert.equal(present[0].commit, 'abc1234');
  assert.equal(present[0].resolvedPath, '/srv/.next/server/app/site-snapshot.json');
  assert.equal(present[0].entries, null);
  assert.ok((present[0].bytes as number) > 0);
});

test('T7 ALLOW: an eligible key in the file answers a marked clone; mutating it does not change the next answer', () => {
  const h = floorHarness({ siteId: SITE, file: snapshotOf(SITE, ENTRIES) });
  const first = h.floor.lookup<{ items: Array<{ objectValue: { title: string } }> }>(MENU);
  assert.ok(first.hit);
  assert.equal(first.value.items[0].objectValue.title, 'Lemon Tart');
  assert.equal(isFloorValue(first.value), true);
  first.value.items[0].objectValue.title = 'MUTATED';
  const second = h.floor.lookup<{ items: Array<{ objectValue: { title: string } }> }>(MENU);
  assert.ok(second.hit);
  assert.equal(second.value.items[0].objectValue.title, 'Lemon Tart');
  assert.notEqual(second.value, first.value);
  assert.equal(h.fullReads(), 1, 'parsed once per instance');
});

test('T7 REFUSE: a snapshot built for another site is never used', () => {
  const h = floorHarness({ siteId: SITE, file: snapshotOf('68bfac783bc7c024975c90cb', ENTRIES) });
  const found = h.floor.lookup(MENU);
  assert.deepEqual(found, { hit: false, reason: 'missing_file' });
  assert.equal(h.events('site.snapshot.missing')[0].why, 'site_mismatch');
});

test('T7: a missing file logs site.snapshot.missing once, at error level, and reports it once', () => {
  const h = floorHarness({ siteId: SITE, file: null });
  assert.deepEqual(h.floor.lookup(MENU), { hit: false, reason: 'missing_file' });
  assert.deepEqual(h.floor.lookup(SITE_DETAILS), { hit: false, reason: 'missing_file' });
  assert.equal(h.errors.length, 1);
  assert.equal(h.events('site.snapshot.missing')[0].why, 'not_found');
  assert.equal(h.reports.filter((r) => r.signal === 'missing').length, 1);
});

test('T7 REFUSE: an eligible key the file does not hold logs site.snapshot.miss (the inert-fix detector)', () => {
  const h = floorHarness({ siteId: SITE, file: snapshotOf(SITE, ENTRIES) });
  // Same collection, a parameter the build never used: a key-shape drift.
  const drifted = '/tenant/collectionObjects?collectionId=menu&limit=100';
  assert.deepEqual(h.floor.lookup(drifted), { hit: false, reason: 'miss' });
  const miss = h.events('site.snapshot.miss');
  assert.equal(miss.length, 1);
  assert.equal(miss[0].path, '/tenant/collectionObjects');
  assert.equal(miss[0].keyShape, 'collectionObjects?collectionId&limit');
  assert.ok(!JSON.stringify(miss[0]).includes('menu&'), 'the line carries no query values');
  assert.equal(h.reports.filter((r) => r.signal === 'miss').length, 1);
});

test('T7: an ineligible or opted-out path is not looked up and logs no miss', () => {
  const h = floorHarness({ siteId: SITE, file: snapshotOf(SITE, ENTRIES) });
  assert.deepEqual(h.floor.lookup('/tenant/integrationObjects?limit=100&type=stripe'), { hit: false, reason: 'ineligible' });
  assert.deepEqual(h.floor.lookup(MENU, { optedOut: true }), { hit: false, reason: 'opted_out' });
  assert.equal(h.fullReads(), 0);
  assert.equal(h.events('site.snapshot.miss').length, 0);
});

test('T7: inside next build the floor stays out entirely (no snapshot exists yet)', () => {
  const h = floorHarness({ siteId: SITE, file: snapshotOf(SITE, ENTRIES), isBuild: true });
  h.floor.notePresence();
  assert.deepEqual(h.floor.lookup(MENU), { hit: false, reason: 'build' });
  assert.equal(h.logs.length + h.errors.length, 0);
});

test('T14 runtime guard: a key naming an excluded storefront collection is refused even if present', () => {
  const sold = collectionObjectsPath('sold-here', { limit: 100 });
  const h = floorHarness({
    siteId: SITE,
    file: snapshotOf(SITE, { ...ENTRIES, [sold]: { items: [{ price: 12 }], totalCount: 1 } }, { excludedCollectionIds: ['sold-here'] }),
  });
  assert.deepEqual(h.floor.lookup(sold), { hit: false, reason: 'excluded' });
  assert.equal(h.floor.lookup(MENU).hit, true, 'a collection that is not sold on the same site still answers');
});

test('rich-text images that are dead or dying are pruned from the clone a floor answer returns', () => {
  const now = Date.UTC(2026, 9, 24, 2, 0, 0);
  const dead = `https://media.vivreal.io/x.png?Expires=${Math.floor((now - 1) / 1000)}&Signature=s`;
  const alive = `https://media.vivreal.io/y.png?Expires=${Math.floor((now + 86_400_000) / 1000)}&Signature=s`;
  const h = floorHarness({
    siteId: SITE,
    now,
    file: snapshotOf(SITE, { [MENU]: { items: [], totalCount: 0, richTextImageUrls: { dead, alive } } }),
  });
  const found = h.floor.lookup<{ richTextImageUrls: Record<string, string> }>(MENU);
  assert.ok(found.hit);
  assert.deepEqual(found.value.richTextImageUrls, { alive });
});

test('noteAnswer logs site.snapshot.floor with the reason, the build time, and no query values', () => {
  const h = floorHarness({ siteId: SITE, file: snapshotOf(SITE, ENTRIES) });
  h.floor.lookup(MENU);
  h.floor.noteAnswer(MENU, { reason: 'own_read', revalidation: true, elapsedMs: 61_000 });
  const [line] = h.events('site.snapshot.floor');
  assert.equal(line.reason, 'own_read');
  assert.equal(line.revalidation, true);
  assert.equal(line.elapsedMs, 61_000);
  assert.equal(line.builtAt, '2026-10-24T01:23:45.000Z');
  assert.equal(line.path, '/tenant/collectionObjects');
});

/* ------------------------------------------- T15, the runtime forced-floor guard */

const QA_SITE = FORCE_FLOOR_SITE_IDS[0];

test('T15 ALLOW: a forced snapshot for a FORCE_FLOOR_SITE_IDS site is honoured', () => {
  const h = floorHarness({ siteId: QA_SITE, file: snapshotOf(QA_SITE, {}, { forceFloor: true }) });
  assert.equal(h.floor.isForced(), true);
});

test('T15 REFUSE: the same forced file in another app (its SITE_ID not in FORCE_FLOOR_SITE_IDS) never forces', () => {
  // review-2 note 2: a file copied or restored into another app's bundle.
  const h = floorHarness({ siteId: SITE, file: snapshotOf(SITE, {}, { forceFloor: true }) });
  assert.equal(h.floor.isForced(), false);
});

test('T15 REFUSE: a normal snapshot on the QA site does not force', () => {
  const h = floorHarness({ siteId: QA_SITE, file: snapshotOf(QA_SITE, {}, { forceFloor: false }) });
  assert.equal(h.floor.isForced(), false);
  assert.equal(h.fullReads(), 0, 'and the happy path still never parses the file');
});

test('T15 REFUSE: a forced file whose siteId is not this deployment is not honoured', () => {
  const h = floorHarness({ siteId: QA_SITE, file: snapshotOf(SITE, {}, { forceFloor: true }) });
  assert.equal(h.floor.isForced(), false);
});

/* --------------------------------- the real Node file module, against a real file */

test('snapshotFile.ts reads a real file: stat, head and the full parse agree with what was written', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-floor-'));
  try {
    const file = path.join(dir, 'site-snapshot.json');
    fs.writeFileSync(file, JSON.stringify(snapshotOf(SITE, ENTRIES)));
    const logs: string[] = [];
    const floor = createSnapshotFloor({
      siteId: SITE,
      filePath: () => file,
      readFile: readSnapshotFile,
      statFile: statSnapshotFile,
      readHead: readSnapshotHead,
      isBuild: () => false,
      now: Date.now,
      log: (l) => logs.push(l),
      logError: (l) => logs.push(l),
      report: () => {},
      hashPath: hashSnapshotPath,
    });
    floor.notePresence();
    const present = JSON.parse(logs[0]);
    assert.equal(present.event, 'site.snapshot.present');
    assert.equal(present.bytes, fs.statSync(file).size);
    assert.equal(present.builtAt, '2026-10-24T01:23:45.000Z');
    const found = floor.lookup<{ items: Array<{ objectValue: { title: string } }> }>(MENU);
    assert.ok(found.hit);
    assert.equal(found.value.items[0].objectValue.title, 'Lemon Tart');
    assert.equal(statSnapshotFile(path.join(dir, 'absent.json')), null);
    assert.match(hashSnapshotPath(MENU), /^[0-9a-f]{12}$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
