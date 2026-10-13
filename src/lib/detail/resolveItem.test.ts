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

// F-C16R: a SYSTEM key is read top-level first, then `objectValue._system`.
test('ALLOW (F-C16R): an item whose slug lives only in _system resolves by it', () => {
  const pool = [{ id: 'x1', raw: { title: 'New', _system: { slug: 'new-cut' } } }];
  assert.equal(resolveItem(pool, 'new-cut', 'slug')?.id, 'x1');
});

test('REFUSE (F-C16R): a stored top-level slug beats _system, so no live address moves', () => {
  const pool = [{ id: 'x1', raw: { slug: 'botox', _system: { slug: 'botox-2' } } }];
  assert.equal(resolveItem(pool, 'botox', 'slug')?.id, 'x1');
  assert.equal(resolveItem(pool, 'botox-2', 'slug'), undefined);
});

test('REFUSE (F-C16R): only SYSTEM keys are read from _system (an owner field is not)', () => {
  const pool = [{ id: 'x1', raw: { _system: { title: 'hidden' } } }];
  assert.equal(resolveItem(pool, 'hidden', 'title'), undefined);
});
