import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWithReconnect,
  SHORT_CIRCUIT_WINDOW_MS,
  __resetShortCircuitForTests,
} from './fetchWithReconnect.ts';
import { AWAKE_MAX_CREDIT_MS } from '../awakeTimeout.ts';

/**
 * Test B (idle-dead-socket-research-2026-10-04.md, section 4). Mock timers,
 * no real sockets — this drives the BACKOFF SCHEDULE, not the connection
 * layer (that is `./fetchWithReconnect.socket.test.ts`). Follows
 * `../awakeTimeout.test.ts`'s own harness style: `node:test`'s `mock.timers`
 * replaces `setInterval`/`Date`, so `startAwakeTimeout` (which `fetchWithReconnect`
 * calls internally between retries) is driven deterministically.
 *
 * The SHORT-CIRCUIT tests near the end cover review-templates-183.md concern
 * 3: a per-module-instance short-circuit that skips the backoff wait for a
 * short window after any call exhausts its retries, so a render with many
 * serial reads during a real outage pays the backoff once, not once per read.
 */

function deadSocket(code = 'UND_ERR_SOCKET'): TypeError {
  return new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) });
}

const realFetch = globalThis.fetch;

// The short-circuit is per-module-instance state by design — see its own
// header in `fetchWithReconnect.ts`. Reset it around every test in this file
// so one test's exhausted retry chain cannot silently skip another test's
// backoff wait, which would read as the wrong test failing.
beforeEach(() => {
  __resetShortCircuitForTests();
});
afterEach(() => {
  __resetShortCircuitForTests();
});

test('ALLOW: a failure that clears before the backoff budget is spent succeeds, with the retry landing well after awake-offset 0', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  let calls = 0;
  const callOffsets: number[] = [];
  const start = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      calls += 1;
      callOffsets.push(Date.now() - start);
      if (calls === 1) throw deadSocket();
      return new Response('ok', { status: 200 });
    };

    const resultPromise = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150],
    });

    // Flush the microtasks the first (failing) attempt needs, with ZERO
    // ticks elapsed: the retry must not have fired yet — this is the
    // red-on-the-old-code case, since the pre-backoff loop retried here with
    // no wait at all.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls, 1, 'the retry must wait for awake time, not fire immediately');

    for (let i = 0; i < 5 && calls < 2; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }

    assert.equal(calls, 2);
    assert.ok(
      callOffsets[1] >= 100,
      `the retry landed at ${callOffsets[1]}ms of awake time — it must not sit at offset 0 like a zero-delay loop`,
    );
    const res = await resultPromise;
    assert.equal(res.status, 200);
  } finally {
    globalThis.fetch = realFetch;
    t.mock.timers.reset();
  }
});

test('REFUSE: a failure that outlasts the whole backoff schedule still gives up, after spending roughly the configured budget and no more', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  let calls = 0;
  const callOffsets: number[] = [];
  const start = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      calls += 1;
      callOffsets.push(Date.now() - start);
      throw deadSocket();
    };

    const resultPromise = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150, 500],
    });
    resultPromise.catch(() => {}); // a rejection must never become an unhandled rejection mid-test

    // Flush the first (synchronous) attempt's rejection before any tick —
    // same reason the ALLOW test above does this: `tick()` runs synchronously
    // and would otherwise fire before the pending microtask that logs this
    // first failure, which would charge its offset against a tick it did not
    // actually wait through.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(callOffsets[0], 0, 'control: the first attempt must be charged no awake time at all');

    // Advance in 100ms steps — the awake tracker's own tick granularity —
    // for up to 1000ms of mocked time, comfortably covering 150 + 500 = 650ms
    // plus interval-boundary rounding, and confirm it settles within that
    // bound rather than hanging or spinning past it.
    for (let i = 0; i < 10 && calls < 3; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }

    assert.equal(calls, 3, 'exactly NETWORK_RETRIES + 1 attempts, no more — the budget bounds it, it does not retry forever');
    // The assertion the old zero-delay code could never satisfy: it retried
    // immediately every time, so the third call always landed at awake-offset
    // 0. The schedule here is 150ms then 500ms, 650ms combined; bracket it on
    // both sides (tick granularity, not the exact count) so this fails on a
    // backoff that never engages without over-pinning one specific tick path.
    assert.ok(
      callOffsets[2] >= 600,
      `the third call landed at ${callOffsets[2]}ms of awake time — the 150+500ms schedule must have been spent, not skipped`,
    );
    assert.ok(
      callOffsets[2] <= 800,
      `the third call landed at ${callOffsets[2]}ms — too late for the 650ms schedule plus tick rounding`,
    );
    await assert.rejects(resultPromise);
  } finally {
    globalThis.fetch = realFetch;
    t.mock.timers.reset();
  }
});

