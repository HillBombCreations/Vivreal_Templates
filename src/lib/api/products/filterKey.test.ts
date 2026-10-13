import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterKey } from './filterKey.ts';

test('ALLOW: a seeded filter keeps its stored key, which is not its title', () => {
  assert.equal(filterKey({ title: 'Category', key: 'productType', filters: ['Sale'] }), 'productType');
});

test('ALLOW (F-C16R): a key kept only in _system is read', () => {
  assert.equal(filterKey({ title: 'Category', _system: { key: 'productType' } }), 'productType');
});

test('REFUSE (F-C16R): a stored top-level key beats _system', () => {
  assert.equal(filterKey({ title: 'Category', key: 'productType', _system: { key: 'other' } }), 'productType');
});

test('ALLOW: an owner-added filter with no key narrows by the field named as its title, exactly as typed', () => {
  assert.equal(filterKey({ title: '  Color ', filters: ['Red'] }), 'Color');
  assert.equal(filterKey({ title: 'Gift Wrap', filters: ['Yes'] }), 'Gift Wrap');
});

test('REFUSE: the title never displaces a stored key, and is not lower-cased or slugged', () => {
  assert.equal(filterKey({ title: 'Price', key: 'price' }), 'price');
  assert.notEqual(filterKey({ title: 'Gift Wrap' }), 'gift-wrap');
});

test('REFUSE: a blank key falls through, and nothing at all gives an empty key', () => {
  assert.equal(filterKey({ title: 'Size', key: '  ' }), 'Size');
  assert.equal(filterKey({}), '');
});
