import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { consentWithoutPolicyLink, popupConsentProps } from './popupConsent.ts';

/**
 * The popup's consent line must never link to a policy the site does not
 * store (owner decision 2026-10-14). The renderer's SubscribeDialog draws a
 * "Privacy Policy" link to `privacyHref ?? '/privacy'` whenever `consentText`
 * is absent, so "no policy" has to be expressed as a consentText.
 */

const RENDERER_DIALOG = new URL(
  '../../../../node_modules/@hillbombcreations/site-renderer/dist/chrome/SubscribeDialog.js',
  import.meta.url,
);

test('ALLOW: a real policy page is linked, through the dialog default line', () => {
  assert.deepEqual(popupConsentProps({ privacyHref: '/privacy-policy', consentText: undefined, siteName: 'Acme' }), {
    privacyHref: '/privacy-policy',
  });
});

test('REFUSE: no policy page means no link, the default sentence minus its last one', () => {
  const props = popupConsentProps({ privacyHref: undefined, consentText: undefined, siteName: 'Acme' });
  assert.deepEqual(props, {
    consentText: 'By subscribing, you agree to receive updates from Acme. You can unsubscribe anytime.',
  });
  assert.ok(!('privacyHref' in props), 'no href, so the dialog default /privacy is never reached');
  assert.doesNotMatch(props.consentText ?? '', /privacy/i);
});

test('an owner-authored consent line wins verbatim, with or without a policy', () => {
  for (const privacyHref of [undefined, '/privacy']) {
    assert.deepEqual(popupConsentProps({ privacyHref, consentText: 'Owner words.', siteName: 'Acme' }), {
      consentText: 'Owner words.',
    });
  }
  // Empty is authored too: the dialog's own `??` renders it as-is.
  assert.deepEqual(popupConsentProps({ privacyHref: undefined, consentText: '', siteName: 'Acme' }), { consentText: '' });
});

test('the no-policy sentence is the renderer default, word for word, and dash free', () => {
  // Pinned against the installed renderer so a renderer copy change shows up
  // here rather than as two different consent lines on the fleet.
  const dialog = fs.readFileSync(RENDERER_DIALOG, 'utf8');
  assert.ok(
    dialog.includes('"By subscribing, you agree to receive updates from ", siteName, ". You can unsubscribe anytime. See our"'),
    'the renderer default line changed; update consentWithoutPolicyLink to match',
  );
  assert.equal(
    consentWithoutPolicyLink('X'),
    'By subscribing, you agree to receive updates from X. You can unsubscribe anytime.',
  );
  assert.doesNotMatch(consentWithoutPolicyLink('X'), /[–—]/);
});

test('the popup and the layout reach these helpers', () => {
  const popup = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.match(popup, /\{\.\.\.popupConsentProps\(\{ privacyHref, consentText: copy\.consentText, siteName \}\)\}/);
  assert.doesNotMatch(popup, /consentText=\{copy\.consentText\}/, 'a bare pass-through would bring back the /privacy default link');
  const layout = fs.readFileSync(new URL('../../../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /resolvePrivacyPolicyHref\(siteData\.pageConfigs, await getSeedOnlyPaths\(\)\)/);
  assert.match(layout, /privacyHref=\{privacyHref\}/);
});