test('FREEZE: a wall-clock jump mid-backoff does not pay down the budget — only real awake ticks do', async (t) => {
  // Same guarantee `../awakeTimeout.test.ts` already pins at the unit level
  // (a freeze credits at most AWAKE_MAX_CREDIT_MS per tick); this confirms it
  // actually reaches `fetchWithReconnect`'s own backoff wait, not just
  // `startAwakeTimeout` in isolation.
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  let calls = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      calls += 1;
      if (calls === 1) throw deadSocket();
      return new Response('ok', { status: 200 });
    };

    // backoffMs[0] is deliberately LARGER than one capped freeze credit, so a
    // single frozen jump cannot satisfy it on its own.
    const backoffMs = AWAKE_MAX_CREDIT_MS + 100;
    const resultPromise = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [backoffMs],
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls, 1);

    // The freeze: jump the clock far ahead with NO intervening tick, exactly
    // as a process thaws and its first timer tick sees a huge gap.
    t.mock.timers.setTime(Date.now() + 60_000);
    t.mock.timers.tick(1); // the first tick after thaw: fires once, credits AT MOST the cap
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls, 1, `a frozen 60s gap must not alone satisfy a ${backoffMs}ms budget`);

    // Real awake progress finishes the job.
    for (let i = 0; i < 5 && calls < 2; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }
    assert.equal(calls, 2);
    const res = await resultPromise;
    assert.equal(res.status, 200);
  } finally {
    globalThis.fetch = realFetch;
    t.mock.timers.reset();
  }
});

test('CONTROL: a POST and an already-aborted signal make exactly one call regardless of backoffMs — nothing is ever waited for a request that is never retried', async () => {
  let calls = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      calls += 1;
      throw deadSocket();
    };
    await assert.rejects(
      fetchWithReconnect('https://client.vivreal.io/x', { method: 'POST', body: '{}' }, { backoffMs: [150, 500] }),
    );
    assert.equal(calls, 1, 'a POST must never be replayed, backoff or not');

    calls = 0;
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      fetchWithReconnect('https://client.vivreal.io/x', { signal: controller.signal }, { backoffMs: [150, 500] }),
    );
    assert.equal(calls, 1, "the caller's own abort must never be waited past");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('SHORT-CIRCUIT window: a call shortly after another exhausts its retries skips the backoff wait', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  try {
    // First call: fails every attempt, exhausts NETWORK_RETRIES, arms the
    // short-circuit (see fetchWithReconnect.ts, SHORT_CIRCUIT_WINDOW_MS).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      throw deadSocket();
    };
    const first = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150, 500],
    });
    first.catch(() => {});
    for (let i = 0; i < 10; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }
    await assert.rejects(first);

    // Second call, same (mocked) moment: fails once, then recovers. Under the
    // normal schedule the retry only lands once awake time has been spent
    // (the ALLOW test's own assertion, `>= 100`). Short-circuited, it must be
    // immediate — this is the case that is RED without this fix: a render
    // with many serial failing reads during a real outage pays the full
    // backoff schedule on EVERY read (review-templates-183.md concern 3).
    let calls = 0;
    const callOffsets: number[] = [];
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      calls += 1;
      callOffsets.push(Date.now() - start);
      if (calls === 1) throw deadSocket();
      return new Response('ok', { status: 200 });
    };
    const second = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150, 500],
    });
    for (let i = 0; i < 20 && calls < 2; i += 1) {
      await Promise.resolve();
    }
    assert.equal(calls, 2, 'short-circuited: the retry must fire without waiting for any awake time at all');
    assert.equal(
      callOffsets[1],
      0,
      `the retry landed at ${callOffsets[1]}ms of awake time — it must be immediate once short-circuited`,
    );
    const res = await second;
    assert.equal(res.status, 200);
  } finally {
    globalThis.fetch = realFetch;
    t.mock.timers.reset();
  }
});

