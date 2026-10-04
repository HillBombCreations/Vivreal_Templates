import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithReconnect } from './fetchWithReconnect.ts';
import { AWAKE_MAX_CREDIT_MS } from '../awakeTimeout.ts';

/**
 * Test B (idle-dead-socket-research-2026-10-04.md, section 4). Mock timers,
 * no real sockets — this drives the BACKOFF SCHEDULE, not the connection
 * layer (that is `./fetchWithReconnect.socket.test.ts`). Follows
 * `../awakeTimeout.test.ts`'s own harness style: `node:test`'s `mock.timers`
 * replaces `setInterval`/`Date`, so `startAwakeTimeout` (which `fetchWithReconnect`
 * calls internally between retries) is driven deterministically.
 */

function deadSocket(code = 'UND_ERR_SOCKET'): TypeError {
  return new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) });
}

const realFetch = globalThis.fetch;

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
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the ambient `fetch`
    (globalThis as any).fetch = async () => {
      calls += 1;
      throw deadSocket();
    };

    const resultPromise = fetchWithReconnect('https://client.vivreal.io/x', undefined, {
      backoffMs: [150, 500],
    });
    resultPromise.catch(() => {}); // a rejection must never become an unhandled rejection mid-test

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
