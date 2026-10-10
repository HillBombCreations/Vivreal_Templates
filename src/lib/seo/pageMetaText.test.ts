import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeMetaText, pageMetaText, readBusinessFacts, summaryFromFacts, SUMMARY_MAX_CHARS } from './pageMetaText.ts';
import { resolvePageForSlug } from '../pages/builtInPages.ts';

const COBALT = readBusinessFacts(
  {
    name: 'Cobalt & Crumb',
    description: '<p>Small batch bread, baked daily.</p>',
    address: { city: 'Knoxville', state: 'TN' },
    contactInfo: {},
  },
  undefined,
);
const BARE = readBusinessFacts({ name: 'Cobalt & Crumb', contactInfo: {} }, undefined);

// Item 23 (PR-6, ledger QA-W18-4).
test('ALLOW (item 23): the checkout pages are titled by their format, not their raw slug', () => {
  const success = pageMetaText({ page: resolvePageForSlug([], 'checkoutsuccess'), slug: 'checkoutsuccess', facts: COBALT });
  const cancel = pageMetaText({ page: resolvePageForSlug([], 'checkoutcancel'), slug: 'checkoutcancel', facts: COBALT });
  assert.equal(success.title, 'Thanks for your order | Cobalt & Crumb');
  assert.equal(cancel.title, 'Checkout cancelled | Cobalt & Crumb');
});

test('ALLOW (item 23): a STORED checkout page whose name is the raw slug still gets the format title', () => {
  const stored = { name: 'checkoutsuccess', slug: 'checkoutsuccess', format: 'checkout-success', labels: {} };
  const { title } = pageMetaText({ page: stored, slug: 'checkoutsuccess', facts: COBALT });
  assert.equal(title, 'Thanks for your order | Cobalt & Crumb');
  assert.doesNotMatch(title, /checkoutsuccess/);
});

test('REFUSE (item 23): an owner-set title still wins over the format default', () => {
  const metaTitle = { name: 'checkoutsuccess', format: 'checkout-success', labels: {}, seo: { metaTitle: 'Order received, thank you!' } };
  const labelTitle = { name: 'checkoutsuccess', format: 'checkout-success', labels: { title: 'All done' } };
  assert.equal(pageMetaText({ page: metaTitle, slug: 'checkoutsuccess', facts: COBALT }).title, 'Order received, thank you!');
  assert.equal(pageMetaText({ page: labelTitle, slug: 'checkoutsuccess', facts: COBALT }).title, 'All done | Cobalt & Crumb');
});

// R4: default summaries from business facts.
test('ALLOW (R4): a page with no summary of its own gets one from the business facts', () => {
  const { description } = pageMetaText({ page: { name: 'Menu', format: 'menu', labels: {} }, slug: 'menu', facts: COBALT });
  assert.equal(description, 'Menu at Cobalt & Crumb in Knoxville, TN. Small batch bread, baked daily.');
});

test('REFUSE (R4): the owner summary and subtitle still win over the facts', () => {
  const owned = { name: 'Menu', format: 'menu', labels: { subtitle: 'What we bake' }, seo: { metaDescription: 'Our bread.' } };
  assert.equal(pageMetaText({ page: owned, slug: 'menu', facts: COBALT }).description, 'Our bread.');
  const subtitled = { name: 'Menu', format: 'menu', labels: { subtitle: 'What we bake' } };
  assert.equal(pageMetaText({ page: subtitled, slug: 'menu', facts: COBALT }).description, 'What we bake');
});

test('REFUSE (R4): with no description and no town, nothing is invented and today\'s line stays', () => {
  const { description } = pageMetaText({ page: { name: 'Menu', format: 'menu', labels: {} }, slug: 'menu', facts: BARE });
  assert.equal(description, 'Menu | Cobalt & Crumb');
});

test('R4: the towns served stand in for an address, three at most, in words', () => {
  const facts = readBusinessFacts(
    { name: 'Clipper Lane', serviceArea: ['Alcoa', ' ', 'Maryville', 'Knoxville', 'Oak Ridge'], contactInfo: {} },
    undefined,
  );
  assert.equal(summaryFromFacts('Haircuts', facts), 'Haircuts at Clipper Lane serving Alcoa, Maryville and Knoxville.');
});

test('R4: a long description is cut to the summary length', () => {
  const facts = readBusinessFacts({ name: 'X', description: 'word '.repeat(80), contactInfo: {} }, undefined);
  assert.ok((summaryFromFacts('Menu', facts) ?? '').length <= SUMMARY_MAX_CHARS);
});

test('ALLOW (R4): the home page title and summary name the town when the owner wrote neither', () => {
  const { title, description } = homeMetaText({ seo: undefined, facts: COBALT });
  assert.equal(title, 'Cobalt & Crumb | Knoxville, TN');
  assert.equal(description, 'Cobalt & Crumb, in Knoxville, TN. Small batch bread, baked daily.');
});

test('REFUSE (R4): the home page keeps the owner\'s title and summary, and today\'s lines with no facts', () => {
  assert.equal(homeMetaText({ seo: { metaTitle: 'Bread!', metaDescription: 'Ours.' }, facts: COBALT }).title, 'Bread!');
  assert.equal(homeMetaText({ seo: { metaTitle: 'Bread!', metaDescription: 'Ours.' }, facts: COBALT }).description, 'Ours.');
  const bare = homeMetaText({ seo: undefined, facts: BARE });
  assert.equal(bare.title, 'Cobalt & Crumb');
  assert.equal(bare.description, 'Welcome to Cobalt & Crumb. Discover our latest content, events, and more.');
});
