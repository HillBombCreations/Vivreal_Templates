import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popupErrorText, popupFailedText, SIGNUP_UNAVAILABLE_TEXT } from './subscribersList.ts';

/**
 * The popup's "Error message" is owner-editable in Studio, and Studio seeds it
 * with "Please enter a valid email address.". V7.236 (walk C, N-C13) dropped
 * it after a failed send, because renderer 1.88.0 showed an authored line for
 * a bad address AND a failed send. Renderer 1.88.1 shows `errorText` for a bad
 * address only, so the owner's line now always passes through, and these
 * tests run the INSTALLED renderer's `signupErrorText` to prove a failed send
 * still never shows it. The rule is loaded by file path (it is not in the
 * renderer's exports map), the same way signupFailedText.test.ts does.
 */

const OWNER = 'Please enter a valid email address.';

type SignupErrorText = (error: 'invalid' | 'failed', errorText?: string, failedText?: string) => string;
const signupCopyUrl = new URL(
  '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/signupCopy.js',
  import.meta.url,
);
const load = async (): Promise<SignupErrorText> => (await import(signupCopyUrl.href)).signupErrorText;

test('ALLOW: with a list, the owner line passes through as the bad-address line', async () => {
  const signupErrorText = await load();
  assert.equal(popupErrorText({ collectionId: 'list-1', ownerErrorText: OWNER }), OWNER);
  assert.equal(popupErrorText({ collectionId: 'list-1', ownerErrorText: 'Check that address' }), 'Check that address');
  assert.equal(popupErrorText({ collectionId: 'list-1', ownerErrorText: undefined }), undefined);
  const errorText = popupErrorText({ collectionId: 'list-1', ownerErrorText: 'Check that address' });
  assert.equal(signupErrorText('invalid', errorText, popupFailedText('list-1')), 'Check that address');
});

test('REFUSE: with a list, a failed send never shows the owner bad-address line, it says the email was not saved', async () => {
  const signupErrorText = await load();
  for (const ownerErrorText of [OWNER, 'Check that address']) {
    const errorText = popupErrorText({ collectionId: 'list-1', ownerErrorText });
    const line = signupErrorText('failed', errorText, popupFailedText('list-1'));
    assert.notEqual(line, ownerErrorText);
    assert.match(line, /not saved/);
  }
});

test('UNCHANGED: with no list, the line says sign ups are not open', () => {
  assert.equal(popupErrorText({ collectionId: '', ownerErrorText: OWNER }), SIGNUP_UNAVAILABLE_TEXT);
  assert.equal(popupErrorText({ collectionId: '', ownerErrorText: undefined }), SIGNUP_UNAVAILABLE_TEXT);
});
