import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruneExpiredRichTextUrls, RICH_TEXT_EXPIRY_MARGIN_MS } from './richTextExpiry.ts';

/** T5 (site-first-read-fallback plan, section 7). */

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const signed = (expiresAtMs: number) =>
  `https://media.vivreal.io/g/img.png?Expires=${Math.floor(expiresAtMs / 1000)}&Signature=abc&Key-Pair-Id=K1`;

test('T5 REFUSE: an expired URL is removed', () => {
  assert.deepEqual(pruneExpiredRichTextUrls({ a: signed(NOW - 1000) }, NOW), {});
});

test('T5 REFUSE: a URL expiring within 900 s is removed (it would die on a cached floor page)', () => {
  assert.deepEqual(pruneExpiredRichTextUrls({ a: signed(NOW + 600_000) }, NOW), {});
  assert.deepEqual(pruneExpiredRichTextUrls({ a: signed(NOW + RICH_TEXT_EXPIRY_MARGIN_MS) }, NOW), {});
});

test('T5 ALLOW: a URL expiring later than the margin is kept', () => {
  const later = signed(NOW + 3_600_000);
  assert.deepEqual(pruneExpiredRichTextUrls({ a: later }, NOW), { a: later });
});

test('T5 ALLOW: a malformed or unsigned URL is kept untouched (nothing proves it dead)', () => {
  const map = { bad: 'not a url', plain: 'https://client.vivreal.io/media?bucket=b&key=k', odd: 'https://x/?Expires=soon' };
  assert.deepEqual(pruneExpiredRichTextUrls(map, NOW), map);
});

test('T5: the margin is 900 s, longer than a floor page lives in the caches (300 s origin plus 300 s edge)', () => {
  assert.equal(RICH_TEXT_EXPIRY_MARGIN_MS, 900_000);
});
