import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upstreamErrorForVisitor } from './upstreamErrorText.ts';

const FALLBACK = 'Failed to send message';

test('a VALIDATION or INTERNAL body gives the site its own fallback, never the API sentence', () => {
  assert.equal(
    upstreamErrorForVisitor({ success: false, error: 'Check the highlighted fields.', errorCode: 'VALIDATION', fields: [] }, FALLBACK),
    FALLBACK,
  );
  assert.equal(upstreamErrorForVisitor({ error: 'Internal Server Error', errorCode: 'INTERNAL' }, FALLBACK), FALLBACK);
});

test('ALLOW: a refusal written for the visitor passes through as before', () => {
  assert.equal(upstreamErrorForVisitor({ error: 'Please enter your name', field: 'name' }, FALLBACK), 'Please enter your name');
  assert.equal(
    upstreamErrorForVisitor({ error: 'This site is paused.', code: 'GroupFrozen', ownerSafe: true }, FALLBACK),
    'This site is paused.',
  );
  assert.equal(upstreamErrorForVisitor({ message: 'That code has ended.' }, FALLBACK), 'That code has ended.');
});

test('REFUSE: a pre-contract Joi array, a blank, or a non-object body is the fallback', () => {
  assert.equal(upstreamErrorForVisitor({ error: [{ message: '"email" is required', path: ['email'] }] }, FALLBACK), FALLBACK);
  assert.equal(upstreamErrorForVisitor({ error: '   ' }, FALLBACK), FALLBACK);
  assert.equal(upstreamErrorForVisitor(null, FALLBACK), FALLBACK);
  assert.equal(upstreamErrorForVisitor('Internal Server Error', FALLBACK), FALLBACK);
});
