import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fetchWithReconnect } from './fetchWithReconnect.ts';

/**
 * Real sockets, a real HTTP server, no `fetch` stub (idle-dead-socket-
 * research-2026-10-04.md, section 4, Test A).
 *
 * REDUCED SCOPE, MEASURED, NOT ASSUMED (review-templates-183.md, concern 1)
 * ---------------------------------------------------------------------------
 * This file used to carry two more tests: one reproducing section 2d's
 * "Model A" (pending error, every pooled socket RST'd while this process's
 * event loop is blocked) against plain `fetchWithReconnect`, and one proving
 * a since-removed dispatcher-reset forced every attempt onto a fresh
 * connection. Both are gone, for the same reason: neither can fail on the
 * code this PR changes.
 *
 * The research measured 0 of 4 recovering against 12 pre-warmed dead sockets
 * on `ce88864`'s logic, zero new connections opened. Reproduced here against
 * the REAL global fetch dispatcher (Node 22.20.0, Windows), the SAME setup
 * recovered 4 of 4 even on `ce88864` itself: every retry on this box opens a
 * brand-new connection rather than being handed one of the remaining
 * dead-but-untouched idle sockets, which is the opposite of the research's
 * described mechanism ("the pool skips the busy one and hands out the next
 * idle, EQUALLY DEAD client"). A test built on that outcome is not a
 * regression test for this PR — it never went red on the old code — and
 * pinning the exact platform-dependent race outcome (`count === 16`) risks
 * flaking on a box where the race DOES resolve the other way. The dispatcher
 * reset it was meant to validate is gone (removed as a blocker: it never ran
 * in production — middleware's `globalThis` is not the realm fetch reads its
 * Agent from — review-templates-183.md B1), so there is nothing left for
 * that second test to prove either.
 *
 * What stays: two MUST-PASS CONTROLS (a break harness needs one, per the
 * repo's own break-harness memory), reframed honestly as harness checks
 * rather than regression tests. They confirm the fixture and the existing
 * retry behave the way the research document says, which is what makes the
 * mock-timer backoff tests in `./fetchWithReconnect.backoff.test.ts` (which
 * DO go red on the old code) trustworthy: if the server-side connection
 * count were not a meaningful oracle, or if Model B's existing recovery
 * stopped working, that would call the rest of this research into question
 * too.
 */

const SERVER_SCRIPT = fileURLToPath(new URL('./__fixtures__/deadSocketServer.ts', import.meta.url));

interface ServerHandle {
  readonly url: string;
  call(msg: Record<string, unknown>): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

async function startServer(): Promise<ServerHandle> {
  // The fixture is `.ts` (not `.mjs`) so ESLint's `vivreal/owner-visible-copy`
  // plugin registration — scoped to `src/**/*.ts` — covers it like every
  // other source file, rather than a `__fixtures__/**` file of a different
  // extension silently falling outside that config block's plugin scope.
  // `execArgv` is explicit, not relied on as inherited, so this fork runs
  // under the same flag this test file itself needs to load.
  const child: ChildProcess = fork(SERVER_SCRIPT, {
    execArgv: ['--experimental-strip-types'],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  const call = (msg: Record<string, unknown>): Promise<Record<string, unknown>> =>
    new Promise((resolve) => {
      child.once('message', (reply: Record<string, unknown>) => resolve(reply));
      child.send(msg);
    });
  const started = await call({ cmd: 'start' });
  return {
    url: `http://127.0.0.1:${started.port as number}/`,
    call,
    close: () =>
      new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
        child.send({ cmd: 'exit' });
      }),
  };
}

/** Opens `n` concurrent keep-alive connections to `url` and confirms the
 * server actually saw `n` distinct sockets before returning. */
async function warmPool(server: ServerHandle, n: number): Promise<void> {
  const results = await Promise.all(Array.from({ length: n }, () => fetch(server.url)));
  assert.ok(results.every((r) => r.ok), 'warm-up requests must all succeed');
  const counted = await server.call({ cmd: 'connectionCount' });
  assert.equal(counted.count, n, `server must have seen exactly ${n} connections during warm-up`);
}

// ---------------------------------------------------------------------------
// Must-pass controls (a break harness needs one, per the repo's own break-
// harness memory): these confirm the harness itself is not rigged to always
// report success regardless of what happened.
// ---------------------------------------------------------------------------

test('control: warm-up really does open one socket per request — the server-side connection count is a meaningful oracle', async () => {
  const server = await startServer();
  try {
    await warmPool(server, 6);
    const counted = await server.call({ cmd: 'connectionCount' });
    assert.equal(counted.count, 6);
  } finally {
    await server.close();
  }
});

test('control: Model B (dead until written), 12 flagged-stale sockets, recovers 4 of 4 — the existing retry already survives it, matching research section 2d', async () => {
  const server = await startServer();
  try {
    await warmPool(server, 12);
    // No freeze needed for this model: the RST fires the instant something
    // is WRITTEN to a flagged socket, one round trip after the write — by
    // then the failed client is idle and first in the pool's insertion
    // order, so the existing retry loop reconnects on its own (section 2d).
    await server.call({ cmd: 'armStaleOnWrite' });

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => fetchWithReconnect(server.url)),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    assert.equal(succeeded, 4, 'Model B was never the general cause — the existing retry already survives it');
  } finally {
    await server.close();
  }
});
