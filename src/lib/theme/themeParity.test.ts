import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { themeTokenStyle, resolveMonoFamily, THEME_TOKEN_KEYS } from '@hillbombcreations/site-renderer/theme';

/**
 * Owner find 3, gate G-T step 6: the parity run for the theme builder.
 *
 * OLD: Templates' `themeVarStyle` as it stood at d484a89 (server render), then
 * the `Providers` effect's string loop after load (every string field of
 * siteData as `--<key>`, then `--accent-readable`), both copied verbatim below.
 * NEW: the renderer's `themeTokenStyle`, which the layout server-renders and
 * the narrowed `Providers` stamps again (wiring pinned by themeStamp.test.ts).
 *
 * The expectation is the design's, exactly (owner-finds-2026-10-27.md, Find 3,
 * Pre-publish gate step 6):
 *  - server render identical on every site except (i) a Type pack mono with no
 *    kit `font-mono` gains `--font-mono` = resolveMonoFamily, and (ii) a key
 *    newly on the whitelist gains `--<key>` with EXACTLY the value the old loop
 *    stamped after load;
 *  - after load, every property something reads is identical (group (i)'s new
 *    `--font-mono` is the one stated delta, since applying the pack's face is
 *    the point of BLOCK 4);
 *  - a property that disappears must have no reader. The reader search is a
 *    literal `var(--<key>` (or a quoted `'--<key>'`) over Templates `src` and
 *    the installed renderer, comments stripped. Review-2 found no dynamic
 *    `var(--${...})` reader in either, which is what makes a literal search sound.
 *
 * Fleet data: `__fixtures__/fleetThemeSettings.json`, built by
 * `scripts/theme-parity-fixture.mjs` from the Client API responses the gate
 * G-R run fetched on 2026-10-27. Set THEME_PARITY_FIXTURE to run a fresh build.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const RENDERER = path.join(REPO, 'node_modules/@hillbombcreations/site-renderer');

type Site = Record<string, unknown>;
type Style = Record<string, string>;

/* ── OLD, verbatim from d484a89 ──────────────────────────────────────────────
 * src/lib/theme/themeVarStyle.ts, src/lib/theme/readableAccent.ts
 * (readableAccentOnWhite) and src/components/Providers/index.tsx:39-50. */