test('SHORT-CIRCUIT expiry: after SHORT_CIRCUIT_WINDOW_MS the normal backoff applies again', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      throw deadSocket();
    };
    const first = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150, 500],
    });
    first.catch(() => {});
    for (let i = 0; i < 10; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }
    await assert.rejects(first);

    // Let the window close — exactly what a freeze between two invocations
    // would do, which is deliberate (see the module header: the freeze itself
    // is time for the upstream to have recovered, so the next invocation
    // deserves a full backoff chance again).
    t.mock.timers.tick(SHORT_CIRCUIT_WINDOW_MS + 100);
    await Promise.resolve();

    let calls = 0;
    const callOffsets: number[] = [];
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      calls += 1;
      callOffsets.push(Date.now() - start);
      if (calls === 1) throw deadSocket();
      return new Response('ok', { status: 200 });
    };
    const second = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150],
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls, 1, 'the retry must wait again — the short-circuit window has expired');

    for (let i = 0; i < 5 && calls < 2; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }
    assert.equal(calls, 2);
    assert.ok(
      callOffsets[1] >= 100,
      `the retry landed at ${callOffsets[1]}ms — the normal backoff must apply again once the window has expired`,
    );
    const res = await second;
    assert.equal(res.status, 200);
  } finally {
    globalThis.fetch = realFetch;
    t.mock.timers.reset();
  }
});

test('SHORT-CIRCUIT arming requires `transient`: an abort on the FINAL attempt must not arm it (review-templates-184.md item 3)', async (t) => {
  // The arming guard is `replayable && transient && attempt >= retries`
  // (fetchWithReconnect.ts). review-templates-184.md's mutation table found
  // dropping `transient` from it left every existing short-circuit test
  // green, because each one aborts on attempt 1 (index 0 or 1), where
  // `attempt >= retries` is ALREADY false regardless of `transient` — the
  // mutated and real guard agree there for the wrong reason. Only an abort
  // that reaches the FINAL attempt (the one where `attempt >= retries` is
  // independently true, same as an ordinary exhausted retry chain) can tell
  // them apart. Two ordinary transient failures retry normally here, then the
  // caller's own signal aborts mid-wait before the THIRD (final, NETWORK_
  // RETRIES = 2) attempt — exactly what `edgeSiteMap.ts`'s cold/warm budget
  // firing late in a retry chain looks like.
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  try {
    const controller = new AbortController();
    let calls = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
      calls += 1;
      if (init?.signal?.aborted) {
        throw new DOMException('This operation was aborted', 'AbortError');
      }
      throw deadSocket();
    };

    const chain = fetchWithReconnect('https://client.vivreal.io/x', { signal: controller.signal }, {
      backoffMs: [150, 500],
    });
    chain.catch(() => {});

    // Attempt 1 (index 0): transient, schedules the 150ms wait.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls, 1, 'control: the first attempt must fire before any tick');

    // Let the 150ms wait elapse — attempt 2 (index 1) fires, also transient,
    // and schedules the 500ms wait that precedes the FINAL attempt (index 2).
    for (let i = 0; i < 5 && calls < 2; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }
    assert.equal(calls, 2, 'control: the second attempt must have fired before the abort');
    // `calls` increments the instant the stub is invoked, but the surrounding
    // `catch` block needs a few more microtask turns to reach its own
    // `await awaitAwake(500, signal)` and attach the abort listener there —
    // flush those before aborting, or the abort fires too early to be seen.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Abort mid-wait, before the 500ms elapses. The FINAL attempt (index 2,
    // where `attempt >= retries` is independently true) now sees an aborted
    // signal and throws AbortError immediately, without waiting out the rest
    // of the schedule.
    controller.abort();
    for (let i = 0; i < 10 && calls < 3; i += 1) {
      await Promise.resolve();
    }
    assert.equal(calls, 3, 'the final attempt must fire immediately once the abort cancels the wait');
    await assert.rejects(chain, (err: unknown) => err instanceof DOMException && err.name === 'AbortError');

    // The real guard requires `transient` as well as `attempt >= retries`.
    // The failure that ended this chain is an abort (`transient` is false —
    // see `isTransientNetworkError`), so even though `attempt(2) >= retries(2)`
    // is independently true, the short-circuit must NOT be armed. Proven the
    // same way the sibling test above proves it: an unrelated, ordinary GET
    // must still pay the FULL backoff schedule.
    let plainCalls = 0;
    const callOffsets: number[] = [];
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      plainCalls += 1;
      callOffsets.push(Date.now() - start);
      if (plainCalls === 1) throw deadSocket();
      return new Response('ok', { status: 200 });
    };
    const plain = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150, 500],
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    for (let i = 0; i < 10 && plainCalls < 2; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }
    assert.equal(plainCalls, 2, 'the retry must still run');
    assert.ok(
      callOffsets[1] >= 100,
      `the retry landed at ${callOffsets[1]}ms — the FINAL-attempt abort above must not have armed the short-circuit`,
    );
    const res = await plain;
    assert.equal(res.status, 200);
  } finally {
    globalThis.fetch = realFetch;
    t.mock.timers.reset();
  }
});

