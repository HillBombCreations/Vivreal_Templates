import { test } from 'node:test';
import assert from 'node:assert/strict';
import { themeVarStyle } from './themeVarStyle.ts';

const SITE = { primary: '#1f3a5f', surface: '#ffffff', 'text-primary': '#111111', name: 'Cobalt', favicon: 'data:x' };

test('ALLOW (W25-6ca): a site with the three contact button keys emits the three root variables', () => {
  const style = themeVarStyle({
    ...SITE,
    'contact-button-radius': '0px',
    'contact-button-case': 'uppercase',
    'contact-button-tracking': '0.14em',
  }) as Record<string, string>;
  assert.equal(style['--contact-button-radius'], '0px');
  assert.equal(style['--contact-button-case'], 'uppercase');
  assert.equal(style['--contact-button-tracking'], '0.14em');
});

test('REFUSE (W25-6ca): a site without them emits none, byte-identical to the output before 1.85.3', () => {
  // The literal is what the pre-change function (d2a2b71, src/app/layout.tsx) returned for SITE.
  const before = '{"--primary":"#1f3a5f","--surface":"#ffffff","--text-primary":"#111111","--accent-readable":"#1f3a5f","--text-secondary":"color-mix(in oklab, #111111 55%, #ffffff)"}';
  assert.equal(JSON.stringify(themeVarStyle(SITE)), before);
  assert.doesNotMatch(JSON.stringify(themeVarStyle(SITE)), /contact-button/);
});

test('REFUSE (W25-6ca): the general button keys stay out this release, and a blank contact key emits nothing', () => {
  const style = themeVarStyle({
    ...SITE,
    'button-radius': '0px',
    'button-case': 'uppercase',
    'button-tracking': '0.1em',
    'contact-button-radius': '  ',
  }) as Record<string, string>;
  for (const key of ['--button-radius', '--button-case', '--button-tracking', '--contact-button-radius']) {
    assert.equal(style[key], undefined, key);
  }
});

const LARKSPUR_MONO = "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

test('ALLOW (C2): a site font-mono value is on the first server render', () => {
  const style = themeVarStyle({ ...SITE, 'font-mono': LARKSPUR_MONO }) as Record<string, string>;
  assert.equal(style['--font-mono'], LARKSPUR_MONO);
});

test('REFUSE (C2): an absent or blank font-mono emits no --font-mono, so the renderer fallback stands', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['absent', SITE],
    ['empty', { ...SITE, 'font-mono': '' }],
    ['whitespace', { ...SITE, 'font-mono': '   ' }],
    ['not a string', { ...SITE, 'font-mono': 42 }],
  ];
  for (const [label, site] of cases) {
    const style = themeVarStyle(site) as Record<string, string>;
    assert.equal(style['--font-mono'], undefined, label);
  }
});