const LEGACY_THEME_TOKEN_KEYS = [
  'primary',
  'secondary',
  'hover',
  'surface',
  'surface-alt',
  'text-primary',
  'text-secondary',
  'text-inverse',
  'contact-button-radius',
  'contact-button-case',
  'contact-button-tracking',
  'font-mono',
] as const;

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
function srgbRelativeLuminance(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function colorLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbRelativeLuminance(r) + 0.7152 * srgbRelativeLuminance(g) + 0.0722 * srgbRelativeLuminance(b);
}
function wcagContrast(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function legacyReadableAccentOnWhite(accent: string | undefined): string | null {
  const rgb = accent ? parseHex(accent) : null;
  if (!rgb) return null;
  let [r, g, b] = rgb;
  for (let i = 0; i < 12; i += 1) {
    if (wcagContrast(1, colorLuminance(r, g, b)) >= 4.5) return toHex(r, g, b);
    r *= 0.85;
    g *= 0.85;
    b *= 0.85;
  }
  return '#111111';
}

function legacyThemeVarStyle(siteData: Site): Style {
  const style: Style = {};
  for (const key of LEGACY_THEME_TOKEN_KEYS) {
    const v = siteData[key];
    if (typeof v === 'string' && v.trim() !== '') style[`--${key}`] = v;
  }
  const readable = legacyReadableAccentOnWhite(style['--primary']);
  if (readable) style['--accent-readable'] = readable;
  if (!style['--text-secondary']) {
    const textPrimary = style['--text-primary'] ?? '#1c1c1c';
    const surface = style['--surface'] ?? '#ffffff';
    style['--text-secondary'] = `color-mix(in oklab, ${textPrimary} 55%, ${surface})`;
  }
  return style;
}

/** The setProperty calls the old Providers effect made, in order. */
function legacyProvidersStamps(siteData: Site): Array<[string, string]> {
  const stamps: Array<[string, string]> = [];
  if (siteData?.primary) {
    for (const [key, value] of Object.entries(siteData)) {
      if (typeof value === 'string') stamps.push([`--${key}`, value]);
    }
    const readable = legacyReadableAccentOnWhite(siteData.primary as string);
    if (readable) stamps.push(['--accent-readable', readable]);
  }
  return stamps;
}

/* ── NEW ──────────────────────────────────────────────────────────────────── */

function newServerRender(siteData: Site): Style {
  return (themeTokenStyle(siteData) ?? {}) as Style; // custom properties are plain string entries
}

/** The setProperty calls the narrowed Providers effect makes (themeStamp.test.ts pins the source). */
function newProvidersStamps(siteData: Site, build: (siteData: Site) => Style): Array<[string, string]> {
  if (!siteData?.primary) return [];
  return Object.entries(build(siteData)).map(([property, value]) => [property, String(value)]);
}

/** <html> after load: the server-rendered style, then each setProperty ('' removes, as CSSOM does). */
function afterLoad(server: Style, stamps: Array<[string, string]>): Style {
  const root: Style = { ...server };
  for (const [property, value] of stamps) {
    if (value === '') delete root[property];
    else root[property] = value;
  }
  return root;
}

/* ── the reader search ────────────────────────────────────────────────────── */

function listFiles(dir: string, keep: (file: string) => boolean, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__fixtures__') listFiles(full, keep, out);
    } else if (keep(full)) out.push(full);
  }
  return out;
}

/** Block comments and whole-line `//` comments out, so a docblock naming `--favicon` is not a reader. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function loadReaderCorpus(): { templates: string[]; renderer: string[] } {
  const templatesFiles = listFiles(path.join(REPO, 'src'), (f) => /\.(ts|tsx|css|js|mjs)$/.test(f) && !/\.test\.(ts|tsx|mjs)$/.test(f));
  const rendererFiles = [
    ...listFiles(path.join(RENDERER, 'dist'), (f) => f.endsWith('.js')),
    ...listFiles(path.join(RENDERER, 'styles'), (f) => f.endsWith('.css')),
  ];
  const read = (files: string[]) => files.map((f) => stripComments(fs.readFileSync(f, 'utf8')));
  return { templates: read(templatesFiles), renderer: read(rendererFiles) };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeHasReader(corpus: string[]): (property: string) => boolean {
  const cache = new Map<string, boolean>();
  return (property) => {
    const hit = cache.get(property);
    if (hit !== undefined) return hit;
    const name = escapeRegExp(property);
    const pattern = new RegExp(`var\\(\\s*${name}\\s*[,)]|['"\`]${name}['"\`]`);
    const found = corpus.some((source) => pattern.test(source));
    cache.set(property, found);
    return found;
  };
}

/* ── the check, one site ──────────────────────────────────────────────────── */

type SiteResult = {
  groupI: string[];
  groupII: Array<[string, string]>;
  dropped: string[];
  violations: string[];
};

const NEW_KEYS = THEME_TOKEN_KEYS.filter((key) => !(LEGACY_THEME_TOKEN_KEYS as readonly string[]).includes(key));

