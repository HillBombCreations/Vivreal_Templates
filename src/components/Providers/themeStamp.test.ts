import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { themeVarStyle } from '../../lib/theme/themeVarStyle.ts';

/**
 * Owner find 3 (renderer 1.90.0, gate G-T): the root element's theme
 * variables have ONE writer. The layout server-renders `themeVarStyle` (the
 * renderer's `themeTokenStyle`) onto <html>, and the `Providers` effect stamps
 * the same builder after load. Before this the effect stamped every string
 * field of siteData as `--<key>`, so the server render and the hydrated page
 * differed (`--border` arrived only after load, `--favicon` a data URI, and
 * so on). This file pins the wiring; `themeParity.test.ts` proves the narrowing
 * safe over the fleet.
 */

function read(relative: string): string {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  assert.ok(source.length > 200, `${relative} was not read (moved or renamed?)`);
  return source;
}

/** Block comments and whole-line `//` comments out, so a docblock cannot satisfy or trip a pin. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('REFUSE: Providers no longer stamps every string field of siteData onto <html>', () => {
  const providers = code(read('./index.tsx'));
  assert.match(providers, /useEffect\(/, 'parsed Providers but found no effect; this test proves nothing');
  assert.doesNotMatch(providers, /Object\.entries\(siteData\)/);
  assert.doesNotMatch(providers, /setProperty\(`--\$\{/);
  assert.doesNotMatch(providers, /readableAccentOnWhite/);
});

test('ALLOW: Providers stamps exactly the builder output, from the module the layout server-renders', () => {
  const providers = code(read('./index.tsx'));
  const layout = code(read('../../app/layout.tsx'));
  const importLine = /import \{ themeVarStyle \} from '@\/lib\/theme\/themeVarStyle';/;
  assert.match(providers, importLine);
  assert.match(layout, importLine);
  assert.match(providers, /const themeStyle = themeVarStyle\(siteData as unknown as Record<string, unknown>\) \?\? \{\};/);
  assert.match(providers, /for \(const \[property, value\] of Object\.entries\(themeStyle\)\) \{\s*document\.documentElement\.style\.setProperty\(property, String\(value\)\);\s*\}/);
  assert.match(layout, /const themeStyle = themeVarStyle\(siteData as unknown as Record<string, unknown>\);/);
  assert.match(layout, /style=\{themeStyle\}/);
});

test('REFUSE: the server render does not leave a stored border to the after-load stamp', () => {
  // Before find 3 `--border` was on <html> only after hydration, from the
  // string loop. The server render now carries the same value.
  const style = themeVarStyle({ primary: '#1f3a5f', border: '#e4e4e7' }) as Record<string, string> | undefined;
  assert.ok(style, 'no style built; this test proves nothing');
  assert.equal(style['--primary'], '#1f3a5f');
  assert.equal(style['--border'], '#e4e4e7');
});

test('REFUSE: Templates carries no second copy of the accent rule (the renderer builder is the one copy)', () => {
  const accent = code(read('../../lib/theme/readableAccent.ts'));
  // Control: the file still exports the item page's button-ink rule.
  assert.match(accent, /export function inkOnAccentIfFailsAA\(/);
  assert.doesNotMatch(accent, /readableAccentOnWhite/);
});
