import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformProduct } from '../api/products/transformProduct.ts';

// Imported lazily: on a tree without the helper the file still loads, and the
// assertions below (not an import error) are what fail.
const recordDateModule: typeof import('../api/recordDate.ts') | null = await import('../api/recordDate.ts').catch(() => null);
function helpers(): typeof import('../api/recordDate.ts') {
  assert.ok(recordDateModule, 'the reader date helper (src/lib/api/recordDate.ts) exists');
  return recordDateModule;
}

// Discovery batch U4 (design section 8): "the exact upstream fields for show,
// team and Stripe product updatedAt through Client API, settled in T2 by a test
// that asserts non-empty dates on fixtures copied from a live read".
//
// `__fixtures__/liveDetailDates.json` is a sanitized copy of live VR_Client_API
// reads (The Comedy Collective shows and team, Dougs Kitchen Stripe products):
// only `_id`, the three record dates and a title were kept.

interface Row {
  _id: string;
  updatedAt?: string;
  objectValue: Record<string, unknown>;
}
const fixture = JSON.parse(
  readFileSync(new URL('./__fixtures__/liveDetailDates.json', import.meta.url), 'utf8'),
) as { shows: Row[]; team: Row[]; stripeProducts: Row[] };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

for (const source of ['shows', 'team', 'stripeProducts'] as const) {
  test(`ALLOW (U4): every live ${source} record yields a non-empty ISO date through the reader`, () => {
    const rows = fixture[source];
    assert.ok(rows.length > 0, `sanity: the ${source} fixture holds records`);
    for (const row of rows) {
      const updatedAt =
        source === 'stripeProducts'
          ? transformProduct(row as unknown as Record<string, unknown>).updatedAt // the live row is the reader's input shape
          : helpers().withRecordDate({ id: row._id }, row).updatedAt;
      assert.ok(updatedAt && ISO.test(updatedAt), `${source} ${row._id}: ${String(updatedAt)}`);
      assert.equal(updatedAt, new Date(String(row.updatedAt)).toISOString(), 'the record’s own updatedAt, not another date');
    }
  });
}

test('REFUSE (U4): a record with no updatedAt, or an unreadable one, carries no date at all (never the clock)', () => {
  const { withRecordDate } = helpers();
  assert.deepEqual(withRecordDate({ id: 'a' }, {}), { id: 'a' });
  assert.deepEqual(withRecordDate({ id: 'a' }, { updatedAt: 'yesterday' }), { id: 'a' });
  assert.deepEqual(withRecordDate({ id: 'a' }, { updatedAt: null }), { id: 'a' });
  assert.equal('updatedAt' in transformProduct({ _id: 'p', objectValue: { name: 'x' } }), false);
});

// The readers are server-only and cannot load here, so the wiring that feeds
// these dates into the page list is pinned in their source.
const src = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('SOURCE PIN (discovery 3.3): the shows and team readers attach the record date', () => {
  assert.ok(src('../api/shows/index.tsx').includes('withRecordDate(mapShow(item), item)'));
  assert.ok(src('../api/team/index.tsx').includes('withRecordDate({'));
});

test('SOURCE PIN (discovery 3.3): the page list hands every reader’s date to the builder, and no site date', () => {
  const siteData = src('../api/siteData/index.tsx');
  for (const marker of [
    'lastModified: show.updatedAt',
    'lastModified: member.updatedAt',
    'lastModified: product.updatedAt',
  ]) {
    assert.ok(siteData.includes(marker), marker);
  }
  assert.ok(!siteData.includes('siteUpdatedAt'), 'the site date is no longer passed to the sitemap');
});

test('cleanup (review 2026-10-23): the readers use the page list’s own date rule, with no second copy of it', () => {
  assert.ok(!src('../api/recordDate.ts').includes('function recordDate'), 'recordDate.ts holds no copy of sitemapDate');
  assert.ok(src('../api/recordDate.ts').includes("import { sitemapDate } from '../seo/sitemap.ts';"));
  assert.ok(src('../api/products/transformProduct.ts').includes('sitemapDate(raw.updatedAt)'));
});
