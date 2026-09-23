/**
 * H177 - the wire contract for inline rich-text image maps.
 *
 * Why these assertions and not others: the live defect this fixes was not a
 * wrong value, it was a DISCARDED one. `unwrap()` in ./collections read `items`
 * and `totalCount` off the envelope and dropped everything else, so the map
 * arrived on every single content response and never reached a consumer. The
 * tests that matter therefore pin PRESENCE and MERGE ORDER, because those are
 * the two ways this can silently go back to rendering nothing.
 *
 * Every "returns empty" case below is paired with a case that returns
 * something, so a matcher that broke and answered `{}` for everything would
 * fail rather than look like a clean pass.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRichTextImageUrls, mergeRichTextImageUrls } from './richTextImageUrls.ts';

const URL_A = 'https://media.vivreal.io/vivreal-vivreal/groupObjects/a/slot-2.jpg?Signature=x';
const URL_B = 'https://media.vivreal.io/vivreal-vivreal/groupObjects/a/slot-3.jpg?Signature=y';

test('reads the map off a live envelope shape', () => {
  const map = readRichTextImageUrls({ items: [], totalCount: 0, richTextImageUrls: { 'k/1.jpg': URL_A } });
  assert.deepEqual(map, { 'k/1.jpg': URL_A });
});

test('an empty map is a real answer, not a missing one', () => {
  // `{}` means "this payload references no inline images". It must not be
  // confused with absence, and both still produce an object.
  assert.deepEqual(readRichTextImageUrls({ items: [], totalCount: 0, richTextImageUrls: {} }), {});
});

test('absence degrades to an empty object rather than throwing or returning undefined', () => {
  // A payload cached before v2.10.16 can still be served from the Next.js Data
  // Cache. It must resolve nothing, which is the renderer fail-closed drop.
  assert.deepEqual(readRichTextImageUrls({ items: [], totalCount: 0 }), {});
  assert.deepEqual(readRichTextImageUrls(null), {});
  assert.deepEqual(readRichTextImageUrls(undefined), {});
});

test('the legacy bare-array envelope has nowhere to carry a map', () => {
  assert.deepEqual(readRichTextImageUrls([{ _id: 'x' }]), {});
});

test('non-string values are dropped, because the value becomes an img src', () => {
  const map = readRichTextImageUrls({
    richTextImageUrls: { good: URL_A, nested: { a: 1 }, numeric: 42, empty: '', nothing: null },
  });
  // CONTROL: the good key survives, so this is a filter and not a blanket refusal.
  assert.deepEqual(map, { good: URL_A });
});

test('a richTextImageUrls that is an array, not an object, is refused', () => {
  assert.deepEqual(readRichTextImageUrls({ richTextImageUrls: [URL_A] }), {});
});

test('merge combines every source a page read', () => {
  const merged = mergeRichTextImageUrls({ a: URL_A }, { b: URL_B });
  assert.deepEqual(merged, { a: URL_A, b: URL_B });
});

test('merge is later-wins, which is what makes shell-first correct', () => {
  const merged = mergeRichTextImageUrls({ k: URL_A }, { k: URL_B });
  assert.equal(merged.k, URL_B);
  // CONTROL: reversing the arguments reverses the winner, so this asserts an
  // ORDER and not just whichever value the implementation happened to keep.
  assert.equal(mergeRichTextImageUrls({ k: URL_B }, { k: URL_A }).k, URL_A);
});

test('merge skips nullish sources so callers need no guard', () => {
  assert.deepEqual(mergeRichTextImageUrls(undefined, { a: URL_A }, null), { a: URL_A });
});

test('merging nothing is an empty object, never undefined', () => {
  const merged = mergeRichTextImageUrls();
  assert.deepEqual(merged, {});
  assert.equal(typeof merged, 'object');
});

test('the merged map is a fresh object and never aliases an input', () => {
  // buildPageContext merges maps that belong to cached read results. Mutating
  // one of those in place would poison the Next.js Data Cache entry for every
  // later render on the same instance.
  const shell = { a: URL_A };
  const merged = mergeRichTextImageUrls(shell, { b: URL_B });
  assert.notEqual(merged, shell);
  assert.deepEqual(shell, { a: URL_A });
});
