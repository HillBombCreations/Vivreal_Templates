import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDetailJsonLd, toIso8601Duration } from './schema.ts';

const IMAGE = 'https://media.vivreal.io/recipes/focaccia.jpg';

function recipe(overrides: Record<string, unknown> = {}) {
  return buildDetailJsonLd({
    format: 'recipes',
    title: 'Overnight focaccia',
    imageUrl: IMAGE,
    url: 'https://wavesofgrainco.com/recipes/aaa111',
    recipeIngredients: ['500g bread flour', 'a pinch of instant yeast'],
    recipeInstructions: ['Mix and rest.', 'Fold four times.'],
    prepMinutes: 20,
    cookMinutes: 25,
    restMinutes: 720,
    recipeYield: '1 loaf',
    authorName: 'Waves of Grain',
    datePublished: '2026-09-05',
    ...overrides,
  });
}

test('a recipe emits Recipe with its ingredients, steps, times and yield', () => {
  const schema = recipe();
  assert.equal(schema['@type'], 'Recipe');
  assert.deepEqual(schema.recipeIngredient, ['500g bread flour', 'a pinch of instant yeast']);
  assert.deepEqual(schema.recipeInstructions, [
    { '@type': 'HowToStep', text: 'Mix and rest.' },
    { '@type': 'HowToStep', text: 'Fold four times.' },
  ]);
  assert.equal(schema.prepTime, 'PT20M');
  assert.equal(schema.cookTime, 'PT25M');
  assert.equal(schema.recipeYield, '1 loaf');
  assert.equal(schema.image, IMAGE);
  assert.deepEqual(schema.author, { '@type': 'Organization', name: 'Waves of Grain' });
  assert.equal(schema.datePublished, '2026-09-05');
});

test('total time is DERIVED from prep + cook + rest', () => {
  // 20 + 25 + 720 = 765 minutes = 12h 45m. Rest has no schema.org field of its
  // own, so if it were not in this sum a bread recipe would advertise 45
  // minutes for an overnight loaf.
  assert.equal(recipe().totalTime, 'PT12H45M');
});

test('a recipe image points at the stable card URL, not the unfetchable media URL', () => {
  // `unsignMediaUrl` produces a URL this CloudFront distribution 403s (its own
  // doc comment says so). That is survivable for the other shapes and fatal for
  // a Recipe, where an unfetchable image means no rich result at all.
  const schema = recipe({
    durableImageUrl: 'https://wavesofgrainco.com/og/recipes/aaa111',
  });
  assert.equal(schema.image, 'https://wavesofgrainco.com/og/recipes/aaa111');
});

test('two recipes point at two different images', () => {
  const first = recipe({ durableImageUrl: 'https://wavesofgrainco.com/og/recipes/aaa111' });
  const second = recipe({
    title: 'Seeded rye',
    durableImageUrl: 'https://wavesofgrainco.com/og/recipes/bbb222',
  });
  assert.notEqual(first.image, second.image);
});

test('a recipe with no resolvable origin still emits the item media URL', () => {
  // A site with no custom domain resolves no durable origin. Falling back to
  // the item media is worse but it is not NOTHING, and it degrades the same way
  // every other JSON-LD shape on this route already does.
  assert.equal(recipe({ durableImageUrl: undefined }).image, IMAGE);
});

test('a photo-less recipe falls back to Article rather than an invalid Recipe', () => {
  // Google's Recipe rich results require an image. Emitting a Recipe without
  // one fails validation for the whole page, which is worse than an Article.
  const schema = recipe({ imageUrl: undefined });
  assert.equal(schema['@type'], 'Article');
  assert.equal(schema.headline, 'Overnight focaccia');
  assert.equal(schema.recipeIngredient, undefined);
  assert.equal(schema.totalTime, undefined);
});

test('the card URL alone does not qualify a photo-less recipe as a Recipe', () => {
  // The card route ALWAYS answers, so treating its URL as "has an image" would
  // let every photo-less recipe emit a Recipe whose picture is a generated
  // title card. The Recipe/Article decision stays on the item's own media.
  const schema = recipe({
    imageUrl: undefined,
    durableImageUrl: 'https://wavesofgrainco.com/og/recipes/aaa111',
  });
  assert.equal(schema['@type'], 'Article');
});

test('absent recipe parts are omitted, never emitted as zero or empty', () => {
  const schema = recipe({
    restMinutes: 0,
    cookMinutes: undefined,
    recipeIngredients: [],
    recipeInstructions: [],
    recipeYield: undefined,
    authorName: undefined,
  });
  assert.equal(schema.cookTime, undefined);
  assert.equal(schema.recipeIngredient, undefined);
  assert.equal(schema.recipeInstructions, undefined);
  assert.equal(schema.recipeYield, undefined);
  assert.equal(schema.author, undefined);
  assert.equal(schema.totalTime, 'PT20M', 'a zero rest contributes nothing to the total');
});

test('a recipe with no times at all emits no durations', () => {
  const schema = recipe({ prepMinutes: undefined, cookMinutes: undefined, restMinutes: undefined });
  assert.equal(schema.prepTime, undefined);
  assert.equal(schema.cookTime, undefined);
  assert.equal(schema.totalTime, undefined);
});

test('a free-text publish date is dropped rather than published', () => {
  // `objectValue` is Mongo Mixed: the stored value is whatever the CMS wrote.
  assert.equal(recipe({ datePublished: 'Autumn 2026' }).datePublished, undefined);
  assert.equal(recipe({ datePublished: '2026-09-05T11:00:00Z' }).datePublished, '2026-09-05T11:00:00Z');
});

test('minutes render as ISO 8601 durations', () => {
  assert.equal(toIso8601Duration(1), 'PT1M');
  assert.equal(toIso8601Duration(45), 'PT45M');
  assert.equal(toIso8601Duration(60), 'PT1H');
  assert.equal(toIso8601Duration(720), 'PT12H');
  assert.equal(toIso8601Duration(785), 'PT13H5M');
  assert.equal(toIso8601Duration(0), undefined);
  assert.equal(toIso8601Duration(-5), undefined);
  assert.equal(toIso8601Duration(undefined), undefined);
  assert.equal(toIso8601Duration(Number.NaN), undefined);
});

test('the other detail formats are untouched by the Recipe branch', () => {
  // The call site had to be widened for `recipes` to reach its own branch at
  // all; this pins that widening it did not move anything else.
  const product = buildDetailJsonLd({
    format: 'products',
    title: 'Sourdough loaf',
    price: '9.00',
    sku: 'abc',
  });
  assert.equal(product['@type'], 'Product');

  const priceless = buildDetailJsonLd({ format: 'collection-list', title: 'A thing' });
  assert.equal(priceless['@type'], 'Thing');

  const event = buildDetailJsonLd({ format: 'shows', title: 'A show', startDate: '2026-09-05' });
  assert.equal(event['@type'], 'Event');

  const unknown = buildDetailJsonLd({ format: 'blog', title: 'A post', authorName: 'Jo' });
  assert.equal(unknown['@type'], 'Article');
  assert.deepEqual(unknown.author, { '@type': 'Person', name: 'Jo' });
});
