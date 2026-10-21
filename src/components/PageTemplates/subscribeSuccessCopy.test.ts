/**
 * v7.2, one-step site sign-ups (owner decision, 2026-10-20). A sign-up on a
 * customer site is subscribed the moment it is sent, and no confirmation
 * email goes out (VR_Client_API writes `subscriberStatus: 'subscribed'`).
 * The subscribe page used to say "Almost there" and send the visitor to an
 * inbox that will now never get anything, so the success state has to say
 * they are on the list, matching the renderer default
 * (`SIGNUP_CONFIRM_TEXT`, "You're on the list. Thanks for signing up.").
 *
 * `SubscribeClient.tsx` is JSX and cannot load under this repo's
 * `node --test`, so the copy is pinned by reading the source, the same
 * tradeoff as `SiteConsent/consentCopy.test.ts`. Comments are stripped first
 * so a docblock about the old behaviour cannot satisfy or fail an assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./SubscribeClient.tsx', import.meta.url), 'utf8');

/** The success branch (`status === "success" ? ... : (`), JSX and line comments removed. */
function successBranch(): string {
  const open = source.indexOf('status === "success" ?');
  const close = source.indexOf(') : (', open);
  assert.ok(open > 0 && close > open, 'found the success branch of the subscribe page');
  const branch = source
    .slice(open, close)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert.ok(branch.includes('<h2'), 'the success branch still holds its heading');
  return branch;
}

test('[v7.2 REFUSE] a fresh sign-up is never told to check an inbox or confirm', () => {
  const branch = successBranch();
  assert.doesNotMatch(branch, /inbox/i);
  assert.doesNotMatch(branch, /confirm/i);
  assert.doesNotMatch(branch, /almost there/i);
  assert.doesNotMatch(branch, /we sent you an email/i);
});

test('[v7.2 ALLOW] the success state says the person is on the list', () => {
  const branch = successBranch();
  assert.match(branch, /<h2[^>]*>\s*\{"You're on the list"\}\s*<\/h2>/);
  assert.match(branch, /labels\?\.successMessage \|\|\s*"Thanks for signing up\."/);
});

test('[v7.2 ALLOW] the success copy carries no em or en dash', () => {
  assert.doesNotMatch(successBranch(), /[–—]/);
});
