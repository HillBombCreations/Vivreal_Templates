import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveItem, isDoorwayMiss } from './resolveItem.ts';

const items = [
  { id: '507f1f77bcf86cd799439011', raw: { slug: 'botox' } },
  { id: '507f1f77bcf86cd799439012', raw: { slug: 'juvederm' } },
];

test('resolveItem: _id wins even when itemKeyField is configured (no existing URL changes meaning)', () => {
  const hit = resolveItem(items, '507f1f77bcf86cd799439011', 'slug');
  assert.equal(hit?.raw?.slug, 'botox');
});

test('resolveItem: absent itemKeyField ⇒ _id-only lookup (byte-identical)', () => {
  assert.equal(resolveItem(items, 'botox'), undefined);
  assert.equal(resolveItem(items, '507f1f77bcf86cd799439012')?.raw?.slug, 'juvederm');
});

test('resolveItem: itemKeyField fallback resolves a slug the _id lookup misses', () => {
  const hit = resolveItem(items, 'juvederm', 'slug');
  assert.equal(hit?.id, '507f1f77bcf86cd799439012');
});

test('resolveItem: no match in either arm ⇒ undefined', () => {
  assert.equal(resolveItem(items, 'laser-hair-removal', 'slug'), undefined);
});

test('isDoorwayMiss: true when the item exists in the wider pool (a scope excluded it)', () => {
  assert.equal(isDoorwayMiss(items, 'juvederm', 'slug'), true);
});

test('isDoorwayMiss: false when the item does not exist anywhere (a genuine 404)', () => {
  assert.equal(isDoorwayMiss(items, 'laser-hair-removal', 'slug'), false);
});
