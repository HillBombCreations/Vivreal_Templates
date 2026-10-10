import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detailFieldMap, enterDetailItems } from './detailItems.ts';
import type { LinkPage } from './linkedItems.ts';

const binding = (collectionId: string, sectionConfig: Record<string, unknown> = {}) => ({ collectionId, sectionConfig });
const page = (...blocks: unknown[]): LinkPage => ({ slug: 'menu', format: 'collection-list', blocks } as LinkPage);
type Row = { id: string; title?: string; raw?: Record<string, unknown> };
const dish: Row = { id: 'd1', title: '', raw: { 'Dish Name': 'Shakshuka', Notes: 'Eggs in sauce' } };

test('ALLOW (F-C28): the page binding\'s field map titles the item on its own page', () => {
  const map = detailFieldMap(page({ type: { kind: 'layout' }, config: { bindings: [binding('c1', { fieldMap: { title: 'Dish Name', text: 'Notes' } })] } }), 'c1');
  const [item] = enterDetailItems([dish], map);
  assert.equal(item.title, 'Shakshuka');
  assert.equal((item as { description?: string }).description, 'Eggs in sauce');
  assert.equal(item.raw?.title, 'Shakshuka');
});

test('REFUSE (F-C28): no map returns the very same array (byte-identical pages)', () => {
  const items = [dish];
  assert.equal(detailFieldMap(page({ type: { kind: 'layout' }, config: { bindings: [binding('c1')] } }), 'c1'), undefined);
  assert.equal(enterDetailItems(items, undefined), items);
});

test('REFUSE (F-C28): a map on another collection\'s binding does not apply', () => {
  const p = page({ type: { kind: 'layout' }, config: { bindings: [binding('other', { fieldMap: { title: 'Dish Name' } })] } });
  assert.equal(detailFieldMap(p, 'c1'), undefined);
});

test('REFUSE (F-C28): a stored title is never overwritten by the map', () => {
  const [item] = enterDetailItems<Row>([{ id: 'd2', title: 'Kept', raw: { title: 'Kept', 'Dish Name': 'Other' } }], { title: 'Dish Name' });
  assert.equal(item.raw?.title, 'Kept');
});

test('ALLOW (F-C28): the page template\'s binding is preferred, as pageDetailCollectionId prefers it', () => {
  const p = page(
    { type: { kind: 'layout' }, config: { bindings: [binding('c1', { fieldMap: { title: 'Notes' } })] } },
    { type: { kind: 'page-template' }, config: { bindings: [binding('c1', { fieldMap: { title: 'Dish Name' } })] } },
  );
  assert.deepEqual(detailFieldMap(p, 'c1'), { title: 'Dish Name' });
});

test('ALLOW (F-C16R): a SYSTEM value only in _system is readable by name on entry', () => {
  const [item] = enterDetailItems<Row>([{ id: 'a', raw: { _system: { slug: 'a-slug' } } }], undefined);
  assert.equal(item.raw?.slug, 'a-slug');
});

test('REFUSE (F-C16R): a stored top-level SYSTEM value is not replaced by _system', () => {
  const [item] = enterDetailItems<Row>([{ id: 'a', raw: { slug: 'live', _system: { slug: 'new' } } }], undefined);
  assert.equal(item.raw?.slug, 'live');
});

// The callers are server-only (they cannot be loaded here), so they are pinned by source.
const source = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const before = (code: string, first: string, then: string, what: string) => {
  const a = code.indexOf(first);
  const b = code.indexOf(then, a);
  assert.ok(a > 0, `${what}: ${first} not found, this pin is vacuous`);
  assert.ok(b > a, `${what}: ${first} must come before ${then}`);
};

test('PIN: the detail pool, the menu arm and the page list enter items before scope or lookup', () => {
  before(source('./lookupItem.ts'), 'enterDetailItems(read.items, detailFieldMap(pageConfig, collectionId))', 'applyScope(unscopedItems', 'lookupDetailItem');
  const route = source('../../app/[slug]/[itemId]/page.tsx');
  before(route, 'enterDetailItems(read.items, detailFieldMap(pageConfig, itemsCollectionId))', 'resolveItem(items, itemId, menuItemKeyField)', 'menu items');
  before(route, 'enterDetailItems(read.items, detailFieldMap(pageConfig, cid))', 'resolveItem(items, itemId, menuItemKeyField)', 'menu siblings');
  before(source('../api/siteData/index.tsx'), 'enterDetailItems(stored, detailFieldMap(page, c.collectionId))', 'restrictToLinked(applyScope(all', 'page list');
});
