import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// icon.tsx and apple-icon.tsx are JSX, which `node --experimental-strip-types`
// cannot load. Their logo decision is planIconMark in src/lib/og/ogCard.ts,
// tested by being called in ogCard.test.ts. This file pins that both icons
// reach it, and that their image element is only ever fed the plan's source.

const ICONS = ['./icon.tsx', './apple-icon.tsx'] as const;

for (const file of ICONS) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');

  test(`REFUSE (${file}): the raw logo URL is never handed to the image element`, () => {
    // Before the fix: `<img src={logoSrc}>`, so a text wordmark SVG reached
    // resvg, which drew its letters with host fonts the server lacks (boxes).
    assert.doesNotMatch(source, /src=\{logoSrc\}/);
    const imgSources = [...source.matchAll(/<img[\s\S]*?src=\{([^}]+)\}/g)].map((m) => m[1]);
    assert.deepEqual(imgSources, ['mark.src']);
    assert.match(source, /\{mark\.kind === 'image' \? \(/);
  });

  test(`ALLOW (${file}): the mark is planned by the shared decision, and an initial draws in Outfit`, () => {
    assert.match(source, /planIconMark\(logoSrc, siteData\?\.businessInfo\?\.name \|\| siteData\?\.name\)/);
    assert.match(source, /from '@\/lib\/og\/ogCard'/);
    assert.match(source, /loadDisplayFont\(mark\.initial\)/);
    assert.match(source, /\{mark\.initial\}/);
    assert.match(source, /fonts: \[\{ name: 'Outfit', data: fontData/);
  });
}
