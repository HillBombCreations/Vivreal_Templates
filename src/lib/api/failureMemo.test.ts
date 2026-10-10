import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFailureMemo, readWithFailureMemo, FAILURE_MEMO_MS } from './failureMemo.ts';

/**
 * V2: an outage makes ONE upstream call per page request, and a success is never
 * memoised. Each test drives the same `readWithFailureMemo` that
 * `clientFetchCached` calls, with a counting upstream and a fake clock.
 */

const PATH = '/tenant/siteDetails?siteId=abc';
const FALLBACK = { fallback: true } as const;

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

function upstream(behaviour: 'down' | 'up') {
  let calls = 0;
  return {
    get calls() { return calls; },
    read: async () => {
      calls += 1;
      if (behaviour === 'down') throw new Error('connect ECONNREFUSED');
      return { fresh: calls };
    },
  };
}

const returnFallback = () => FALLBACK as unknown as { fresh: number };

test('REFUSE: with the API down, the second pass of one request makes no upstream call', async () => {
  const c = clock();
  const memo = createFailureMemo({ now: c.now });
  const api = upstream('down');

  const first = await readWithFailureMemo(memo, PATH, api.read, returnFallback(), returnFallback);
  c.advance(800); // the separate render pass for the 500, same process
  const second = await readWithFailureMemo(memo, PATH, api.read, returnFallback(), returnFallback);

  assert.equal(api.calls, 1, 'one upstream call for the whole request');
  assert.equal(first, FALLBACK);
  assert.equal(second, FALLBACK);
});

test('ALLOW: a success is never memoised; every read goes upstream', async () => {
  const memo = createFailureMemo({ now: clock().now });
  const api = upstream('up');

  const a = await readWithFailureMemo(memo, PATH, api.read, returnFallback(), returnFallback);
  const b = await readWithFailureMemo(memo, PATH, api.read, returnFallback(), returnFallback);

  assert.equal(api.calls, 2);
  assert.deepEqual(a, { fresh: 1 });
  assert.deepEqual(b, { fresh: 2 });
  assert.equal(memo.size, 0, 'nothing remembered after successes');
});

test('ALLOW: after the window the read goes upstream again', async () => {
  const c = clock();
  const memo = createFailureMemo({ now: c.now });
  const api = upstream('down');

  await readWithFailureMemo(memo, PATH, api.read, returnFallback(), returnFallback);
  c.advance(FAILURE_MEMO_MS);
  await readWithFailureMemo(memo, PATH, api.read, returnFallback(), returnFallback);

  assert.equal(api.calls, 2);
});

test('ALLOW: a recovered API clears the failure, so the next read is fresh', async () => {
  const c = clock();
  const memo = createFailureMemo({ now: c.now });
  const down = upstream('down');
  const up = upstream('up');

  await readWithFailureMemo(memo, PATH, down.read, returnFallback(), returnFallback);
  c.advance(FAILURE_MEMO_MS);
  const recovered = await readWithFailureMemo(memo, PATH, up.read, returnFallback(), returnFallback);
  assert.deepEqual(recovered, { fresh: 1 });
  assert.equal(memo.hasRecentFailure(PATH), false);
});

test('REFUSE: a failure the caller re-throws (402 quota) is never memoised', async () => {
  const memo = createFailureMemo({ now: clock().now });
  const api = upstream('down');
  const quota = new Error('402');
  const rethrow = () => { throw quota; };

  await assert.rejects(readWithFailureMemo(memo, PATH, api.read, returnFallback(), rethrow), quota);
  await assert.rejects(readWithFailureMemo(memo, PATH, api.read, returnFallback(), rethrow), quota);

  assert.equal(api.calls, 2, 'each request re-reads, so the page sees the 402 every time');
  assert.equal(memo.size, 0);
});

test('REFUSE: a failure on one path never answers a different path', async () => {
  const memo = createFailureMemo({ now: clock().now });
  const down = upstream('down');
  const up = upstream('up');

  await readWithFailureMemo(memo, PATH, down.read, returnFallback(), returnFallback);
  const other = await readWithFailureMemo(memo, '/tenant/collectionObjects?id=1', up.read, returnFallback(), returnFallback);

  assert.deepEqual(other, { fresh: 1 });
});

