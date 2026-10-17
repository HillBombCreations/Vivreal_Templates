import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_INLINE_FAVICON_CHARS, resolveServableFavicon } from './faviconGuard.ts';

// The node test runner runs each file in its own process, so the once-per-
// process warning state starts clean here and the order below is the order
// it is observed in.

test('an oversized inline favicon warns ONCE per process, with its length and never its payload', () => {
  const payload = 'QUJD'.repeat(10_000);
  const oversized = 'data:image/png;base64,' + payload;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  try {
    assert.equal(resolveServableFavicon(oversized), undefined);
    assert.equal(resolveServableFavicon(oversized), undefined);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1, 'one warning, not one per render');
  assert.match(warnings[0], new RegExp(`${oversized.length} characters`));
  assert.ok(!warnings[0].includes('QUJD'), 'the favicon payload must never reach the log');
  assert.ok(!warnings[0].includes('base64,'), 'not even its header');
});

test('allowed favicons never warn', () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (msg: string) => warnings.push(msg);
  try {
    assert.equal(resolveServableFavicon('https://media.vivreal.io/favicon.png'), 'https://media.vivreal.io/favicon.png');
    const atCap = 'data:,' + 'a'.repeat(MAX_INLINE_FAVICON_CHARS - 6);
    assert.equal(resolveServableFavicon(atCap), atCap);
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 0);
});

test('non-string and empty stored values resolve to undefined', () => {
  for (const value of [undefined, null, 0, {}, [], '', '   ']) {
    assert.equal(resolveServableFavicon(value), undefined, JSON.stringify(value));
  }
});
