import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * F85: the free-year check run with no NODE_AUTH_TOKEN (a developer's
 * machine) must say how to run it, and must not reach for npm first. Before
 * this, it called `npm view` against a registry it could not authenticate to
 * and failed with an npm 401 that said nothing about running it in CI.
 *
 * Lives beside the check, outside `src/`, so the `npm test` glob does not run
 * it either; run it by name:
 *   node --experimental-strip-types --test checks/freeYearPackage.guard.test.ts
 *
 * The check is run as its own process with the token removed from its
 * environment and a recording `npm` first on its PATH, so "spawns nothing" is
 * measured, not assumed.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const RUN_IN_CI = 'Run it in CI: gh workflow run free-year-package-check.yml -R HillBombCreations/Vivreal_Templates';

/** A directory holding an `npm` that records each call and fails, for PATH. */
function recordingNpm(): { dir: string; calls: () => number } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-free-year-guard-'));
  const log = path.join(dir, 'npm-calls.txt');
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(dir, 'npm.cmd'), `@echo off\r\necho called>>"${log}"\r\nexit /b 1\r\n`);
  } else {
    fs.writeFileSync(path.join(dir, 'npm'), `#!/bin/sh\necho called >> '${log}'\nexit 1\n`, { mode: 0o755 });
  }
  return { dir, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).length : 0) };
}

/** The environment with `dir` first on the search path, under the key this OS already uses (`Path` on Windows). */
function withNpmFirst(dir: string, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  env[key] = `${dir}${path.delimiter}${env[key] ?? ''}`;
  return env;
}

function runCheck(base: NodeJS.ProcessEnv) {
  // The runner marks its own children with NODE_TEST_CONTEXT; a check run that
  // inherits it reports to this runner instead of exiting with its own status.
  const env = { ...base };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--experimental-strip-types', '--test', path.join('checks', 'freeYearPackage.test.ts')], {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
    timeout: 120_000,
  });
}

test('REFUSE: with no NODE_AUTH_TOKEN the check fails with the CI command and spawns nothing', () => {
  const npm = recordingNpm();
  try {
    const env = withNpmFirst(npm.dir, process.env);
    for (const key of Object.keys(env)) if (key.toUpperCase() === 'NODE_AUTH_TOKEN') delete env[key];
    const run = runCheck(env);
    const out = `${run.stdout}${run.stderr}`;
    assert.notEqual(run.status, 0, 'it still FAILS, never skips');
    assert.doesNotMatch(out, /# skipped [1-9]/, 'never a skip');
    assert.ok(out.includes(RUN_IN_CI), `the output names the CI command, got:\n${out.slice(0, 1500)}`);
    assert.equal(npm.calls(), 0, 'no npm call before the token check');
  } finally {
    fs.rmSync(npm.dir, { recursive: true, force: true });
  }
});

test('ALLOW (control): with a token present the check goes on to npm, so the recording shim sees calls', () => {
  const npm = recordingNpm();
  try {
    const env = withNpmFirst(npm.dir, { ...process.env, NODE_AUTH_TOKEN: 'placeholder-not-a-token' });
    const run = runCheck(env);
    assert.notEqual(run.status, 0, 'the shim npm fails, so the check fails loudly');
    assert.ok(npm.calls() > 0, 'the shim is on PATH and is what the check calls');
  } finally {
    fs.rmSync(npm.dir, { recursive: true, force: true });
  }
});
