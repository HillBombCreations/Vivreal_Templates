import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkedItemScopes, restrictToLinked, type LinkPage } from './linkedItems.ts';
// The renderer's own functions, from its dist (the package `exports` map has
// no React-free subpath for them), so the mirror is checked against the real
// thing, not against a copy of it.
import { applyScope } from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/shapeContent.js';
import { resolveDetailRouteSlug } from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/detailRouteOwnership.js';

const C = 'articles';
const scope = (value: string) => ({ field: 'section', value: [value] });
const template = (sectionConfig: Record<string, unknown> = {}, collectionId = C) => ({
  type: { kind: 'page-template', dispatchId: 'collection' },
  config: { bindings: [{ collectionId, sectionConfig }] },
});
const layout = (sectionConfig: Record<string, unknown> = {}, collectionId = C, dispatchId = 'cards') => ({
  type: { kind: 'layout', dispatchId },
  config: { bindings: [{ collectionId, sectionConfig }] },
});
const list = (slug: string, ...blocks: unknown[]): LinkPage =>
  ({ slug, format: 'collection-list', blocks } as LinkPage);
const standard = (slug: string, ...blocks: unknown[]): LinkPage => ({ slug, format: 'standard', blocks } as LinkPage);

const items = [
  { id: 'a', raw: { section: 'connections' } },
  { id: 'b', raw: { section: 'getting-started' } },
  { id: 'c', raw: { section: 'troubleshooting' } },
];
// Cast: the renderer's `applyScope` is typed over its own ContentItem; it reads only `raw`.
const scopeFn = applyScope as unknown as (xs: typeof items, s: unknown) => typeof items;

test('REFUSE: a list that opts out links nothing, and nothing survives the narrowing', () => {
  const p = list('getting-started', template({ detailEligible: false, scope: scope('getting-started') }));
  const scopes = linkedItemScopes(p, [p], C);
  assert.deepEqual(scopes, []);
  assert.deepEqual(restrictToLinked(items, scopes, scopeFn), []);
});

test('REFUSE: a scoped section keeps only its scope (the real applyScope)', () => {
  const p = list('connections', template({ scope: scope('connections') }));
  assert.deepEqual(restrictToLinked(items, linkedItemScopes(p, [p], C), scopeFn).map((i) => i.id), ['a']);
});

test('ALLOW: an eligible unscoped list links every item (null, unchanged)', () => {
  const p = list('blog', template());
  assert.equal(linkedItemScopes(p, [p], C), null);
  assert.equal(restrictToLinked(items, null, scopeFn), items);
});

test('ALLOW: two scoped links into one page are unioned, in item order', () => {
  const p = list('help', template({ scope: scope('troubleshooting') }));
  const home = standard('home', layout({ scope: scope('connections') }));
  assert.deepEqual(restrictToLinked(items, linkedItemScopes(p, [home, p], C), scopeFn).map((i) => i.id), ['a', 'c']);
});

test('ALLOW: a page with no block drawing the collection (itemCollectionId opt-in) is left unrestricted', () => {
  const p = { slug: 'locations', format: 'location-hub', detailPage: { itemCollectionId: C }, blocks: [] } as LinkPage;
  assert.equal(linkedItemScopes(p, [p], C), null);
});

test('ALLOW: a nested group child counts as a link', () => {
  const p = list('help', template({ detailEligible: false }), { type: { kind: 'layout', dispatchId: 'group' }, config: { children: [layout()] } });
  assert.equal(linkedItemScopes(p, [p], C), null);
});

test('REFUSE: a page template on a non-owning page links to that page, not into the owner', () => {
  const owner = list('help', template({ detailEligible: false }));
  const other = standard('other', template());
  assert.deepEqual(linkedItemScopes(owner, [other, owner], C), []);
});

// Parity: a widget on a non-owning page links into exactly the page the
// renderer's `resolveDetailRouteSlug` names. Each case gives the owner an
// opted-out list, so its only link is the widget's.
test('PARITY: inbound links reach the page resolveDetailRouteSlug resolves, and no other', () => {
  const optedOut = { detailEligible: false };
  const sites: { name: string; pages: LinkPage[] }[] = [
    { name: 'two owners, first wins', pages: [list('first', template(optedOut)), list('second', template(optedOut))] },
    { name: 'switched-off owner skipped', pages: [{ ...list('off', template(optedOut)), detailPage: { enabled: false } } as LinkPage, list('on', template(optedOut))] },
    { name: 'owner of another collection skipped', pages: [list('other', template(optedOut, 'zzz')), list('real', template(optedOut))] },
    {
      name: 'menu page that serves it first',
      pages: [{ slug: 'menu', format: 'menu', blocks: [layout({ menuRole: 'items' })] } as LinkPage, list('real', template(optedOut))],
    },
    { name: 'shows page', pages: [{ slug: 'events', format: 'shows', blocks: [template(optedOut)] } as LinkPage, list('real', template(optedOut))] },
    { name: 'whats-on standard page', pages: [standard('whats-on', layout(optedOut, C, 'whats-on')), list('real', template(optedOut))] },
  ];
  for (const { name, pages } of sites) {
    for (const linker of [standard('home', layout()), standard('about', layout())]) {
      const all = [linker, ...pages];
      // The renderer's `pages` excludes home (buildPageContext reads `pageConfigs`).
      const rendererPages = all.filter((p) => p.slug !== 'home');
      const resolved = resolveDetailRouteSlug(linker as never, rendererPages as never, C);
      for (const p of pages) {
        // A page that does not draw C is asked about its own collection, never C.
        if (!JSON.stringify(p.blocks).includes(`"collectionId":"${C}"`)) continue;
        const receives = linkedItemScopes(p, all, C) === null;
        assert.equal(receives, p.slug === resolved, `${name}: ${linker.slug} -> ${p.slug} (renderer: ${resolved})`);
      }
    }
  }
});

test('PARITY: a widget on a page that owns a route links to its own page, never into another owner', () => {
  const owner = list('help', template({ detailEligible: false }));
  const ownsOther = { slug: 'shop', format: 'catalog', blocks: [template({}, 'products'), layout()] } as LinkPage;
  assert.equal(resolveDetailRouteSlug(ownsOther as never, [ownsOther, owner] as never, C), 'shop');
  assert.deepEqual(linkedItemScopes(owner, [ownsOther, owner], C), []);
});

// F-C16R: a scope on a SYSTEM key (`section`) matches a value kept only in `_system`.
test('ALLOW (F-C16R): a scoped link reaches an item whose section lives only in _system', () => {
  const p = list('connections', template({ scope: scope('connections') }));
  const pool = [{ id: 'n1', raw: { _system: { section: 'connections' } } }];
  assert.deepEqual(restrictToLinked(pool, linkedItemScopes(p, [p], C), scopeFn as never).map((i) => i.id), ['n1']);
});

test('REFUSE (F-C16R): a stored top-level section beats _system in the scope', () => {
  const p = list('connections', template({ scope: scope('connections') }));
  const pool = [{ id: 'n1', raw: { section: 'troubleshooting', _system: { section: 'connections' } } }];
  assert.deepEqual(restrictToLinked(pool, linkedItemScopes(p, [p], C), scopeFn as never), []);
});
