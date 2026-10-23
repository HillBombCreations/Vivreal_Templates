/**
 * scripts/build-with-snapshot.mjs (site-first-read-fallback plan, Change 6):
 * T11, T12, the build half of T14 and T15, the secret sweep, and one leg that
 * runs the REAL recorder, fill pass, wrapper and runtime floor together.
 *
 * Every test runs the wrapper's real `main()` against a real temp directory;
 * only `next build` (spawnBuild), the preflight network read and the clock
 * are injected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  main,
  decideForceFloor,
  SNAPSHOT_FILE_NAME,
  SNAPSHOT_VERSION,
  RECORD_DIR_ENV,
  FORCE_FLOOR_ENV,
  trimToBudget,
} from './build-with-snapshot.mjs';
import * as tsConstants from '../src/lib/api/snapshot/constants.ts';
import { createSnapshotRecorder } from '../src/lib/api/snapshot/recorder.ts';
import { fillSnapshotAtBuild } from '../src/lib/api/snapshot/fill.ts';
import { createSnapshotFloor } from '../src/lib/api/snapshot/floor.ts';
import { readSnapshotFile, readSnapshotHead, statSnapshotFile, hashSnapshotPath } from '../src/lib/api/snapshot/snapshotFile.ts';
import { collectionObjectsPath, siteDetailsPath } from '../src/lib/api/readPaths.ts';

const SITE = '6900a3f732b0727413c502b7';
const QA = tsConstants.FORCE_FLOOR_SITE_IDS[0];
const API_KEY = 'k'.repeat(24) + 'API-KEY-VALUE';
const MENU = collectionObjectsPath('menu', { limit: 100 });
const SOLD = collectionObjectsPath('resale', { limit: 100 });
const SHELL = { name: 'Floor Cafe', siteDetails: { values: { name: 'Floor Cafe' } } };

const okFetch = async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: SHELL }) });
const downFetch = async () => {
  throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
};

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-wrap-'));
  fs.mkdirSync(path.join(root, '.next', 'standalone'), { recursive: true });
  return root;
}

function manifestFor(siteId, extra = {}) {
  return {
    version: 1,
    siteId,
    siteDetailsKey: siteDetailsPath(siteId),
    expectedKeys: [siteDetailsPath(siteId), MENU],
    excludedCollectionIds: [],
    paymentsProviderTypes: ['stripe', 'square'],
    forceFloorSiteIds: [...tsConstants.FORCE_FLOOR_SITE_IDS],
    ...extra,
  };
}

/** A fake `next build` that writes what the recorder and fill pass would have. */
function fakeBuild({ siteId = SITE, entries, manifest, code = 0 }) {
  return async ({ env, recordDir }) => {
    assert.equal(env[RECORD_DIR_ENV], recordDir, 'the build is spawned with the record directory set');
    let n = 0;
    for (const [p, data] of Object.entries(entries ?? { [siteDetailsPath(siteId)]: SHELL, [MENU]: { items: [] } })) {
      fs.writeFileSync(path.join(recordDir, `shard-1-0-aaaa-${(n += 1)}.json`), JSON.stringify({ path: p, data }));
    }
    if (manifest !== null) fs.writeFileSync(path.join(recordDir, 'manifest-1-0-aaaa-1.json'), JSON.stringify(manifest ?? manifestFor(siteId)));
    return code;
  };
}

async function run(root, overrides = {}) {
  const logs = [];
  const errors = [];
  const code = await main({
    root,
    env: { SITE_ID: SITE, API_KEY, NEXT_PUBLIC_CLIENT_API: 'http://stub', ...(overrides.env ?? {}) },
    fetchImpl: overrides.fetchImpl ?? okFetch,
    sleep: async () => {},
    spawnBuild: overrides.spawnBuild ?? fakeBuild({}),
    now: () => Date.UTC(2026, 9, 24, 1, 23, 45),
    commit: 'abc1234',
    outputPaths: overrides.outputPaths,
    log: (l) => logs.push(l),
    logError: (l) => errors.push(l),
  });
  return { code, logs, errors };
}

const files = (root) => [
  path.join(root, '.next', 'server', 'app', SNAPSHOT_FILE_NAME),
  path.join(root, '.next', 'standalone', '.next', 'server', 'app', SNAPSHOT_FILE_NAME),
];
const sha = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

test('the wrapper constants are the TypeScript ones (one value, two languages)', () => {
  assert.equal(SNAPSHOT_FILE_NAME, tsConstants.SNAPSHOT_FILE_NAME);
  assert.equal(SNAPSHOT_VERSION, tsConstants.SNAPSHOT_VERSION);
  assert.equal(RECORD_DIR_ENV, tsConstants.RECORD_DIR_ENV);
});

