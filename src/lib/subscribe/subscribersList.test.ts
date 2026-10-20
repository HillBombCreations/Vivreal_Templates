import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SIGNUP_UNAVAILABLE_TEXT,
  resolveSubscribersCollectionId,
  withSignupUnavailableCopy,
  type SubscribersListSource,
} from './subscribersList.ts';

/**
 * N-C6 (vivreal-hq docs/projects/next-release-v7/walks/walk-C-2026-10-16.md):
 * a kit site with no `subscribers` page posted `collectionId: ''` from every
 * sign-up form and told the visitor their email was invalid.
 */

// The synthetic page VR_Client_API adds for a site that LINKS its list,
// shaped exactly as getSiteDetails builds it.
const linkedSubscribersPage = (id: string) => ({
  format: 'subscribers',
  collectionId: id,
  blocks: [
    {
      type: { kind: 'page-template', dispatchId: 'subscribe' },
      config: { bindings: [{ collectionId: id, role: 'primary' }] },
    },
  ],
});

// A kit site: twenty ordinary pages, no `subscribers` page.
const kitPages = Array.from({ length: 20 }, (_, i) => ({ format: i === 0 ? 'products' : 'standard' }));

test('ALLOW: no subscribers page, the API resolves the claimed list, and that id is used', () => {
  const site: SubscribersListSource = { pageConfigs: kitPages, subscribersCollectionId: 'drop-list' };
  assert.equal(resolveSubscribersCollectionId(site), 'drop-list');
});

test('REFUSE: no subscribers page and no claimed list resolves to no list', () => {
  assert.equal(resolveSubscribersCollectionId({ pageConfigs: kitPages }), '');
  assert.equal(resolveSubscribersCollectionId({ pageConfigs: kitPages, subscribersCollectionId: null }), '');
  assert.equal(resolveSubscribersCollectionId({ pageConfigs: kitPages, subscribersCollectionId: '   ' }), '');
  assert.equal(resolveSubscribersCollectionId(undefined), '');
  assert.equal(resolveSubscribersCollectionId({ pageConfigs: null }), '');
});

test('UNCHANGED: a linked list (subscribers page) still wins, even over a claimed list', () => {
  // Both present on purpose: if precedence flipped this would read 'other'.
  const site: SubscribersListSource = {
    pageConfigs: [...kitPages, linkedSubscribersPage('linked-list')],
    subscribersCollectionId: 'other',
  };
  assert.equal(resolveSubscribersCollectionId(site), 'linked-list');
});

test('UNCHANGED: the block binding outranks the legacy page collectionId, as before', () => {
  const page = { ...linkedSubscribersPage('block-list'), collectionId: 'legacy-list' };
  assert.equal(resolveSubscribersCollectionId({ pageConfigs: [page] }), 'block-list');
  const blockless = { format: 'subscribers', collectionId: 'legacy-list' };
  assert.equal(resolveSubscribersCollectionId({ pageConfigs: [blockless] }), 'legacy-list');
});

test('ALLOW: with a list and no error line, the form config is returned untouched (same reference)', () => {
  type FooterConfig = { enabled: boolean; copy?: { heading?: string; errorText?: string } };
  const config: FooterConfig = { enabled: true, copy: { heading: 'Join' } };
  assert.equal(withSignupUnavailableCopy(config, 'drop-list'), config);
  const noCopy: FooterConfig = { enabled: true };
  assert.equal(withSignupUnavailableCopy(noCopy, 'drop-list'), noCopy);
});

// V7.236 (walk C, N-C13) used to drop a stored footer errorText on a list
// site, because renderer 1.88.0 showed an authored errorText for a failed send
// too. Renderer 1.88.1 shows it for a bad address only, so the config passes
// through, and the INSTALLED renderer's rule (loaded by file path, as in
// signupFailedText.test.ts) proves a failed send still never shows it.
type SignupErrorText = (error: 'invalid' | 'failed', errorText?: string, failedText?: string) => string;
const loadSignupErrorText = async (): Promise<SignupErrorText> =>
  (
    await import(
      new URL('../../../node_modules/@hillbombcreations/site-renderer/dist/lib/signupCopy.js', import.meta.url).href
    )
  ).signupErrorText;

test('REFUSE: with a list, a failed footer sign up never shows the stored bad-address line', async () => {
  const signupErrorText = await loadSignupErrorText();
  const config = { enabled: true, copy: { heading: 'Join', errorText: 'Please enter a valid email address.' } };
  const out = withSignupUnavailableCopy(config, 'drop-list');
  assert.equal(out, config, 'the SAME reference: nothing is copied or dropped');
  // A list footer carries no failedText (signupFailedText.test.ts REFUSE).
  const line = signupErrorText('failed', out?.copy?.errorText);
  assert.notEqual(line, 'Please enter a valid email address.');
  assert.match(line, /not saved/);
  assert.equal(signupErrorText('invalid', out?.copy?.errorText), 'Please enter a valid email address.', 'a bad address still gets it');
});

test('REFUSE: with no list, the error line says sign ups are not open, not "valid email"', () => {
  const config = { enabled: true, copy: { heading: 'Join', errorText: 'Please enter a valid email address.' } };
  const out = withSignupUnavailableCopy(config, '');
  assert.equal(out?.copy?.errorText, SIGNUP_UNAVAILABLE_TEXT);
  assert.equal(out?.copy && 'heading' in out.copy ? out.copy.heading : undefined, 'Join');
  assert.equal(config.copy.errorText, 'Please enter a valid email address.', 'the stored config is not mutated');
  const noCopy: { enabled: boolean; copy?: { errorText?: string } } = { enabled: true };
  assert.equal(withSignupUnavailableCopy(noCopy, '')?.copy?.errorText, SIGNUP_UNAVAILABLE_TEXT);
  assert.equal(withSignupUnavailableCopy(null, ''), null);
});

test('the copy follows brand voice: no em or en dash, and it never blames the address', () => {
  const dashes = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
  assert.doesNotMatch(SIGNUP_UNAVAILABLE_TEXT, dashes);
  assert.doesNotMatch(SIGNUP_UNAVAILABLE_TEXT, /valid/i);
});

// The three form owners must reach the resolver. Their files are JSX, which
// this runner cannot load, so the wiring is pinned on their source.
const read = (rel: string) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

test('REFUSE: every sign-up surface Templates owns resolves through the shared resolver', () => {
  const providers = read('../../components/Providers/index.tsx');
  const popup = read('../../components/HomeSections/EmailPopup/index.tsx');
  const footer = read('../../components/Footer/index.tsx');
  assert.match(providers, /resolveSubscribersCollectionId\(siteData\)/, 'Providers onSubscribe');
  assert.match(popup, /cfg\.collectionId \?\? resolveSubscribersCollectionId\(siteData\)/, 'EmailPopup, Studio override first');
  // The popup's error line goes through popupErrorText (no list: sign ups
  // are not open; a list: the owner's bad-address line).
  assert.match(popup, /errorText=\{popupErrorText\(\{ collectionId, ownerErrorText: copy\.errorText \}\)\}/, 'EmailPopup honest copy');
  assert.match(footer, /withSignupUnavailableCopy\(\s*siteData\?\.footerNewsletter,\s*resolveSubscribersCollectionId\(siteData\)/, 'footer newsletter');
  // The old inline chain read ONLY the subscribers page; it must not survive.
  assert.doesNotMatch(providers, /p\.format === 'subscribers'/);
});
