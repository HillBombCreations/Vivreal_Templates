import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContentItem, PageConfig as RendererPageConfig, SiteData as RendererSiteData } from '@hillbombcreations/site-renderer';
import { toContentItem } from '../api/collections/mapItem.ts';
import { composePage } from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/composePage.js';

/**
 * Next release 2026-12, owner decision 2026-11-02 ("ship without it, redo
 * properly"): this release marks up NO listing-page Events. Agenda, What's On,
 * Calendar, Event wall and schedule pages emit no Event JSON-LD and no Event
 * link to an `#item-` row. The listing code was removed, not switched off;
 * the redo, on one helper the renderer will export, is backlog F33.
 *
 * Two halves, because the routes are .tsx server components the plain-Node
 * runner cannot load:
 *   - SOURCE: no file under `src` builds a listing Event, and the one Event
 *     builder call left is the show detail arm's (`[slug]/[itemId]/page.tsx`);
 *     the three listing render paths emit no JSON-LD at all.
 *   - RENDER: the renderer's own body for an Agenda, a schedule and a What's
 *     On page carries no JSON-LD and no `#item-` link (its row ids are
 *     anchors, never links), with a positive control that the rows drew.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('REFUSE (source): no listing Event is built anywhere, and the listing render paths emit no JSON-LD', () => {
  const files = sourceFiles(SRC);
  assert.ok(files.length > 200, `positive control: read ${files.length} source files`);
  const offenders = files.filter((f) => /listingEvents|pageListingEvents|eventFields/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map((f) => path.relative(SRC, f)), []);
  const builderCalls = files.flatMap((f) => (fs.readFileSync(f, 'utf8').match(/(?<!function )buildShowEventJsonLd\(/g) ?? []).map(() => path.relative(SRC, f)));
  assert.deepEqual(builderCalls, [path.join('app', '[slug]', '[itemId]', 'page.tsx')], 'the show detail arm is the one caller');
  for (const route of [path.join('app', 'page.tsx'), path.join('app', '[slug]', 'page.tsx'), path.join('lib', 'renderComposedPage.tsx')]) {
    const source = fs.readFileSync(path.join(SRC, route), 'utf8');
    assert.ok(source.length > 500, `${route} was read`);
    assert.doesNotMatch(source, /JsonLd|ld\+json/, `${route} emits no JSON-LD`);
  }
});

const YEAR = new Date().getFullYear() + 3;
let seq = 0;
const row = (objectValue: Record<string, unknown>) =>
  toContentItem({ _id: `6a${String(++seq).padStart(22, '0')}`, objectValue }, 'collection') as ContentItem;
const items = new Map<string, ContentItem[]>([
  ['markets', [
    row({ title: 'Farmers Market', date: `${YEAR}-03-07T15:00:00.000Z`, venue: 'Roosevelt Row', address: '305 E Roosevelt St' }),
    row({ title: 'Night Market', date: `${YEAR}-03-14T01:00:00.000Z`, venue: 'Heritage Square: 115 N 6th St' }),
  ]],
  ['stops', [
    row({ title: 'Downtown market', location_name: 'Downtown Phoenix Farmers Market', address: '721 N Central Ave', start: `${YEAR}-03-08T15:00:00.000Z` }),
  ]],
]);
const siteData = { pages: {}, pageConfigs: [], primary: '#365b99', timezone: 'America/Phoenix' } as unknown as RendererSiteData; // composition reads only these keys here
const layoutBlock = (displayAs: string) => ({
  id: `blk_${displayAs}`, order: 0, enabled: true,
  type: { kind: 'layout', dispatchId: displayAs },
  config: { bindings: [{ collectionId: 'markets', displayAs }] },
});
const scheduleBlock = { id: 'blk_schedule', order: 0, enabled: true, type: { kind: 'page-template', dispatchId: 'schedule' }, config: { bindings: [{ collectionId: 'stops' }] } };

function render(page: Record<string, unknown>): string {
  const config = { labels: {}, collectionId: null, name: 'Markets', slug: 'markets', ...page } as unknown as RendererPageConfig; // page fixtures carry only the keys composition reads
  const node = composePage({
    page: config,
    pages: [config],
    data: { siteData, getItems: (id: string) => items.get(id) ?? [], getIntegrationItems: () => [] },
    options: { mode: 'live' },
    isHome: false,
  } as Parameters<typeof composePage>[0]);
  return renderToStaticMarkup(createElement('div', null, node));
}

for (const [name, page] of [
  ['Agenda', { format: 'standard', blocks: [layoutBlock('agenda')] }],
  ['schedule', { format: 'schedule', blocks: [scheduleBlock] }],
  ["What's On", { format: 'standard', blocks: [layoutBlock('whats-on')] }],
] as const) {
  test(`REFUSE (render, ${name} page): no Event JSON-LD and no #item- link`, () => {
    const html = render(page);
    assert.match(html, /\sid="item-6a\d{22}"/, 'positive control: the rows drew, with their anchors');
    assert.doesNotMatch(html, /application\/ld\+json|"@type":"Event"/);
    assert.doesNotMatch(html, /href="[^"]*#item-/);
  });
}