/** `build` is injectable only so the controls below can prove a wrong builder is caught. */
function checkSite(siteData: Site, hasReader: (property: string) => boolean, build: (siteData: Site) => Style = newServerRender): SiteResult {
  const result: SiteResult = { groupI: [], groupII: [], dropped: [], violations: [] };
  const oldServer = legacyThemeVarStyle(siteData);
  const newServer = build(siteData);
  const oldStamps = legacyProvidersStamps(siteData);
  const oldLoopValue = new Map(oldStamps);
  const kitMono = siteData['font-mono'];
  const isGroupI = (property: string) =>
    property === '--font-mono' &&
    !(typeof kitMono === 'string' && kitMono.trim() !== '') &&
    newServer[property] === resolveMonoFamily(siteData);

  for (const property of new Set([...Object.keys(oldServer), ...Object.keys(newServer)])) {
    const before = oldServer[property];
    const after = newServer[property];
    if (before === after) continue;
    if (before !== undefined) {
      result.violations.push(`server render: ${property} ${JSON.stringify(before)} became ${JSON.stringify(after)}`);
    } else if (isGroupI(property)) {
      result.groupI.push(after);
    } else if ((NEW_KEYS as readonly string[]).includes(property.slice(2))) {
      if (oldLoopValue.get(property) === after) result.groupII.push([property, after]);
      else result.violations.push(`server render: ${property} gained ${JSON.stringify(after)}, the old loop stamped ${JSON.stringify(oldLoopValue.get(property))}`);
    } else {
      result.violations.push(`server render: ${property} gained ${JSON.stringify(after)}, outside groups (i) and (ii)`);
    }
  }

  const oldRoot = afterLoad(oldServer, oldStamps);
  const newRoot = afterLoad(newServer, newProvidersStamps(siteData, build));
  for (const property of new Set([...Object.keys(oldRoot), ...Object.keys(newRoot)])) {
    const before = oldRoot[property];
    const after = newRoot[property];
    if (before === after) continue;
    if (after === undefined) {
      result.dropped.push(property);
      if (hasReader(property)) result.violations.push(`after load: ${property} dropped, and something reads it`);
    } else if (before === undefined && isGroupI(property)) {
      continue;
    } else if (hasReader(property)) {
      result.violations.push(`after load: ${property} ${JSON.stringify(before)} became ${JSON.stringify(after)}`);
    }
  }
  return result;
}

/* ── the fleet ────────────────────────────────────────────────────────────── */

type Fixture = { sites: Array<{ id: string; siteData: Site }>; notFetched: string[] };

function loadFixture(): { fixture: Fixture; source: string } {
  const source = process.env.THEME_PARITY_FIXTURE || path.join(HERE, '__fixtures__/fleetThemeSettings.json');
  return { fixture: JSON.parse(fs.readFileSync(source, 'utf8')) as Fixture, source }; // shape written by scripts/theme-parity-fixture.mjs
}

const corpus = loadReaderCorpus();
const hasReader = makeHasReader([...corpus.templates, ...corpus.renderer]);

test('the reader search reads both trees and finds readers it must find', () => {
  assert.ok(corpus.templates.length > 100, `only ${corpus.templates.length} Templates files read`);
  assert.ok(corpus.renderer.length > 100, `only ${corpus.renderer.length} renderer files read`);
  for (const property of ['--primary', '--surface-alt', '--border', '--accent-readable', '--font-mono', '--contact-button-radius']) {
    assert.ok(hasReader(property), `${property} has no reader; the search is blind`);
  }
});

test('every stored string key with a reader is on the builder whitelist', () => {
  const { fixture } = loadFixture();
  const missing = new Set<string>();
  for (const { siteData } of fixture.sites) {
    for (const [key, value] of Object.entries(siteData)) {
      if (typeof value === 'string' && hasReader(`--${key}`) && !(THEME_TOKEN_KEYS as readonly string[]).includes(key)) missing.add(key);
    }
  }
  assert.deepEqual([...missing], []);
});

