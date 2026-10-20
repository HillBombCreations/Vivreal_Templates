import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  popupErrorText,
  popupFailedText,
  SIGNUP_UNAVAILABLE_TEXT,
  withSignupUnavailableCopy,
} from './subscribersList.ts';

/**
 * Renderer 1.88.1 (V7.232) splits the sign up error line in two: `errorText`
 * is shown for a bad address only, `failedText` for a failed send. On a site
 * with no list, `subscribeUser` refuses before any request, so EVERY send
 * fails, and the line the visitor sees is the failed-send line. Templates
 * must hand "not taking sign ups yet" over as `failedText`, or the visitor
 * gets the renderer's generic "could not sign you up just now".
 *
 * The renderer's own decision (`signupErrorText`) is not in its exports map,
 * so it is loaded from the INSTALLED package by file path. That makes this a
 * test of the pin as well: it is the installed renderer, not a copy of its
 * rule, that turns the copy below into the visible line.
 */

const NOT_TAKING = 'Sorry, this site is not taking sign ups yet. Your email was not saved.';

const signupCopyUrl = new URL(
  '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/signupCopy.js',
  import.meta.url,
);
const installedVersion: string = JSON.parse(
  fs.readFileSync(
    new URL('../../../node_modules/@hillbombcreations/site-renderer/package.json', import.meta.url),
    'utf8',
  ),
).version;

type SignupErrorText = (error: 'invalid' | 'failed', errorText?: string, failedText?: string) => string;
type FooterConfig = { enabled: boolean; copy?: { heading?: string; errorText?: string; failedText?: string } };
const footer = (): FooterConfig => ({ enabled: true, copy: { heading: 'Join' } });

const load = async (): Promise<SignupErrorText> => (await import(signupCopyUrl.href)).signupErrorText;

test('the constant is the exact line the visitor must see', () => {
  assert.equal(SIGNUP_UNAVAILABLE_TEXT, NOT_TAKING);
});

// Asserted against the pin, not a literal, so a later bump does not break it,
// plus a floor at 1.88.1, the first release that reads failedText.
const pinnedVersion: string = JSON.parse(
  fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
).dependencies['@hillbombcreations/site-renderer'];
const atLeast = (v: string, floor: string): boolean => {
  const a = v.split('.').map(Number);
  const b = floor.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

test('the installed renderer is the pinned one, and at least 1.88.1, the release that reads failedText', () => {
  assert.equal(installedVersion, pinnedVersion);
  assert.ok(atLeast(installedVersion, '1.88.1'), `installed ${installedVersion} is older than 1.88.1`);
});

test('REFUSE: the floor rejects a renderer older than 1.88.1', () => {
  assert.equal(atLeast('1.88.0', '1.88.1'), false);
  assert.equal(atLeast('1.87.9', '1.88.1'), false);
  assert.equal(atLeast('1.88.2', '1.88.1'), true);
});

test('ALLOW: a no-list footer sign up that fails shows "not taking sign ups yet"', async () => {
  const signupErrorText = await load();
  const out = withSignupUnavailableCopy(footer(), '');
  assert.equal(out?.copy?.failedText, NOT_TAKING);
  assert.equal(signupErrorText('failed', out?.copy?.errorText, out?.copy?.failedText), NOT_TAKING);
});

test('ALLOW: a no-list popup sign up that fails shows "not taking sign ups yet"', async () => {
  const signupErrorText = await load();
  const errorText = popupErrorText({ collectionId: '', ownerErrorText: 'Please enter a valid email address.' });
  assert.equal(signupErrorText('failed', errorText, popupFailedText('')), NOT_TAKING);
});

test('REFUSE: a site WITH a list gets no failedText, so a failed send says "not saved", never "not taking sign ups"', async () => {
  const signupErrorText = await load();
  assert.equal(popupFailedText('list-1'), undefined);
  const out = withSignupUnavailableCopy(footer(), 'list-1');
  assert.equal(out?.copy && 'failedText' in out.copy, false);
  const line = signupErrorText('failed', undefined, popupFailedText('list-1'));
  assert.notEqual(line, NOT_TAKING);
  assert.match(line, /not saved/);
});

test('REFUSE: without failedText, the installed renderer would NOT show the no-list line (the gap this closes)', async () => {
  const signupErrorText = await load();
  assert.notEqual(signupErrorText('failed', NOT_TAKING, undefined), NOT_TAKING);
});

test('the popup passes failedText through popupFailedText', () => {
  const popup = fs.readFileSync(
    new URL('../../components/HomeSections/EmailPopup/index.tsx', import.meta.url),
    'utf8',
  );
  assert.match(popup, /failedText=\{popupFailedText\(collectionId\)\}/);
});
