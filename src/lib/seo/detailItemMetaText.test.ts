import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailItemMetaText } from './detailItemMetaText.ts';

const BASE = {
  itemTitle: 'Who Owns Your Website Address?',
  itemDescription: '<p>A domain you do not control is a landlord you never signed a lease with.</p>',
  recipeSummary: undefined,
  siteName: 'Vivreal',
  patternTitle: undefined,
  patternDescription: undefined,
  pageMetaTitle: undefined,
  pageMetaDescription: undefined,
  pageSubtitle: undefined,
  pageName: 'Blog',
};

// The reported defect, reproduced directly: every post rendered
// `<title>Blog | Vivreal</title>` because a page-level value (here,
// `pageMetaTitle`, the "Blog" page's own authored SEO title) outranked the
// item's own title whenever one was authored. This test fails on the
// pre-fix ordering (`seo?.metaTitle || patternTitle || pageName fallback`,
// which never consults the item at all) and passes once the item wins.
test('the item names its own page even when the parent page carries its own SEO title', () => {
  const out = detailItemMetaText({ ...BASE, pageMetaTitle: 'Blog', pageMetaDescription: 'Vivreal blog.' });
  assert.equal(out.title, 'Who Owns Your Website Address? | Vivreal');
  assert.equal(
    out.description,
    'A domain you do not control is a landlord you never signed a lease with.',
  );
  assert.equal(out.cardTitle, 'Who Owns Your Website Address?');
});

test('the same holds with no page-level SEO authored at all (the actual vivreal.io blog config)', () => {
  const out = detailItemMetaText(BASE);
  assert.equal(out.title, 'Who Owns Your Website Address? | Vivreal');
  assert.notEqual(out.title, 'Blog | Vivreal');
});

// Fallback: an item with no excerpt/description must not blank the meta
// description, and must fall through the chain to the page's own values
// rather than emitting an empty string.
test('an item with no excerpt falls back to the page description, then the page subtitle, then the title', () => {
  const noExcerpt = { ...BASE, itemDescription: undefined };

  assert.equal(
    detailItemMetaText({ ...noExcerpt, pageMetaDescription: 'Ideas for small business owners.' }).description,
    'Ideas for small business owners.',
  );
  assert.equal(
    detailItemMetaText({ ...noExcerpt, pageSubtitle: 'Guides and how-tos.' }).description,
    'Guides and how-tos.',
  );
  assert.equal(
    detailItemMetaText(noExcerpt).description,
    'Who Owns Your Website Address? | Vivreal',
  );
});

test('an item with no title falls back to the page name, and the page-level SEO title still applies', () => {
  const noTitle = { ...BASE, itemTitle: undefined };
  assert.equal(detailItemMetaText(noTitle).title, 'Blog | Vivreal');
  assert.equal(detailItemMetaText({ ...noTitle, pageMetaTitle: 'The Vivreal Blog' }).title, 'The Vivreal Blog');
  assert.equal(detailItemMetaText(noTitle).cardTitle, detailItemMetaText(noTitle).title);
});

test('an authored per-item pattern wins over both the item and the page', () => {
  const out = detailItemMetaText({
    ...BASE,
    patternTitle: 'Read: Who Owns Your Website Address?',
    patternDescription: 'A short, authored summary.',
    pageMetaTitle: 'Blog',
  });
  assert.equal(out.title, 'Read: Who Owns Your Website Address?');
  assert.equal(out.description, 'A short, authored summary.');
});

test("a recipe's own summary field wins over the generic item description", () => {
  const out = detailItemMetaText({
    ...BASE,
    itemDescription: '<p>An internal note nobody should see in a search snippet.</p>',
    recipeSummary: 'A quick weeknight loaf with a 24-hour cold proof.',
  });
  assert.equal(out.description, 'A quick weeknight loaf with a 24-hour cold proof.');
});

test('rich text in the description is stripped and decoded, not pasted verbatim', () => {
  const out = detailItemMetaText({
    ...BASE,
    itemDescription: '<p>Salt &amp; pepper, to taste.</p>',
  });
  assert.equal(out.description, 'Salt & pepper, to taste.');
});

test('an item title that is only whitespace is treated as absent', () => {
  const out = detailItemMetaText({ ...BASE, itemTitle: '   ' });
  assert.equal(out.title, 'Blog | Vivreal');
});
