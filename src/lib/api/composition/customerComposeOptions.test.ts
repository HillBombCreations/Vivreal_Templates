import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register as registerLoader } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as composition from '../../../../node_modules/@hillbombcreations/site-renderer/dist/composition/composePage.js';
import { SiteRendererProvider } from '../../../../node_modules/@hillbombcreations/site-renderer/dist/context/SiteRendererContext.js';

/**
 * F570 PB-T1 (release C, test T-T1; vivreal-hq
 * docs/projects/next-release-C/design-empty-photo-band.md 6, SW-PB5): a
 * customer site never passes the renderer's `photoBandPrompt` option, so a
 * photo band with no photos on a site stamped `emptyPhotoBands: 'hide'` is
 * DROPPED there, never kept with the Studio prompt.
 *
 * Through the REAL `buildPageContext` (the `pageContextLoader.mjs` harness:
 * only the Client API read, `server-only` and the renderer entry are stood in
 * for) and the installed site engine's real `composePage` (1.102.0). The
 * `basePath` arm is `customerComposeOptionsBasePath.test.ts`, because the base
 * path is read at import.
 *
 * Kept mutations (the PR names both, each red alone):
 *  1. `photoBandPrompt: {}` added to the options literal in `buildPageContext.ts`
 *     turns the key set, the render REFUSE and the sweep red here, and the
 *     basePath file's key set, and `pageEmptinessDraws.test.ts`'s literal pin.
 *  2. `photoBandPrompt: {}` added to the options spread in `src/app/[slug]/page.tsx`
 *     turns the sweep red.
 */

registerLoader(new URL('./testSupport/pageContextLoader.mjs', import.meta.url).href);

const { configureClientStub } = await import('./testSupport/clientStub.mjs');
const { buildPageContext } = await import('./buildPageContext.ts');

const THIS_FILE = fileURLToPath(import.meta.url);
const SRC = path.resolve(path.dirname(THIS_FILE), '../../..');
const ROOT = path.dirname(SRC);

const CASES = '6a0000000000000000000c71';
const BAND_TITLE = 'Our before and after results';
const TEXT_TITLE = 'What we do';
/** WS-274's first sentence, as the renderer draws it in the Studio prompt. */
const PROMPT_WORDS = 'Hidden on your site until it has photos.';

/** A case-cards band bound to a list whose rows have no photos, and a text section. */
const PAGE = {
  name: 'Results',
  slug: 'results',
  format: 'standard',
  collectionId: null,
  collections: [],
  integrations: [],
  enabled: true,
  blocks: [
    { id: 'sh1', type: { kind: 'static', dispatchId: 'section-header' }, order: 0, enabled: true, config: { labels: { title: TEXT_TITLE, subtitle: 'Three things' } } },
    {
      id: 'cc1',
      type: { kind: 'layout', dispatchId: 'case-cards' },
      order: 1,
      enabled: true,
      config: { bindings: [{ collectionId: CASES, displayAs: 'case-cards', role: 'primary', title: BAND_TITLE }] },
    },
  ],
} as unknown as Parameters<typeof buildPageContext>[0]['page']; // the stored page shape the renderer reads

/** A fake Client API: the case list holds two rows, neither with a photo. */
function clientApi(requestPath: string) {
  const [route, query] = requestPath.split('?');
  assert.equal(route, '/tenant/collectionObjects', `only collection reads are expected, got ${requestPath}`);
  const id = new URLSearchParams(query).get('collectionId');
  const items = id === CASES
    ? [
        { _id: '6a0000000000000000000d71', objectValue: { title: 'Kitchen refresh', description: 'Cabinets and counters.' } },
        { _id: '6a0000000000000000000d72', objectValue: { title: 'Bath remodel', description: 'Tile and fixtures.' } },
      ]
    : [];
  return { items, totalCount: items.length, richTextImageUrls: {} };
}

async function contextFor(stamp: string | undefined) {
  configureClientStub({ api: clientApi });
  const siteData = { name: 'Fixture Builders', pageConfigs: [PAGE], socialLinks: [], ...(stamp === undefined ? {} : { emptyPhotoBands: stamp }) };
  return buildPageContext({ siteData: siteData as never, page: PAGE, isHome: false }); // the fields this page reads
}

const rendered = (input: unknown): string =>
  renderToStaticMarkup(createElement(SiteRendererProvider, { children: composition.composePage(input as never) } as never)); // JS leaf imports: their prop types are not resolved by path.

test('ALLOW: the options a customer page composes with are exactly mode and emitSectionAnchors (no base path)', async () => {
  const { input } = await contextFor('hide');
  assert.deepEqual(Object.keys(input.options ?? {}).sort(), ['emitSectionAnchors', 'mode']);
  assert.equal(input.options?.mode, 'live');
});

test('REFUSE: on a stamped site the photo-less band is dropped, never kept with the Studio prompt', async () => {
  const { input } = await contextFor('hide');
  const html = rendered(input);
  assert.ok(html.includes(TEXT_TITLE), 'the page still draws its text section');
  assert.ok(!html.includes('data-section-id="cc1"'), 'the empty photo band section is gone');
  assert.ok(!html.includes(BAND_TITLE), 'and its heading');
  assert.equal((html.match(/data-photo-band-prompt/g) ?? []).length, 0, 'no Studio prompt on a customer page');
  assert.ok(!html.includes(PROMPT_WORDS), 'never the prompt words');
});

test('ALLOW (control): the same page on an unstamped site draws the band heading, as today', async () => {
  const { input } = await contextFor(undefined);
  const html = rendered(input);
  assert.ok(html.includes('data-section-id="cc1"'), 'an existing site keeps the band section, as before');
  assert.ok(html.includes(BAND_TITLE), 'and its heading');
  assert.ok(html.includes(TEXT_TITLE));
  assert.equal((html.match(/data-photo-band-prompt/g) ?? []).length, 0);
});

/** Every file under src, by a recursive read, skipping exactly this file. */
function sourceTexts(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (full !== THIS_FILE) out.set(path.relative(ROOT, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8'));
    }
  };
  walk(SRC);
  return out;
}

test('REFUSE (sweep): no file under src passes the Studio prompt option to a customer page', () => {
  const texts = sourceTexts();
  // It read the three files only it guards: the two option spreads and the literal.
  assert.ok((texts.get('src/app/[slug]/page.tsx') ?? '').includes('suppressSrTitle'), 'read the [slug] options spread');
  assert.ok((texts.get('src/lib/renderComposedPage.tsx') ?? '').includes('suppressSrTitle'), 'read the renderComposedPage options spread');
  assert.ok((texts.get('src/lib/api/composition/buildPageContext.ts') ?? '').includes("options: { mode: 'live'"), 'read the options literal');
  const holders = [...texts].filter(([, text]) => text.includes('photoBandPrompt')).map(([file]) => file);
  assert.deepEqual(holders, []);
});
