/**
 * Renderer #140 review N1 (renderer 1.98.5): on a page with a colour treatment
 * or a chosen page background, the title band sits inside the treated area.
 *
 * `composePage` puts the treatment on its page wrapper, and since 1.98.5 a
 * treatment that rebases the page surface paints it there. The Studio draws the
 * band inside that wrapper (`options.titleBand`). This app mounts the band in
 * its streaming shell, outside the wrapper (`renderComposedPage.tsx`), so a
 * Tinted page showed its title on the plain site colour, and "Flipped colors"
 * drew a light strip above a dark page. The shell now wraps the band and the
 * body in one element carrying `pageTreatmentStyle`, a hand copy of the
 * wrapper's style.
 *
 * Everything below runs the REAL installed renderer (by path: the package
 * entry imports `next/link`, which plain Node cannot load): its `composePage`,
 * its `TitleBand`, its `resolvePagePalette`, no stubs. The shell's JSX itself
 * is a `server-only` .tsx file plain Node cannot load; its shape is pinned from
 * source in `titleBandAdoption.test.ts`, and `shell()` below builds the same
 * tree from the same parts.
 *
 * The three treatments are the Studio's stored values, the ones the renderer's
 * own `pagePaletteSurface.test.tsx` uses (portal `PAGE_PALETTE_PRESETS`, ids
 * `accent-washed`, `quiet`, `inverted`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SiteColourTokens } from './pageTreatment.ts';
import * as composition from '../../node_modules/@hillbombcreations/site-renderer/dist/composition/composePage.js';
import { TitleBand } from '../../node_modules/@hillbombcreations/site-renderer/dist/composition/titleBand.js';
import { resolvePagePalette } from '../../node_modules/@hillbombcreations/site-renderer/dist/lib/resolvePagePalette.js';
import { SiteRendererProvider } from '../../node_modules/@hillbombcreations/site-renderer/dist/context/SiteRendererContext.js';

/*
 * The module under test is imported so that this file still loads on a tree
 * without it, and the shell then behaves as it did before the fix: the band
 * gets no treatment (`() => undefined`). That is what lets the REFUSE below
 * fail on its own assertion against the unfixed shell (the red proof), rather
 * than on a missing import. The first test fails loudly if the module does not
 * load, so a broken import can never pass as "the unfixed shell".
 */
const mod = await import('./pageTreatment.ts').catch(() => null);
type Treatment = typeof import('./pageTreatment.ts').pageTreatmentStyle;
const pageTreatmentStyle: Treatment = mod?.pageTreatmentStyle ?? (() => undefined);

test('pageTreatment loads', () => {
  assert.ok(mod, 'src/lib/pageTreatment.ts did not load; every row below would be testing the unfixed shell');
});

type RendererPage = Parameters<typeof composition.composePage>[0]['page'];
type Palette = NonNullable<RendererPage['palette']>;

const SITE = {
  name: 'Fixture Bakery',
  pages: {},
  pageConfigs: [],
  primary: '#b02248',
  secondary: '#3a5a40',
  hover: '#8e1b3a',
  surface: '#fffcf5',
  'surface-alt': '#f3eee4',
  'text-primary': '#1f1a17',
  'text-secondary': '#5c534d',
  'text-inverse': '#ffffff',
} satisfies SiteColourTokens & Record<string, unknown>;

const TINTED: Palette = {
  surface: 'color-mix(in oklab, var(--primary) 8%, var(--surface))',
  'surface-alt': 'color-mix(in oklab, var(--primary) 14%, var(--surface))',
};
const SOFTER: Palette = { surface: 'var(--surface-alt)', 'surface-alt': 'var(--surface)' };
const FLIPPED: Palette = {
  surface: 'var(--text-primary)',
  'surface-alt': 'var(--text-primary)',
  'text-primary': 'var(--text-inverse)',
  'text-secondary': 'var(--text-inverse)',
  'text-inverse': 'var(--text-primary)',
};

