import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popupErrorText, SIGNUP_UNAVAILABLE_TEXT } from './subscribersList.ts';

/**
 * V7.236 (walk C, N-C13): with `/api/subscribe` dropped, every sign up spot
 * told a visitor with a correct address "Please enter a valid email address."
 * The popup's "Error message" is owner-editable in Studio, and Studio seeds it
 * with exactly that line, but the renderer shows an authored line for a bad
 * address AND a failed send. So the popup keeps the owner's line until a send
 * fails, then hands the choice back to the renderer, whose own lines tell the
 * two apart.
 */

const OWNER = 'Please enter a valid email address.';

test('ALLOW: before any failed send, the owner line is the bad-address line', () => {
  assert.equal(popupErrorText({ collectionId: 'list-1', ownerErrorText: OWNER, lastSendFailed: false }), OWNER);
  assert.equal(popupErrorText({ collectionId: 'list-1', ownerErrorText: 'Check that address', lastSendFailed: false }), 'Check that address');
  assert.equal(popupErrorText({ collectionId: 'list-1', ownerErrorText: undefined, lastSendFailed: false }), undefined);
});

test('REFUSE: after a failed send, no owner line reaches the renderer, so it says the email was not saved', () => {
  assert.equal(popupErrorText({ collectionId: 'list-1', ownerErrorText: OWNER, lastSendFailed: true }), undefined);
  assert.equal(popupErrorText({ collectionId: 'list-1', ownerErrorText: 'Check that address', lastSendFailed: true }), undefined);
});

test('UNCHANGED: with no list, the line says sign ups are not open, whatever happened', () => {
  for (const lastSendFailed of [false, true]) {
    assert.equal(popupErrorText({ collectionId: '', ownerErrorText: OWNER, lastSendFailed }), SIGNUP_UNAVAILABLE_TEXT);
  }
});
