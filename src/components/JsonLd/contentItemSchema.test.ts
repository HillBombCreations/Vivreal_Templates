import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SiteData } from '@/types/SiteData';
// Namespace import: `siteOrganizationId` is new, and a named import of it would
// stop this file loading at all on a tree without it, hiding the assertions.
import * as schemaModule from './schema.ts';
import type { DetailJsonLdInput } from './schema.ts';

const { buildDetailJsonLd, buildSiteJsonLd } = schemaModule;

// Discovery batch 3.2 (BlogPosting/Article, never Thing) and the site node's
// `@id` (3.1/3.6). Design section 6 row "Article"; every ALLOW has its REFUSE.

const ORG = 'https://vivreal.io/#organization';
const URL_ = 'https://vivreal.io/blog/create-once';

function item(overrides: Partial<DetailJsonLdInput> = {}): Record<string, unknown> | null {
  return buildDetailJsonLd({
    format: 'products',
    title: 'Create once, publish everywhere',
    url: URL_,
    bodyText: '<p>One post, every channel.</p>',
    datePublished: '2026-10-01T14:00:00.000Z',
    dateModified: '2026-10-05T09:30:00.000Z',
    organizationId: ORG,
    organizationName: 'Vivreal',
    ...overrides,
  });
}

test('ALLOW: a priceless item with body text and a publish date is a BlogPosting with headline, author and both dates', () => {
  const schema = item();
  assert.ok(schema);
  assert.equal(schema['@type'], 'BlogPosting');
  assert.equal(schema.headline, 'Create once, publish everywhere');
  assert.equal(schema.datePublished, '2026-10-01T14:00:00.000Z');
  assert.equal(schema.dateModified, '2026-10-05T09:30:00.000Z');
  assert.deepEqual(schema.author, { '@id': ORG }, 'no author field: the business, by reference');
  assert.deepEqual(schema.publisher, { '@id': ORG });
  assert.equal(schema.mainEntityOfPage, URL_);
  assert.equal(schema.offers, undefined);
});

test('ALLOW: an author field on the item is a Person', () => {
  assert.deepEqual(item({ itemAuthor: '  Jo Baker ' })?.author, { '@type': 'Person', name: 'Jo Baker' });
});

test('ALLOW: body text with no publish date is an Article', () => {
  const schema = item({ datePublished: undefined });
  assert.equal(schema?.['@type'], 'Article');
  assert.equal(schema?.datePublished, undefined);
});

test('ALLOW: the headline is cut to 110 characters', () => {
  const long = 'A'.repeat(150);
  assert.equal((item({ title: long })?.headline as string).length, 110);
});

test('ALLOW: with no site origin the author is the business by name and there is no publisher reference', () => {
  const schema = item({ organizationId: undefined });
  assert.deepEqual(schema?.author, { '@type': 'Organization', name: 'Vivreal' });
  assert.equal(schema?.publisher, undefined);
});

test('REFUSE: no price and no body text gives NO item node', () => {
  assert.equal(item({ bodyText: undefined }), null);
  assert.equal(item({ bodyText: '<p></p>' }), null, 'a cleared editor is not body text');
  assert.equal(item({ bodyText: '<p>&nbsp;</p>' }), null);
});

test('REFUSE: a real price still wins and stays a Product', () => {
  assert.equal(item({ price: '9.00' })?.['@type'], 'Product');
});

test('REFUSE: no input shape emits "Thing" (sweep over the priceless branch and both item formats)', () => {
  let emitted = 0;
  for (const format of ['products', 'collection-list']) {
    for (const price of [undefined, 'From $12', '', 'Market price']) {
      for (const bodyText of [undefined, '', '<p></p>', 'Plain words', '<p>Body</p>']) {
        for (const datePublished of [undefined, '2026-10-01', 'Autumn 2026']) {
          const schema = buildDetailJsonLd({ format, title: 'X', price, bodyText, datePublished });
          assert.ok(!JSON.stringify(schema).includes('"Thing"'), JSON.stringify({ format, price, bodyText, datePublished }));
          if (schema) emitted += 1;
        }
      }
    }
  }
  assert.ok(emitted > 0, 'sanity: the sweep produced real nodes, not only nulls');
});

// ---------------------------------------------------------------------------
// The site node's @id
// ---------------------------------------------------------------------------

const LIVE = {
  lifecycleState: 'live',
  name: 'Vivreal',
  domainInformation: { live_url: 'https://vivreal.io' },
} as SiteData;

test('ALLOW: a live site node carries @id <origin>/#organization, the id every page refers to', () => {
  const [org] = buildSiteJsonLd(LIVE);
  assert.equal(org['@id'], ORG);
  assert.equal(schemaModule.siteOrganizationId(LIVE), ORG);
});

test('REFUSE: a demo (or a site with no origin) carries no @id and offers no reference', () => {
  const demo = { ...LIVE, lifecycleState: 'demo' } as SiteData;
  assert.equal(buildSiteJsonLd(demo)[0]['@id'], undefined);
  assert.equal(typeof schemaModule.siteOrganizationId, 'function', 'the reference helper exists');
  assert.equal(schemaModule.siteOrganizationId(demo), undefined);
  const noOrigin = { lifecycleState: 'live', name: 'X' } as SiteData;
  assert.equal(schemaModule.siteOrganizationId(noOrigin), undefined);
});
