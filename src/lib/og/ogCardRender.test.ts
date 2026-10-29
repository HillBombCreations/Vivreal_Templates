import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// ogCardRender.tsx is JSX, which `node --experimental-strip-types` cannot
// load. The logo decision lives in ./ogCard.ts (resolveOgLogo) and is tested
// by being called in ogCard.test.ts. This file pins that the card reaches it,
// and that the image element can only ever be fed the plan's checked source.

const source = fs.readFileSync(new URL('./ogCardRender.tsx', import.meta.url), 'utf8');

test('REFUSE: the raw logo URL is never handed to the image element', () => {
  // Before the fix: `<img src={logoSrc}>`, so a text wordmark SVG reached
  // resvg, which drew its letters with host fonts the server lacks (boxes).
  assert.doesNotMatch(source, /src=\{logoSrc\}/);
  const imgSources = [...source.matchAll(/<img[\s\S]*?src=\{([^}]+)\}/g)].map((m) => m[1]);
  assert.deepEqual(imgSources, ['logo.src']);
});

test('the logo is planned by the tested decision function', () => {
  assert.match(source, /resolveOgLogo\(logoSrc\)/);
  assert.match(source, /from '\.\/ogCard'/);
  // The image branch is gated on the plan, so `name` can never render an <img>.
  assert.match(source, /\{logo\.kind === 'image' \? \(/);
});

test('ALLOW: a planned `name` draws the site name in the card font', () => {
  // The top slot's text branch renders siteName, and siteName is in the
  // Outfit subset whenever it is shown.
  assert.match(source, /const hasLogo = logo\.kind === 'image';/);
  assert.match(source, /loadDisplayFont\(`\$\{heading\}\$\{showSiteName \? siteName : ''\}`\)/);
  assert.match(source, /showSiteName && \(\s*<div[^>]*>\s*\{siteName\}/);
});
