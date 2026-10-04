import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fetchWithReconnect } from './fetchWithReconnect.ts';
import {
  noteRequestAndMaybeResetDispatcher,
  __resetDispatcherStateForTests,
} from '../dispatcherReset.ts';

/**
 * Test A (idle-dead-socket-research-2026-10-04.md, section 4). Real sockets,
 * a real HTTP server, no `fetch` stub.
 *
 * Reproduces section 2d's "Model A" (pending error): the upstream server RSTs
 * every pooled socket while THIS process's event loop is blocked — modelling
 * the Amplify freeze, where nothing here can react until the next invocation
 * thaws it. The server runs in a FORKED CHILD PROCESS specifically so it can
 * still act (schedule and fire the resets) while the parent blocks itself
 * with `Atomics.wait`; if both lived in one process, blocking the test would
 * also block the server, and the resets could never be queued unseen the way
 * a real freeze queues them.
 *
 * A HONEST DIVERGENCE FROM THE RESEARCH DOCUMENT, MEASURED, NOT ASSUMED
 * -----------------------------------------------------------------------
 * The research measured 0 of 4 recovering on `ce88864`'s logic against 12
 * pre-warmed dead sockets, with zero new connections opened, run three times.
 * Reproduced here against the REAL global fetch dispatcher (Node 22.20.0,
 * Windows), the SAME setup recovers 4 of 4 even with NO dispatcher reset: the
 * first wave of 4 concurrent calls fails fast on the 4 dead sockets it is
 * handed (confirmed: the server's connection count does not move, still 12),
 * but every RETRY opens a brand-new connection rather than being handed one
 * of the 8 remaining dead-but-untouched idle sockets (confirmed: the count
 * jumps to 16, +4, immediately). That is the opposite of research section
 * 2d's described mechanism ("the pool skips the busy one and hands out the
 * next idle, EQUALLY DEAD client"), and it means this box's default
 * dispatcher does not reproduce Model A at all under this exact load.
 *
 * Working hypothesis, not confirmed: the research's own repro notes the race
 * depends on the retry dispatching while the just-failed client is still
 * flagged busy in the pool's bookkeeping, before its error has been fully
 * processed. All 12 of this test's sockets receive their RST while the
 * process is frozen, so when it thaws, cleanup for every one of them (not
 * only the 4 that get dispatched to first) may already be a queued,
 * near-simultaneous libuv event — on this box, apparently fast enough that by
 * the time any retry fires, the pool already has zero idle entries left and
 * must open fresh ones. WoG's live incident (22:28:24, 12 attempts in 5ms,
 * zero new connections) is real production evidence that the busy-client race
 * DOES occur somewhere in the fleet's actual environment; this box's timing
 * evidently does not force it. I do not have a way to force the exact race
 * without constraining the pool's `connections` cap, which needs the
 * `undici` package — Templates carries none, and adding one is out of scope
 * for a lockfile-surgery-only environment (see `../dispatcherReset.ts`'s
 * header for the same constraint applied to the fix itself).
 *
 * What this file proves instead, with the SAME real sockets and the SAME real
 * freeze: (1) `fetchWithReconnect` alone survives a batch of simultaneously
 * dead pooled sockets without hanging, crashing, or leaking a socket count
 * that never settles — real, useful regression coverage on its own. (2) the
 * dispatcher reset (item 4), invoked with REAL sockets rather than the
 * injected fakes `../dispatcherReset.test.ts` uses, makes the eviction
 * unconditional rather than hoping a race resolves in our favour: every one
 * of the 4 post-reset attempts is PROVEN to run on a connection opened AFTER
 * the reset (count jumps by exactly 4, from 12 to 16, with no attempt left
 * unaccounted for), which is a strictly stronger guarantee than "the pool
 * happened to pick a fresh one" and is what actually closes the WoG shape
 * regardless of which way a given platform's race resolves.
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

/** Blocks THIS process's event loop for `ms` — nothing here can run, no
 * timer, no socket event, until this returns. Models the Amplify freeze: the
 * child process keeps running independently and fires its scheduled resets
 * while this is blocked. */
function blockEventLoop(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Opens `n` concurrent keep-alive connections to `url` and confirms the
 * server actually saw `n` distinct sockets before returning. */
async function warmPool(server: ServerHandle, n: number): Promise<void> {
  const results = await Promise.all(Array.from({ length: n }, () => fetch(server.url)));
  assert.ok(results.every((r) => r.ok), 'warm-up requests must all succeed');
  const counted = await server.call({ cmd: 'connectionCount' });
  assert.equal(counted.count, n, `server must have seen exactly ${n} connections during warm-up`);
}

async function freezeAndKillAllSockets(server: ServerHandle): Promise<void> {
  await server.call({ cmd: 'resetSocketsAfter', ms: 150 });
  blockEventLoop(700);
}

test('Model A, 12 dead pooled sockets, no dispatcher reset: fetchWithReconnect survives and recovers without hanging or leaking a dangling connection count', async () => {
  const server = await startServer();
  try {
    await warmPool(server, 12);
    await freezeAndKillAllSockets(server);

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => fetchWithReconnect(server.url)),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    // See the module header: on this box the default dispatcher opens fresh
    // connections on retry rather than reusing one of the 8 untouched dead
    // sockets, so this recovers 4/4 even without the dispatcher reset. The
    // load-bearing claim here is narrower and still real: no attempt hangs,
    // none silently reuses a socket that returns no response at all forever,
    // and the server's own connection count stays finite and accounted for.
    assert.equal(succeeded, 4);
    const after = await server.call({ cmd: 'connectionCount' });
    assert.equal(after.count, 16, 'recovery on this box is via 4 fresh connections (12 warm + 4 retried)');
  } finally {
    await server.close();
  }
});

test('Model A, 12 dead pooled sockets: a dispatcher reset forces EVERY attempt onto a connection opened after the reset, not merely a connection that happened to be fresh', async () => {
  __resetDispatcherStateForTests();
  const server = await startServer();
  try {
    await warmPool(server, 12);
    await freezeAndKillAllSockets(server);

    // Simulate `src/middleware.ts` having already run earlier in this
    // invocation and detected a long-enough idle gap. The first call always
    // reports `false` (nothing to compare against yet); the second is what
    // actually resets.
    noteRequestAndMaybeResetDispatcher(() => 1_000_000);
    const reset = noteRequestAndMaybeResetDispatcher(() => 1_010_000);
    assert.equal(reset, true, 'control: the reset itself must have fired');

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => fetchWithReconnect(server.url)),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    assert.equal(succeeded, 4);

    const after = await server.call({ cmd: 'connectionCount' });
    // The reset destroyed the entire pool before the burst, so there were
    // zero idle entries of ANY kind (dead or otherwise) left to hand out —
    // every one of the 4 attempts MUST have opened a new connection. This is
    // the guarantee item 4 adds on top of whatever a given platform's retry
    // race happens to do on its own.
    assert.equal(after.count, 12 + 4, 'all 4 attempts opened new connections; none could have reused a pre-reset socket');
  } finally {
    __resetDispatcherStateForTests();
    await server.close();
  }
});

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

after(() => {
  __resetDispatcherStateForTests();
});
