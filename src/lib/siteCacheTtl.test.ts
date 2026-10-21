import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SITE_CACHE_TTL_SECONDS, parseSiteCacheTtlSeconds } from './siteCacheTtl.ts';

test('the default stays 60, under the signed media URL lifetime', () => {
  assert.equal(DEFAULT_SITE_CACHE_TTL_SECONDS, 60);
  assert.equal(parseSiteCacheTtlSeconds(undefined), 60);
  assert.equal(parseSiteCacheTtlSeconds(''), 60);
});

test('ALLOW: a positive number is used as given, floored', () => {
  assert.equal(parseSiteCacheTtlSeconds('60'), 60);
  assert.equal(parseSiteCacheTtlSeconds('300'), 300);
  assert.equal(parseSiteCacheTtlSeconds('86400'), 86400);
  assert.equal(parseSiteCacheTtlSeconds('90.7'), 90);
});

test('REFUSE: zero, negative and non-numeric values fall back to the default', () => {
  for (const raw of ['0', '0.5', '-5', 'abc', 'NaN', 'Infinity']) {
    assert.equal(parseSiteCacheTtlSeconds(raw), 60, raw);
  }
});
