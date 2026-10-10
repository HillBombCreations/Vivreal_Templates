import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readCommerce } from './commerce.ts';

// The producer's own recorded answer (VR_Client_API feat/v5,
// test/contracts/F-C19/site-data-commerce-paused.json), copied byte for byte.
const RECORDED_PAUSED = { commerce: { state: 'paused', lists: { list1: 'paused' } } };

test('ALLOW (F-C19): the recorded paused payload reads as paused', () => {
  assert.deepEqual(readCommerce(RECORDED_PAUSED.commerce), { state: 'paused', lists: { list1: 'paused' } });
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