test('SHORT-CIRCUIT does NOT arm on a POST failure or on the caller\'s own abort (review-templates-183.md pass 2, concern 4)', async (t) => {
  // The arming guard today is `replayable && transient && attempt >= retries`
  // (fetchWithReconnect.ts). Replacing it with `if (true)` — arming on ANY
  // exhausted call, including a non-replayable POST or the caller's own
  // abort — left all 6 backoff tests above green, because none of them makes
  // a POST or an abort immediately precede a plain failing GET. This test
  // does both, then proves a THIRD, ordinary GET still pays the full
  // schedule: if the guard ever arms on the wrong failure, this is the call
  // that goes red.
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1_000_000 });
  try {
    // 1) A POST that fails every attempt. `replayable` is false for a POST,
    // so the real guard's own condition is false regardless of outcome —
    // this must never arm the short-circuit.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      throw deadSocket();
    };
    await assert.rejects(
      fetchWithReconnect(
        'https://client.vivreal.io/x',
        { method: 'POST', body: '{}' },
        { backoffMs: [150, 500] },
      ),
    );

    // 2) A GET whose OWN signal aborts mid-chain — exactly `edgeSiteMap.ts`'s
    // 800ms (now cold/warm) deadline firing while a retry is waiting. The
    // first attempt fails transiently (so a retry gets scheduled), the
    // caller's own abort fires during that wait, and the resumed attempt
    // immediately rejects because `fetch()` sees an already-aborted signal
    // (WHATWG behaviour, mirrored by the stub below). An abort is the
    // caller's decision, never a transient network fault, so this must not
    // arm the short-circuit either.
    const controller = new AbortController();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        throw new DOMException('This operation was aborted', 'AbortError');
      }
      throw deadSocket();
    };
    const aborting = fetchWithReconnect(
      'https://client.vivreal.io/x',
      { signal: controller.signal },
      { backoffMs: [150, 500] },
    );
    aborting.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();
    controller.abort(); // mid-wait, before the 150ms backoff elapses
    await Promise.resolve();
    await Promise.resolve();
    await assert.rejects(aborting);

    // 3) A plain failing GET, uninvolved in either case above, must still pay
    // the FULL backoff schedule. A loosened guard would have armed the
    // short-circuit in step 1 or step 2, and this call would wrongly land its
    // retry at awake-offset 0.
    let calls = 0;
    const callOffsets: number[] = [];
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      calls += 1;
      callOffsets.push(Date.now() - start);
      if (calls === 1) throw deadSocket();
      return new Response('ok', { status: 200 });
    };
    const third = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150, 500],
    });
    // Flush the first (synchronous) attempt's rejection BEFORE any tick, same
    // as the REFUSE test above: if the guard were ever loosened and this call
    // were wrongly short-circuited, the retry would already have happened by
    // here, with NO clock movement at all, so callOffsets[1] would read 0 —
    // ticking first would hide that by crediting it with time it never
    // actually waited.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    for (let i = 0; i < 10 && calls < 2; i += 1) {
      t.mock.timers.tick(100);
      await Promise.resolve();
      await Promise.resolve();
    }
    assert.equal(calls, 2, 'the retry must still run');
    assert.ok(
      callOffsets[1] >= 100,
      `the retry landed at ${callOffsets[1]}ms — neither the POST failure nor the caller's abort above may have armed the short-circuit`,
    );
    const res = await third;
    assert.equal(res.status, 200);
  } finally {
    globalThis.fetch = realFetch;
    t.mock.timers.reset();
  }
});
