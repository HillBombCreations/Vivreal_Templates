/**
 * Owner ideas T5/T6: the purchase result is recorded once, and only for an
 * order the server confirmed paid.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordPurchaseIfConfirmed, PURCHASE_RECORDED_KEY_PREFIX } from './siteGoals.ts';
import type { SiteGoal } from './siteEvents.ts';
import type { OrderCheck } from './orderConfirmationId.ts';

const SESSION = 'cs_test_a1B2c3D4e5F6g7H8i9J0';

function store() {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

test('ALLOW: a confirmed paid order records one purchase', async () => {
  const goals: SiteGoal[] = [];
  const storage = store();
  const run = () =>
    recordPurchaseIfConfirmed({ search: `?session_id=${SESSION}`, confirm: async () => 'confirmed', storage, record: (g) => goals.push(g) });
  assert.equal(await run(), true);
  assert.deepEqual(goals, ['purchase']);
  assert.equal(storage.map.get(`${PURCHASE_RECORDED_KEY_PREFIX}${SESSION}`), '1');
  assert.equal(await run(), false, 'a reload records nothing');
  assert.deepEqual(goals, ['purchase']);
});

test('REFUSE: an unconfirmed order, a missing id or a malformed id records nothing', async () => {
  const goals: SiteGoal[] = [];
  const cases: Array<[string, OrderCheck]> = [
    [`?session_id=${SESSION}`, 'no-paid-order'],
    ['', 'confirmed'],
    ['?session_id=<x>', 'confirmed'],
  ];
  for (const [search, verdict] of cases) {
    const recorded = await recordPurchaseIfConfirmed({ search, confirm: async () => verdict, storage: store(), record: (g) => goals.push(g) });
    assert.equal(recorded, false, search);
  }
  assert.deepEqual(goals, []);
});