test('T11 ALLOW: a good build writes byte-identical files to both locations and prints the snapshot line', async () => {
  const root = tempRoot();
  try {
    const { code, logs } = await run(root);
    assert.equal(code, 0);
    const [server, standalone] = files(root);
    assert.equal(sha(server), sha(standalone));
    const written = JSON.parse(fs.readFileSync(server, 'utf8'));
    assert.equal(written.siteId, SITE);
    assert.equal(written.forceFloor, false);
    assert.deepEqual(Object.keys(written).slice(0, 6), ['version', 'siteId', 'builtAt', 'commit', 'forceFloor', 'excludedCollectionIds']);
    const line = logs.find((l) => l.startsWith('site snapshot: 2 entries'));
    assert.match(line, /^site snapshot: 2 entries, \d+ bytes, siteDetails ok, snapshot_uncovered: 0 /);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('T11 REFUSE: the preflight fails, so next build is never started', async () => {
  const root = tempRoot();
  let built = false;
  try {
    const { code, errors } = await run(root, {
      fetchImpl: downFetch,
      spawnBuild: async () => {
        built = true;
        return 0;
      },
    });
    assert.equal(code, 1);
    assert.equal(built, false);
    assert.match(errors[0], /preflight FAILED \(network \(ECONNREFUSED\)\)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('T11 REFUSE: a preflight answer with empty values fails too', async () => {
  const root = tempRoot();
  try {
    const emptyValues = async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { siteDetails: { values: {} } } }) });
    assert.equal((await run(root, { fetchImpl: emptyValues })).code, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const [name, entries, check] of [
  ['no siteDetails entry', { [MENU]: { items: [] } }, 'site-details'],
  ['siteDetails with values: {}', { [siteDetailsPath(SITE)]: { siteDetails: { values: {} } } }, 'site-details'],
  ['a planted API_KEY value', { [siteDetailsPath(SITE)]: { ...SHELL, leaked: `x${API_KEY}x` } }, 'secret-value'],
  ['an AWS access key id', { [siteDetailsPath(SITE)]: { ...SHELL, note: 'AKIAABCDEFGHIJKLMNOP' } }, 'secret-pattern'],
  ['a webhook signing secret', { [siteDetailsPath(SITE)]: { ...SHELL, note: 'whsec_abc' } }, 'secret-pattern'],
  ['a provider-product key', { [siteDetailsPath(SITE)]: SHELL, '/tenant/integrationObjects?limit=100&type=stripe': { items: [] } }, 'provider-product'],
]) {
  test(`T11 REFUSE: ${name} fails the build, naming the check and never the value`, async () => {
    const root = tempRoot();
    try {
      const { code, errors } = await run(root, { spawnBuild: fakeBuild({ entries }) });
      assert.equal(code, 1);
      assert.match(errors.join('\n'), new RegExp(`REFUSED \\(${check}\\)`));
      assert.ok(!errors.join('\n').includes(API_KEY), 'the secret value is never printed');
      assert.ok(!errors.join('\n').includes('AKIAABCDEFGHIJKLMNOP'));
      assert.equal(fs.existsSync(files(root)[0]), false, 'nothing is written');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('T11 REFUSE: an output path under .next/static (or public) fails the build', async () => {
  for (const bad of [['.next', 'static', 'site-snapshot.json'], ['public', 'site-snapshot.json']]) {
    const root = tempRoot();
    try {
      const { code, errors } = await run(root, { outputPaths: [path.join(root, ...bad)] });
      assert.equal(code, 1);
      assert.match(errors.join('\n'), /REFUSED \(output-path\)/);
      assert.equal(fs.existsSync(path.join(root, ...bad)), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('T11 REFUSE: no fill-pass manifest fails the build (the expected set is unknown)', async () => {
  const root = tempRoot();
  try {
    const { code, errors } = await run(root, { spawnBuild: fakeBuild({ manifest: null }) });
    assert.equal(code, 1);
    assert.match(errors.join('\n'), /REFUSED \(fill-manifest\)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('T11: snapshot_uncovered counts and lists each expected key that was never recorded, without failing the build', async () => {
  const root = tempRoot();
  const missing = collectionObjectsPath('aaa000000000000000000008', { limit: 100 });
  try {
    const { code, logs } = await run(root, {
      spawnBuild: fakeBuild({ manifest: manifestFor(SITE, { expectedKeys: [siteDetailsPath(SITE), MENU, missing] }) }),
    });
    assert.equal(code, 0);
    assert.ok(logs.some((l) => / snapshot_uncovered: 1 /.test(l)));
    const uncoveredLines = logs.filter((l) => l.startsWith('site snapshot: uncovered '));
    assert.equal(uncoveredLines.length, 1);
    assert.match(uncoveredLines[0], /^site snapshot: uncovered \/tenant\/collectionObjects [0-9a-f]{12}$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('T12: a failing next build exit code is forwarded and no snapshot is written', async () => {
  const root = tempRoot();
  try {
    const { code } = await run(root, { spawnBuild: fakeBuild({ code: 3 }) });
    assert.equal(code, 3);
    assert.equal(fs.existsSync(files(root)[0]), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('T14 build: a storefront collection recorded during the build is dropped from the snapshot; a plain one stays', async () => {
  const root = tempRoot();
  try {
    const { code } = await run(root, {
      spawnBuild: fakeBuild({
        entries: { [siteDetailsPath(SITE)]: SHELL, [MENU]: { items: [] }, [SOLD]: { items: [{ price: 12 }] } },
        manifest: manifestFor(SITE, { excludedCollectionIds: ['resale'] }),
      }),
    });
    assert.equal(code, 0);
    const written = JSON.parse(fs.readFileSync(files(root)[0], 'utf8'));
    assert.equal(written.entries[SOLD], undefined);
    assert.ok(written.entries[MENU]);
    assert.deepEqual(written.excludedCollectionIds, ['resale']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------- T15, build guards */

const forcedEnv = { [FORCE_FLOOR_ENV]: '1', SITE_ID: QA, AWS_BRANCH: 'snapshot-floor-proof' };

test('T15 ALLOW: forceFloor is set only with all three guards (env, a listed SITE_ID, a non-stable AWS_BRANCH)', async () => {
  assert.equal(decideForceFloor(forcedEnv, QA, [QA]), true);
  const root = tempRoot();
  try {
    const { code, logs } = await run(root, {
      env: forcedEnv,
      spawnBuild: fakeBuild({ siteId: QA, entries: { [siteDetailsPath(QA)]: SHELL } }),
    });
    assert.equal(code, 0);
    assert.equal(JSON.parse(fs.readFileSync(files(root)[0], 'utf8')).forceFloor, true);
    assert.ok(logs.some((l) => l.includes('FORCED FLOOR')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const [name, env, siteId] of [
  ['the env var unset', { ...forcedEnv, [FORCE_FLOOR_ENV]: undefined }, QA],
  ['the env var not exactly 1', { ...forcedEnv, [FORCE_FLOOR_ENV]: 'true' }, QA],
  ['another SITE_ID', { ...forcedEnv, SITE_ID: SITE }, SITE],
  ['AWS_BRANCH=stable', { ...forcedEnv, AWS_BRANCH: 'stable' }, QA],
  ['AWS_BRANCH absent (a local build)', { ...forcedEnv, AWS_BRANCH: undefined }, QA],
]) {
  test(`T15 REFUSE: ${name} leaves forceFloor false`, async () => {
    assert.equal(decideForceFloor(env, siteId, [QA]), false);
    const root = tempRoot();
    try {
      const { code } = await run(root, {
        env,
        spawnBuild: fakeBuild({ siteId, entries: { [siteDetailsPath(siteId)]: SHELL } }),
      });
      assert.equal(code, 0);
      assert.equal(JSON.parse(fs.readFileSync(files(root)[0], 'utf8')).forceFloor, false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('size budget: past the cap, skip windows go first and siteDetails is never trimmed', () => {
  const big = 'x'.repeat(1000);
  const entries = new Map([
    [siteDetailsPath(SITE), { big }],
    [MENU, { big }],
    [collectionObjectsPath('c', { limit: 100, skip: 100 }), { big }],
  ]);
  const dropped = trimToBudget(entries, siteDetailsPath(SITE), 2200);
  assert.deepEqual(dropped, [collectionObjectsPath('c', { limit: 100, skip: 100 })]);
  assert.ok(entries.has(siteDetailsPath(SITE)) && entries.has(MENU));
});

/* ------------------------- end to end: recorder -> fill -> wrapper -> floor */

test('the key the recorder writes during the build is the key the runtime floor finds afterwards', async () => {
  const root = tempRoot();
  const cwd = process.cwd();
  try {
    const { code } = await run(root, {
      spawnBuild: async ({ recordDir }) => {
        // What the real build does, with the real modules: reads succeed and
        // are recorded, the fill pass writes its manifest.
        const recorder = createSnapshotRecorder({ dir: recordDir, siteId: SITE });
        recorder.record(siteDetailsPath(SITE), SHELL);
        const home = { slug: 'home', format: 'home' };
        await fillSnapshotAtBuild(
          { pageConfigs: [], homePageConfig: home },
          {
            siteId: SITE,
            recorder,
            targetsOf: () => ({ collectionIds: ['menu'], integrationTypes: [] }),
            getCollectionItems: async (id, opts) => {
              recorder.record(collectionObjectsPath(id, opts), { items: [{ objectValue: { title: 'Lemon Tart' } }], totalCount: 1 });
            },
            getIntegrationItems: async () => {},
            buildNestedPageContext: async () => {},
            log: () => {},
          },
        );
        return 0;
      },
    });
    assert.equal(code, 0);
    process.chdir(path.join(root, '.next', 'standalone'));
    const floor = createSnapshotFloor({
      siteId: SITE,
      filePath: () => path.join(process.cwd(), '.next', 'server', 'app', SNAPSHOT_FILE_NAME),
      readFile: readSnapshotFile,
      statFile: statSnapshotFile,
      readHead: readSnapshotHead,
      isBuild: () => false,
      now: Date.now,
      log: () => {},
      logError: () => {},
      report: () => {},
      hashPath: hashSnapshotPath,
    });
    // The runtime builds its key through the same function the reader does.
    const found = floor.lookup(collectionObjectsPath('menu', { limit: 100 }));
    assert.ok(found.hit, 'hit at the standalone location');
    assert.equal(found.value.items[0].objectValue.title, 'Lemon Tart');
  } finally {
    process.chdir(cwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
