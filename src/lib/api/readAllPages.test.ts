import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAllPages } from './readAllPages.ts';

/** A paged upstream holding `total` rows, answering like VR_Client_API. */
function upstream(total: number, { degradedAtSkip }: { degradedAtSkip?: number } = {}) {
  const calls: Array<[number, number]> = [];
  return {
    calls,
    read: async (skip: number, limit: number) => {
      calls.push([skip, limit]);
      if (skip === degradedAtSkip) return { items: [], totalCount: 0, degraded: true };
      const capped = Math.min(limit, 100);
      const items = Array.from({ length: Math.max(0, Math.min(capped, total - skip)) }, (_, i) => skip + i);
      return { items, totalCount: total, degraded: false };
    },
  };
}

test('ALLOW (R4): 150 items read in two pages list all 150', async () => {
  const api = upstream(150);
  const all = await readAllPages(api.read);
  assert.equal(all.items.length, 150);
  assert.deepEqual(api.calls, [[0, 100], [100, 100]]);
  assert.equal(all.degraded, false);
  assert.equal(all.truncated, false);
});

test('must-fail control (R4): one read of the same list, as before, stops at 100', async () => {
  const api = upstream(150);
  const one = await api.read(0, 100);
  assert.equal(one.items.length, 100);
});

test('R4: a short list is one read', async () => {
  const api = upstream(7);
  assert.equal((await readAllPages(api.read)).items.length, 7);
  assert.equal(api.calls.length, 1);
});

test('REFUSE (R4): a degraded page makes the whole list degraded and stops', async () => {
  const api = upstream(250, { degradedAtSkip: 100 });
  const all = await readAllPages(api.read);
  assert.equal(all.degraded, true);
  assert.equal(api.calls.length, 2);
});

test('R4: a runaway list stops at maxItems and says so', async () => {
  const api = upstream(10_000);
  const all = await readAllPages(api.read, { maxItems: 300 });
  assert.equal(all.items.length, 300);
  assert.equal(all.truncated, true);
  assert.equal(api.calls.length, 3);
});

test('R4: a list that shrinks mid-read (a short page) ends cleanly', async () => {
  let n = 0;
  const all = await readAllPages(async () => {
    n += 1;
    return n === 1
      ? { items: Array.from({ length: 100 }, (_, i) => i), totalCount: 150, degraded: false }
      : { items: [100, 101], totalCount: 102, degraded: false };
  });
  assert.equal(all.items.length, 102);
  assert.equal(n, 2);
});
