import { test } from 'node:test';
import assert from 'node:assert/strict';
// Owner find 3 (renderer 1.90.0): re-pointed at the renderer export. The
// bodies of the W25-6ca and C2 tests below are unchanged; they now pin the
// renderer's builder, which is the one the layout and Providers stamp.
import { themeTokenStyle, resolveMonoFamily } from '@hillbombcreations/site-renderer/theme';
import { themeVarStyle } from './themeVarStyle.ts';

const SITE = { primary: '#1f3a5f', surface: '#ffffff', 'text-primary': '#111111', name: 'Cobalt', favicon: 'data:x' };

test('the builder the layout and Providers import IS the renderer export, not a copy', () => {
  assert.equal(typeof themeTokenStyle, 'function', 'the renderer subpath did not load the builder');
  assert.equal(themeVarStyle, themeTokenStyle);
});

test('ALLOW (W25-6ca): a site with the three contact button keys emits the three root variables', () => {
  const style = themeTokenStyle({
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
  assert.equal(JSON.stringify(themeTokenStyle(SITE)), before);
  assert.doesNotMatch(JSON.stringify(themeTokenStyle(SITE)), /contact-button/);
});

test('REFUSE (W25-6ca): the general button keys stay out this release, and a blank contact key emits nothing', () => {
  const style = themeTokenStyle({
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
  const style = themeTokenStyle({ ...SITE, 'font-mono': LARKSPUR_MONO }) as Record<string, string>;
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
    const style = themeTokenStyle(site) as Record<string, string>;
    assert.equal(style['--font-mono'], undefined, label);
  }
});

/* ── Owner find 3: what the narrowed builder adds and refuses ──────────────── */

test('ALLOW (find 3): a stored border reaches the server render, as the after-load loop used to stamp it', () => {
  const style = themeTokenStyle({ ...SITE, border: '#e4e4e7' }) as Record<string, string>;
  assert.equal(style['--border'], '#e4e4e7');
});

test('REFUSE (find 3): favicon, chrome, fontFamily and the other stored strings never become root variables', () => {
  const style = themeTokenStyle({
    ...SITE,
    chrome: 'dark',
    fontFamily: 'Geist',
    fontFamilyBody: 'Inter',
    lifecycleState: 'live',
    canonicalUrl: 'https://example.com',
    motionPreset: 'calm',
    timezone: 'America/Chicago',
  }) as Record<string, string>;
  for (const key of ['--favicon', '--chrome', '--fontFamily', '--fontFamilyBody', '--lifecycleState', '--canonicalUrl', '--motionPreset', '--timezone', '--name']) {
    assert.equal(style[key], undefined, key);
  }
  // Control: the same call did emit the whitelisted keys, so the absences above are not an empty result.
  assert.equal(style['--primary'], '#1f3a5f');
});

const PACK_MONO = "'JetBrains Mono', ui-monospace, monospace";

test('ALLOW (find 3): a Type pack mono with no kit key becomes --font-mono', () => {
  const site = { ...SITE, typography: { monoFamily: PACK_MONO } };
  assert.equal(resolveMonoFamily(site), PACK_MONO);
  assert.equal((themeTokenStyle(site) as Record<string, string>)['--font-mono'], PACK_MONO);
});

test('REFUSE (find 3): a kit font-mono beats the pack, by the one rule the server and the client both stamp', () => {
  const site = { ...SITE, 'font-mono': LARKSPUR_MONO, typography: { monoFamily: PACK_MONO } };
  assert.equal(resolveMonoFamily(site), LARKSPUR_MONO);
  assert.equal((themeTokenStyle(site) as Record<string, string>)['--font-mono'], LARKSPUR_MONO);
});

test('REFUSE (find 3): the default call, which Templates uses, never pins a token to initial', () => {
  const style = themeTokenStyle({ primary: '#1f3a5f' }) as Record<string, string>;
  assert.ok(Object.keys(style).length > 0, 'no style built; this test proves nothing');
  assert.ok(!Object.values(style).includes('initial'), JSON.stringify(style));
});
