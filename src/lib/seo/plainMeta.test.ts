import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainMeta } from './plainMeta.ts';

// Walk 4 C15, the finding this exists for.
test('plainMeta: strips the tags a rich-text summary legitimately holds', () => {
  assert.equal(plainMeta('<p>Slow proved for 24 hours.</p>', 160), 'Slow proved for 24 hours.');
});

test('plainMeta: puts a SPACE at a block boundary, because OneTwo is worse than the markup was', () => {
  assert.equal(plainMeta('<p>One</p><p>Two</p>', 160), 'One Two');
  assert.equal(plainMeta('<li>Flour</li><li>Water</li>', 160), 'Flour Water');
  assert.equal(plainMeta('One<br>Two', 160), 'One Two');
});

test('plainMeta: does NOT space an inline tag, so emphasis does not split a word', () => {
  assert.equal(plainMeta('<em>very</em>good', 160), 'verygood');
});

// The half of the job the six existing strippers in [itemId]/page.tsx skip.
test('plainMeta: decodes entities, so the card does not read markup one layer down', () => {
  assert.equal(plainMeta('Salt &amp; pepper', 160), 'Salt & pepper');
  assert.equal(plainMeta('a&nbsp;b', 160), 'a b');
  assert.equal(plainMeta('&quot;Best&quot; loaf', 160), '"Best" loaf');
  assert.equal(plainMeta('Ada&#39;s loaf', 160), "Ada's loaf");
  assert.equal(plainMeta('Ada&#x27;s loaf', 160), "Ada's loaf");
});

test('plainMeta: decodes the ampersand LAST, so &amp;lt; does not become a tag', () => {
  // An author who wrote the literal text "&lt;" gets "&lt;" back, not "<".
  // Decoding & first would invent markup that was never authored.
  assert.equal(plainMeta('&amp;lt;p&amp;gt;', 160), '&lt;p&gt;');
});

test('plainMeta: collapses the whitespace the tags leave behind', () => {
  assert.equal(plainMeta('<p>One</p>\n\n   <p>Two</p>', 160), 'One Two');
});

test('plainMeta: honours the budget and does not leave a trailing space at the cut', () => {
  assert.equal(plainMeta('<p>aaaa bbbb cccc</p>', 5), 'aaaa');
  assert.equal(plainMeta('abcdefghij', 4), 'abcd');
});

test('plainMeta: returns undefined rather than an empty string for nothing to say', () => {
  // The callers chain with `||`, so '' and undefined behave the same there.
  // undefined is returned anyway because it is the honest answer, and a
  // caller that uses `??` would otherwise ship an empty description.
  assert.equal(plainMeta('<p></p>', 160), undefined);
  assert.equal(plainMeta('   ', 160), undefined);
  assert.equal(plainMeta('', 160), undefined);
});

test('plainMeta: returns undefined for anything that is not a string', () => {
  for (const v of [undefined, null, 0, 42, {}, [], true]) {
    assert.equal(plainMeta(v, 160), undefined, String(v));
  }
});

test('plainMeta: leaves plain text completely alone', () => {
  assert.equal(plainMeta('A sourdough loaf, slow proved.', 160), 'A sourdough loaf, slow proved.');
});