/** A titled standard page with one Policy text section, which paints no background of its own. */
function bandPage(extra: Record<string, unknown> = {}): RendererPage {
  return {
    name: 'Our story',
    slug: 'our-story',
    format: 'standard',
    collectionId: null,
    labels: { title: 'Our story', subtitle: 'Since 1998' },
    blocks: [{ id: 'policy', type: { kind: 'static', dispatchId: 'static' }, order: 0, enabled: true, config: {} }],
    ...extra,
  } as unknown as RendererPage; // a Blank page holding one section, built inline in the stored shape
}

function compose(page: RendererPage, options: Record<string, unknown>): ReactNode {
  return composition.composePage({
    page,
    pages: [page],
    data: { siteData: SITE, getItems: () => [], getIntegrationItems: () => [] },
    options,
    isHome: false,
  } as unknown as Parameters<typeof composition.composePage>[0]); // the fixture site carries only the colour tokens
}

const html = (node: ReactNode) => renderToStaticMarkup(createElement(SiteRendererProvider, null, node));

/** What the Studio draws: the band inside composePage's wrapper. */
const studio = (page: RendererPage) => html(compose(page, { mode: 'preview', titleBand: true }));

/** The body this app streams in: composePage live, its sr-only title suppressed because the shell owns the band. */
const liveBody = (page: RendererPage) => compose(page, { mode: 'live', suppressSrTitle: true });

/** This app's shell around the band and the body, as `renderComposedPage` builds it. */
function shell(page: RendererPage): string {
  const style = pageTreatmentStyle(page, SITE, resolvePagePalette);
  const band = TitleBand({ page });
  const body = liveBody(page);
  return html(style ? createElement('div', { style }, band, body) : createElement(Fragment, null, band, body));
}

/** The style attribute of the first tag, or null when it carries none. */
function firstTagStyle(markup: string): string | null {
  const tag = /^<div[^>]*>/.exec(markup);
  assert.ok(tag, `expected a div first: ${markup.slice(0, 120)}`);
  return /\sstyle="([^"]*)"/.exec(tag[0])?.[1] ?? null;
}

/** The style attribute `pageTreatmentStyle` produces, rendered by React exactly as the shell renders it. */
function treatmentAttr(page: RendererPage): string | null {
  const style = pageTreatmentStyle(page, SITE, resolvePagePalette);
  return style ? firstTagStyle(renderToStaticMarkup(createElement('div', { style }))) : null;
}

/** Every treatment and background combination the Studio can store, plus the shapes a round trip leaves. */
const MATRIX: Array<[string, Record<string, unknown>]> = [
  ['no treatment', {}],
  ['"Same as your site" after a round trip (empty palette)', { palette: {} }],
  ['unreadable palette values', { palette: { surface: 'not-a-colour', primary: 'url(x)' } }],
  ['Tinted', { palette: TINTED }],
  ['Softer', { palette: SOFTER }],
  ['Flipped colors', { palette: FLIPPED }],
  ['main colour only', { palette: { primary: '#2255aa' } }],
  ['a kit literal palette', { palette: { surface: '#f7dede', 'surface-alt': '#f2cccc', 'text-primary': '#26268f' } }],
  ['background surface', { background: 'surface' }],
  ['background surface-alt', { background: 'surface-alt' }],
  ['background primary', { background: 'primary' }],
  ['background secondary', { background: 'secondary' }],
  ['an unknown background', { background: 'dark' }],
  ['Tinted on surface-alt', { palette: TINTED, background: 'surface-alt' }],
  ['Flipped colors on primary', { palette: FLIPPED, background: 'primary' }],
  ['a kit literal palette on surface', { palette: { surface: '#f7dede', 'text-primary': '#26268f' }, background: 'surface' }],
];

test('[N1 PARITY] the shell style is exactly the wrapper style composePage renders, for every treatment and background', () => {
  let styled = 0;
  let unstyled = 0;
  for (const [name, extra] of MATRIX) {
    const page = bandPage(extra);
    const rendered = firstTagStyle(studio(page));
    assert.equal(treatmentAttr(page), rendered, `${name}: the shell's treatment differs from composePage's wrapper`);
    if (rendered === null) unstyled += 1;
    else styled += 1;
  }
  // Both arms are exercised, so the equality above cannot pass on all-absent.
  assert.equal(unstyled, 4, 'expected four untreated rows (none, empty, unreadable, unknown background)');
  assert.equal(styled, MATRIX.length - 4);
});

