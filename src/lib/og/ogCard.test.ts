import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOgImageUrl,
  buildOgItemImageUrl,
  isLightColor,
  planOgItemCard,
  resolvePageOgHeading,
} from './ogCard.ts';

/**
 * Phase 1 exit criterion #2: two different recipes produce two different
 * social cards.
 *
 * Note the shape of every assertion below: each one compares TWO items. A test
 * that only checked one item would pass against the broken code, because the
 * broken code produced a perfectly good card — the same perfectly good card,
 * for every item on the page.
 */

const ORIGIN = 'https://wavesofgrainco.com';

test('two items under one page produce two different card URLs', () => {
  const first = buildOgItemImageUrl(ORIGIN, 'recipes', 'aaa111');
  const second = buildOgItemImageUrl(ORIGIN, 'recipes', 'bbb222');
  assert.notEqual(first, second);
  assert.equal(first, `${ORIGIN}/og/recipes/aaa111`);
  assert.equal(second, `${ORIGIN}/og/recipes/bbb222`);
});

test('an item card URL is not the page card URL', () => {
  // The pre-change behaviour: every detail item inherited buildOgImageUrl(
  // origin, slug), so a recipe's og:image was its page's og:image.
  assert.notEqual(
    buildOgItemImageUrl(ORIGIN, 'recipes', 'aaa111'),
    buildOgImageUrl(ORIGIN, 'recipes'),
  );
});

test('the card URL escapes both segments', () => {
  // Slugs and item keys are author-controlled; `itemKeyField` lets an item be
  // addressed by an arbitrary stored string, not just a Mongo id.
  assert.equal(
    buildOgItemImageUrl(ORIGIN, 'our recipes', 'no-knead/focaccia'),
    `${ORIGIN}/og/our%20recipes/no-knead%2Ffocaccia`,
  );
});

test('two items with their own photos plan two different cards', () => {
  const first = planOgItemCard(
    { title: 'Overnight focaccia', imageUrl: 'https://media.vivreal.io/a.jpg?Signature=x' },
    'Recipes',
  );
  const second = planOgItemCard(
    { title: 'Seeded rye', imageUrl: 'https://media.vivreal.io/b.jpg?Signature=y' },
    'Recipes',
  );
  assert.deepEqual(first, {
    kind: 'photo',
    signedUrl: 'https://media.vivreal.io/a.jpg?Signature=x',
    heading: 'Overnight focaccia',
  });
  assert.notDeepEqual(first, second);
  assert.notEqual(first.heading, second.heading);
  assert.notEqual(
    first.kind === 'photo' ? first.signedUrl : '',
    second.kind === 'photo' ? second.signedUrl : '',
  );
});

test('two photo-less items still plan two different cards', () => {
  // The weaker fallback would be "no photo ⇒ use the page card", which puts
  // one image back on every recipe. The generated card must still name THIS
  // recipe.
  const first = planOgItemCard({ title: 'Overnight focaccia' }, 'Recipes');
  const second = planOgItemCard({ title: 'Seeded rye' }, 'Recipes');
  assert.deepEqual(first, { kind: 'card', heading: 'Overnight focaccia' });
  assert.deepEqual(second, { kind: 'card', heading: 'Seeded rye' });
});

test('a photo plan still carries the item heading for the failure path', () => {
  // A signed media URL can 403 by the time a crawler fetches it. When the
  // proxy fails, the fallback card must name the item, not the page.
  const plan = planOgItemCard(
    { title: 'Overnight focaccia', imageUrl: 'https://media.vivreal.io/a.jpg' },
    'Recipes',
  );
  assert.equal(plan.heading, 'Overnight focaccia');
});

test('no item at all falls back to the page heading', () => {
  assert.deepEqual(planOgItemCard(undefined, 'Recipes'), { kind: 'card', heading: 'Recipes' });
  assert.deepEqual(planOgItemCard(null, 'Recipes'), { kind: 'card', heading: 'Recipes' });
  assert.deepEqual(planOgItemCard({ title: '   ' }, 'Recipes'), {
    kind: 'card',
    heading: 'Recipes',
  });
});

test('a non-media image value never becomes a photo plan', () => {
  // `getSignedUrl` returns '' for anything that is not a media descriptor, and
  // an item can carry a relative or junk value. Proxying it would 500 the card.
  assert.equal(planOgItemCard({ title: 'A', imageUrl: '' }, 'Recipes').kind, 'card');
  assert.equal(planOgItemCard({ title: 'A', imageUrl: '/local.jpg' }, 'Recipes').kind, 'card');
});

test('a heading is capped so Satori cannot be handed an unbounded string', () => {
  const long = 'x'.repeat(500);
  assert.equal(planOgItemCard({ title: long }, 'Recipes').heading.length, 100);
  assert.equal(resolvePageOgHeading({ name: long }, { slug: 'recipes' }).length, 100);
});

test('page heading precedence is unchanged: metaTitle, label, name, then fallbacks', () => {
  assert.equal(
    resolvePageOgHeading(
      { seo: { metaTitle: 'Meta' }, labels: { title: 'Label' }, name: 'Name' },
      { slug: 'recipes', siteName: 'Site' },
    ),
    'Meta',
  );
  assert.equal(
    resolvePageOgHeading({ labels: { title: 'Label' }, name: 'Name' }, { slug: 'recipes' }),
    'Label',
  );
  assert.equal(resolvePageOgHeading({ name: 'Name' }, { slug: 'recipes' }), 'Name');
  assert.equal(
    resolvePageOgHeading(undefined, { staticTitle: 'Privacy Policy', siteName: 'Site', slug: 'privacy' }),
    'Privacy Policy',
  );
  assert.equal(resolvePageOgHeading(undefined, { siteName: 'Site', slug: 'recipes' }), 'Site');
  assert.equal(resolvePageOgHeading(undefined, { slug: 'recipes' }), 'recipes');
});

test('card text colour still flips on a light brand colour', () => {
  // Moved here from the route with the rest of the card logic; pinned so the
  // move is not silently a rewrite.
  assert.equal(isLightColor('#ffffff'), true);
  assert.equal(isLightColor('#fff'), true);
  assert.equal(isLightColor('#0f172a'), false);
  assert.equal(isLightColor('not-a-colour'), false);
  assert.equal(isLightColor(''), false);
});
