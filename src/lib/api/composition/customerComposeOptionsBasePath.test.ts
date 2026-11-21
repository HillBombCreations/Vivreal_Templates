// F570 PB-T1 (release C, T-T1), the base path arm. The base path is read when
// `src/lib/sitePath.ts` is imported, so it is set before the page context is
// imported (below), as `src/basePathWiring.test.ts` does; `node --test` runs
// each file in its own process. This file never names the Studio option, so
// the sweep in `customerComposeOptions.test.ts` skips only its own file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register as registerLoader } from 'node:module';

process.env.VIVREAL_SITE_BASE_PATH = '/help';

registerLoader(new URL('./testSupport/pageContextLoader.mjs', import.meta.url).href);

const { configureClientStub } = await import('./testSupport/clientStub.mjs');
const { buildPageContext } = await import('./buildPageContext.ts');

const PAGE = {
  name: 'About',
  slug: 'about',
  format: 'standard',
  collectionId: null,
  collections: [],
  integrations: [],
  enabled: true,
  blocks: [{ id: 'sh1', type: { kind: 'static', dispatchId: 'section-header' }, order: 0, enabled: true, config: { labels: { title: 'About us' } } }],
} as unknown as Parameters<typeof buildPageContext>[0]['page']; // the stored page shape the renderer reads

test('ALLOW: on a base path site the options are exactly mode, emitSectionAnchors and basePath', async () => {
  configureClientStub({ api: (requestPath: string) => assert.fail(`no read is expected, got ${requestPath}`) });
  const { input } = await buildPageContext({ siteData: { name: 'Help', pageConfigs: [PAGE], emptyPhotoBands: 'hide' } as never, page: PAGE, isHome: false }); // the fields this page reads
  assert.deepEqual(Object.keys(input.options ?? {}).sort(), ['basePath', 'emitSectionAnchors', 'mode']);
  assert.equal(input.options?.basePath, '/help');
  assert.equal(input.options?.mode, 'live');
});