test('the memo is bounded: a flood of distinct failing paths never grows it past the cap', () => {
  const c = clock();
  const memo = createFailureMemo({ now: c.now, maxKeys: 3 });
  for (let i = 0; i < 10; i += 1) memo.recordFailure(`/p${i}`);
  assert.equal(memo.size, 3);
  assert.equal(memo.hasRecentFailure('/p9'), true, 'the newest is kept');
  assert.equal(memo.hasRecentFailure('/p0'), false, 'the oldest went first');
});

/**
 * F-C13 (QA-W7-1b): four concurrent reads of one key in a single render. A
 * slow upstream that fails, so all four are in flight before any settles.
 */
function slowDown() {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  return {
    get calls() { return calls; },
    release: () => release(),
    read: async (): Promise<{ fresh: number }> => {
      calls += 1;
      await gate;
      throw new Error('upstream 500');
    },
  };
}

test('REFUSE (F-C13): 4 concurrent reads of one key make 1 upstream call and 1 capture', async () => {
  const memo = createFailureMemo({ now: clock().now });
  const api = slowDown();
  let captures = 0;
  const capture = () => { captures += 1; return returnFallback(); };

  const reads = Array.from({ length: 4 }, () =>
    readWithFailureMemo(memo, PATH, api.read, returnFallback(), capture));
  api.release();
  const results = await Promise.all(reads);

  assert.equal(api.calls, 1, 'one upstream call');
  assert.equal(captures, 1, 'one failure handler run, so one Sentry capture');
  for (const r of results) assert.equal(r, FALLBACK);
  assert.equal(memo.inFlight.size, 0, 'nothing left in flight');
});

test('must-fail control (F-C13): with no shared memo, the same 4 reads make 4 calls and 4 captures', async () => {
  const api = slowDown();
  let captures = 0;
  const capture = () => { captures += 1; return returnFallback(); };

  // Each read gets its own memo: what one shared memo neutralised looks like.
  const reads = Array.from({ length: 4 }, () =>
    readWithFailureMemo(createFailureMemo({ now: clock().now }), PATH, api.read, returnFallback(), capture));
  api.release();
  await Promise.all(reads);

  assert.equal(api.calls, 4);
  assert.equal(captures, 4);
});

test('ALLOW (F-C13): concurrent reads of one key share a success, and nothing is memoised', async () => {
  const memo = createFailureMemo({ now: clock().now });
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const read = async () => { calls += 1; await gate; return { fresh: calls }; };

  const reads = Array.from({ length: 3 }, () => readWithFailureMemo(memo, PATH, read, returnFallback(), returnFallback));
  release();
  const results = await Promise.all(reads);

  assert.equal(calls, 1);
  for (const r of results) assert.deepEqual(r, { fresh: 1 });
  assert.equal(memo.size, 0);
  assert.equal(memo.inFlight.size, 0);
});

test('REFUSE (F-C13): a joiner of a read whose handler re-throws (402) gets the same throw, and nothing is memoised', async () => {
  const memo = createFailureMemo({ now: clock().now });
  const api = slowDown();
  const quota = new Error('402');
  const rethrow = () => { throw quota; };

  const reads = Array.from({ length: 2 }, () => readWithFailureMemo(memo, PATH, api.read, returnFallback(), rethrow));
  api.release();
  for (const r of reads) await assert.rejects(r, quota);

  assert.equal(api.calls, 1);
  assert.equal(memo.size, 0);
  assert.equal(memo.inFlight.size, 0);
});

test('ALLOW (F-C13): reads of different keys never join each other', async () => {
  const memo = createFailureMemo({ now: clock().now });
  let calls = 0;
  const read = async () => { calls += 1; return { fresh: calls }; };

  await Promise.all([
    readWithFailureMemo(memo, '/a', read, returnFallback(), returnFallback),
    readWithFailureMemo(memo, '/b', read, returnFallback(), returnFallback),
  ]);
  assert.equal(calls, 2);
});