test('G-T step 6: old writers against the renderer builder, over every fetched site', (t) => {
  const { fixture, source } = loadFixture();
  assert.ok(fixture.sites.length >= 26, `${source}: ${fixture.sites.length} sites; the G-R fetch had 26`);
  assert.ok(fixture.sites.every(({ siteData }) => typeof siteData.primary === 'string'), 'a site with no primary; the fixture did not parse as site settings');

  const violations: string[] = [];
  const groupI: string[] = [];
  const groupII: string[] = [];
  const dropped = new Map<string, number>();
  for (const { id, siteData } of fixture.sites) {
    const r = checkSite(siteData, hasReader);
    for (const v of r.violations) violations.push(`${id}: ${v}`);
    for (const mono of r.groupI) groupI.push(`${id}: --font-mono ${mono}`);
    for (const [property, value] of r.groupII) groupII.push(`${id}: ${property} ${value}`);
    for (const property of r.dropped) dropped.set(property, (dropped.get(property) ?? 0) + 1);
  }

  t.diagnostic(`fixture ${path.relative(REPO, source)}: ${fixture.sites.length} sites; no settings for ${fixture.notFetched.join(', ') || 'none'}`);
  t.diagnostic(`group (i), pack mono gains --font-mono: ${groupI.length}${groupI.length ? `: ${groupI.join('; ')}` : ''}`);
  t.diagnostic(`group (ii), newly whitelisted key gains its old after-load value: ${groupII.length}${groupII.length ? `: ${groupII.join('; ')}` : ''}`);
  t.diagnostic(`dropped after load, no reader: ${[...dropped].sort().map(([p, n]) => `${p} (${n})`).join(', ')}`);
  assert.deepEqual(violations, []);
});

/* ── the check is not blind ───────────────────────────────────────────────── */

test('control: a pack mono is group (i), not a violation', () => {
  const r = checkSite({ primary: '#1f3a5f', typography: { monoFamily: "'JetBrains Mono', ui-monospace, monospace" } }, hasReader);
  assert.deepEqual(r.groupI, ["'JetBrains Mono', ui-monospace, monospace"]);
  assert.deepEqual(r.violations, []);
});

test('control: a stored border is group (ii) with the loop value, and a dropped favicon has no reader', () => {
  const r = checkSite({ primary: '#1f3a5f', border: '#e4e4e7', favicon: 'data:x', chrome: 'dark' }, hasReader);
  assert.deepEqual(r.groupII, [['--border', '#e4e4e7']]);
  assert.ok(r.dropped.includes('--favicon') && r.dropped.includes('--chrome'), JSON.stringify(r.dropped));
  assert.deepEqual(r.violations, []);
});

test('REFUSE control: a border the old loop never stamped (no primary) is reported', () => {
  // The old loop ran only when a primary was stored, so it never stamped this
  // border: the server render gains a value the site never had, and so does <html>.
  const r = checkSite({ border: '#e4e4e7' }, hasReader);
  assert.deepEqual(r.violations, [
    'server render: --border gained "#e4e4e7", the old loop stamped undefined',
    'after load: --border undefined became "#e4e4e7"',
  ]);
});

test('REFUSE control: a dropped key that something reads is reported', () => {
  const readsProbe = (property: string) => property === '--x-probe' || hasReader(property);
  const r = checkSite({ primary: '#1f3a5f', 'x-probe': 'red' }, readsProbe);
  assert.deepEqual(r.violations, ['after load: --x-probe dropped, and something reads it']);
});

test('REFUSE control: a builder that changes a stored value is reported, on the server render and after load', () => {
  const wrong = (site: Site): Style => ({ ...newServerRender(site), '--surface-alt': '#000000' });
  const r = checkSite({ primary: '#1f3a5f', 'surface-alt': '#eeeff0' }, hasReader, wrong);
  assert.deepEqual(r.violations, [
    'server render: --surface-alt "#eeeff0" became "#000000"',
    'after load: --surface-alt "#eeeff0" became "#000000"',
  ]);
});

test('REFUSE control: a blank stored reader key, which the old loop used to clear after load, is reported', () => {
  // The old loop stamped '' and so REMOVED the derived --text-secondary after
  // load; the builder keeps it. Any fleet site storing a blank reader key would
  // surface here rather than pass silently.
  const r = checkSite({ primary: '#1f3a5f', 'text-secondary': '' }, hasReader);
  assert.equal(r.violations.length, 1, JSON.stringify(r));
  assert.match(r.violations[0], /^after load: --text-secondary undefined became "color-mix/);
});
