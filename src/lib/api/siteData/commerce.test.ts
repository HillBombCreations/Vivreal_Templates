import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readCommerce } from './commerce.ts';

// The producer's own recorded answers (VR_Client_API fix/v5-fp2-k 37454c9,
// test/contracts/F-C19/site-data-commerce-paused.json and
// FP2-02/site-data-commerce-not-ready.json), copied byte for byte. From FP2-02
// the payload carries `ready`; a shop that is not ready already reads `paused`,
// so `ready` itself is not read here.
const RECORDED_PAUSED = { commerce: { state: 'paused', lists: { list1: 'paused' }, ready: true } };
const RECORDED_NOT_READY = { commerce: { state: 'paused', lists: {}, ready: false } };

test('ALLOW (F-C19): the recorded paused payload reads as paused', () => {
  assert.deepEqual(readCommerce(RECORDED_PAUSED.commerce), { state: 'paused', lists: { list1: 'paused' } });
});

test('ALLOW (FP2-02): a shop whose payment account is not ready reads as paused', () => {
  assert.deepEqual(readCommerce(RECORDED_NOT_READY.commerce), { state: 'paused', lists: {} });
});

test('REFUSE (F-C19): a malformed or unknown commerce reads as absent (selling), never as paused', () => {
  for (const raw of [undefined, null, 'paused', 7, {}, { state: 'frozen' }, { state: 'PAUSED' }]) {
    assert.equal(readCommerce(raw), undefined, JSON.stringify(raw));
  }
  assert.deepEqual(readCommerce({ state: 'selling', lists: { a: 'archived', b: 'moving' } }), {
    state: 'selling',
    lists: { b: 'moving' },
  });
});

test('getSiteData maps the top-level commerce and updatedAt (pinned from source: the module is server-only)', () => {
  const code = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.match(code, /commerce: readCommerce\(raw\.commerce\),/);
  assert.match(code, /updatedAt: raw\.updatedAt \?\? null,/);
});