test('[N1 PARITY] the restated background resolvers equal the renderer\'s own', () => {
  assert.ok(mod, 'src/lib/pageTreatment.ts did not load');
  const { pageBackground, pageBackgroundTextRescope } = mod;
  const tokens = [undefined, '', 'surface', 'surface-alt', 'primary', 'secondary', 'Primary', ' primary', 'dark'];
  let rescoped = 0;
  for (const token of tokens) {
    assert.deepEqual(pageBackground(token), composition.resolvePageBackground(token), `background ${JSON.stringify(token)}`);
    assert.deepEqual(
      pageBackgroundTextRescope(token),
      composition.resolvePageBackgroundTextRescope(token),
      `text rescope ${JSON.stringify(token)}`,
    );
    if (pageBackgroundTextRescope(token)) rescoped += 1;
  }
  assert.equal(rescoped, 2, 'control: primary and secondary rescope the text');
});

test('[N1 REFUSE] a treated page never leaves its title band outside the treated area', () => {
  for (const [name, palette] of [['Tinted', TINTED], ['Softer', SOFTER], ['Flipped colors', FLIPPED]] as const) {
    const page = bandPage({ palette });
    const studioHtml = studio(page);
    const shellHtml = shell(page);
    const painted = firstTagStyle(studioHtml);
    assert.ok(painted?.includes('background-color:var(--surface)'), `${name}: control, the renderer paints the treated page`);
    assert.ok(studioHtml.indexOf('Our story</h1>') > 0, `${name}: control, the Studio draws the band inside its wrapper`);

    // The shell opens with one element painted exactly as the Studio's page...
    assert.equal(firstTagStyle(shellHtml), painted, `${name}: the band is not on the treated surface`);
    // ...and it holds the band and the whole body: it closes last.
    const band = shellHtml.indexOf('Our story</h1>');
    const bodyWrapper = shellHtml.indexOf('<div class="pb-16 md:pb-24"');
    assert.ok(band > 0 && bodyWrapper > band, `${name}: the band and the body are not both inside the treated element`);
    assert.ok(shellHtml.endsWith('</div></div>'), `${name}: the treated element does not close after the body`);
    // The body behind the band and the body below it are the same treatment.
    assert.equal(firstTagStyle(shellHtml.slice(bodyWrapper)), painted, `${name}: the band and the body read different surfaces`);
  }
});

test('[N1 ALLOW] an untreated band page keeps its bytes: no element added', () => {
  const page = bandPage();
  assert.equal(pageTreatmentStyle(page, SITE, resolvePagePalette), undefined);
  const before = renderToStaticMarkup(TitleBand({ page })) + html(liveBody(page));
  assert.ok(before.startsWith('<div class="content-grid pt-28 pb-0">'), 'control: the band renders first');
  assert.equal(shell(page), before);
  // A round-trip empty palette and a palette with nothing readable are untreated too.
  assert.equal(pageTreatmentStyle(bandPage({ palette: {} }), SITE, resolvePagePalette), undefined);
  assert.equal(pageTreatmentStyle(bandPage({ palette: { surface: 'not-a-colour' } }), SITE, resolvePagePalette), undefined);
});

test('[N1 ALLOW] a chosen page background puts the band on that background, as the Studio does', () => {
  const page = bandPage({ background: 'primary' });
  const style = treatmentAttr(page);
  assert.ok(style?.includes('background-color:var(--primary)'), `the band is not on the chosen background: ${style}`);
  assert.ok(style?.includes('--text-primary:var(--text-inverse, #ffffff)'), 'the band title does not read the inverse ink on an accent page');
  assert.equal(firstTagStyle(shell(page)), firstTagStyle(studio(page)));
});

test('[N1 ALLOW] a treatment that keeps the page surface rebases the band\'s colours and paints nothing new', () => {
  const style = treatmentAttr(bandPage({ palette: { primary: '#2255aa' } }));
  assert.ok(style?.includes('--primary:#2255aa'), `control: the main colour override is applied: ${style}`);
  assert.ok(!/(^|;)(background-color|color):/.test(style ?? ''), `painted a surface the treatment never set: ${style}`);
});
