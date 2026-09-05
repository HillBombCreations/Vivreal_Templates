import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRecipeFields } from './recipeFields.ts';

test('ingredients and steps come back as the authored lines, verbatim', () => {
  const fields = readRecipeFields({
    ingredients: ['500g bread flour', '1 1/2 cups warm water', 'a pinch of instant yeast'],
    steps: ['Mix and rest for 20 minutes.', 'Fold every 30 minutes, four times.'],
  });
  assert.deepEqual(fields.ingredients, [
    '500g bread flour',
    '1 1/2 cups warm water',
    'a pinch of instant yeast',
  ]);
  assert.deepEqual(fields.steps, [
    'Mix and rest for 20 minutes.',
    'Fold every 30 minutes, four times.',
  ]);
});

test('total time is derived from prep, cook and rest', () => {
  // 20 + 25 + 720 = 765. Rest is in the sum because bread is the category: a
  // 12 hour overnight ferment is most of the loaf's total time.
  const fields = readRecipeFields({ prepTime: 20, cookTime: 25, restTime: 720 });
  assert.equal(fields.totalMinutes, 765);
});

test('total time is derived even when a stored totalTime disagrees', () => {
  // It is never read. One number the owner cannot get out of sync.
  const fields = readRecipeFields({ prepTime: 20, cookTime: 25, totalTime: 9999 });
  assert.equal(fields.totalMinutes, 45);
});

test('a zero or absent time is absent, not zero', () => {
  const fields = readRecipeFields({ prepTime: 20, cookTime: 25, restTime: 0 });
  assert.equal(fields.restMinutes, undefined);
  assert.equal(fields.totalMinutes, 45, 'a zero part contributes nothing to the total');

  const none = readRecipeFields({});
  assert.equal(none.prepMinutes, undefined);
  assert.equal(none.totalMinutes, undefined, 'no parts at all means no total, not 0');
});

test('a time typed into a text box still reads as minutes', () => {
  // `objectValue` is Mongo Mixed. An integer field edited through a text input
  // arrives as a string, and "45 mins" is what an owner types.
  assert.equal(readRecipeFields({ prepTime: '45' }).prepMinutes, 45);
  assert.equal(readRecipeFields({ prepTime: '45 mins' }).prepMinutes, 45);
  assert.equal(readRecipeFields({ prepTime: 'about an hour' }).prepMinutes, undefined);
  assert.equal(readRecipeFields({ prepTime: -5 }).prepMinutes, undefined);
  assert.equal(readRecipeFields({ prepTime: Number.NaN }).prepMinutes, undefined);
  assert.equal(readRecipeFields({ prepTime: 45.9 }).prepMinutes, 45);
});

test('a list typed into one box splits on newlines', () => {
  const fields = readRecipeFields({
    ingredients: '500g bread flour\n\n2 tsp fine sea salt\n   ',
  });
  assert.deepEqual(fields.ingredients, ['500g bread flour', '2 tsp fine sea salt']);
});

test('object-shaped rows degrade to their text rather than to [object Object]', () => {
  // Free-text lines are the design, but a row authored before that decision (or
  // by any other tool) must not render as a stringified object in Google.
  const fields = readRecipeFields({
    ingredients: [{ item: '500g bread flour' }, { text: '2 tsp salt' }, { note: 'orphan' }],
    steps: [{ text: 'Mix.' }],
  });
  assert.deepEqual(fields.ingredients, ['500g bread flour', '2 tsp salt']);
  assert.deepEqual(fields.steps, ['Mix.']);
});

test('empty and unreadable lists yield no lines at all', () => {
  assert.deepEqual(readRecipeFields({ ingredients: [] }).ingredients, []);
  assert.deepEqual(readRecipeFields({ ingredients: ['', '   '] }).ingredients, []);
  assert.deepEqual(readRecipeFields({ ingredients: 42 }).ingredients, []);
  assert.deepEqual(readRecipeFields(undefined).ingredients, []);
  assert.deepEqual(readRecipeFields(null).steps, []);
});

test('yield and summary are trimmed text, absent when blank', () => {
  const fields = readRecipeFields({ yield: '  1 loaf  ', summary: ' A slow overnight ferment. ' });
  assert.equal(fields.recipeYield, '1 loaf');
  assert.equal(fields.summary, 'A slow overnight ferment.');

  const blank = readRecipeFields({ yield: '   ', summary: 42 });
  assert.equal(blank.recipeYield, undefined);
  assert.equal(blank.summary, undefined);
});
