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
// `<title>Blog | Vivreal</title>` because the PAGE's own authored SEO title
// (`pageMetaTitle`, authored for the listing page, "Blog") outranked the
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

test('the same holds with no page-level SEO authored at all', () => {
  const out = detailItemMetaText(BASE);
  assert.equal(out.title, 'Who Owns Your Website Address? | Vivreal');
  assert.notEqual(out.title, 'Blog | Vivreal');
});

// The REAL vivreal.io blog config (pod_01.sites, the Vivreal document,
// `pages[].slug === "blog"`), not a hand-built stand-in: the page carries its
// own `seo.metaTitle`/`metaDescription` AND an authored `detailPage.seo
// .titlePattern` of `{item.title}` (resolved below, as the route resolves
// it), and the item's `description` field is the full HTML article body (the
// Vivreal blog collection stores the post there, not a short summary — see
// docs/projects/isr-and-social-pass/review-templates-185.md Concern 1). This
// is the case that went through a green suite while shipping a meta
// description cut off mid-word, because no prior test combined an authored
// pattern/page SEO with a long HTML `itemDescription`.
test('the real vivreal.io blog config: an authored title pattern wins over the page SEO title, and a long HTML body does not leak verbatim past the 160-char cap', () => {
  const longArticleBody =
    '<p>WordPress can build almost anything, and that is genuinely why it runs so much of the web. ' +
    'The cost is not the software, which is free. It is that someone has to keep it updated, patched, ' +
    'and running, which is a second job most small business owners never signed up for.</p>';
  const out = detailItemMetaText({
    ...BASE,
    itemTitle: 'Vivreal vs WordPress: A Modern Site With No Web Guy to Call',
    itemDescription: longArticleBody,
    patternTitle: 'Vivreal vs WordPress: A Modern Site With No Web Guy to Call', // resolved {item.title}
    patternDescription: undefined, // the blog authors no descriptionPattern (Concern 1, a data gap)
    pageMetaTitle: 'Blog | Vivreal',
    pageMetaDescription:
      'Customer stories, practical guides, and product updates for owners running their site, store, and channels on Vivreal.',
  });
  assert.equal(out.title, 'Vivreal vs WordPress: A Modern Site With No Web Guy to Call');
  assert.notEqual(out.title, 'Blog | Vivreal');
  // Concern 1 is a DATA fix (an authored `descriptionPattern: "{item.excerpt}"`
  // on the live page), not a code change, so with no pattern authored here the
  // resolver still falls to the item's own (HTML) description, capped at 160,
  // rather than the page's generic `metaDescription` — strictly better than
  // today (one shared description for every post) but still half the fix.
  // This assertion documents that remaining gap rather than hiding it.
  assert.notEqual(out.description, longArticleBody);
  assert.notEqual(
    out.description,
    'Customer stories, practical guides, and product updates for owners running their site, store, and channels on Vivreal.',
  );
  assert.ok(out.description.length <= 160);
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
