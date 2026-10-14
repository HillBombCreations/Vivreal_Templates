import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PageConfig } from '@/types/SiteData';
import { resolvePrivacyPolicyHref } from './policyPage.ts';

/**
 * The email popup links its consent line to the href this returns, and to no
 * policy at all when it returns `undefined` (owner decision 2026-10-14, no
 * invented legal text: `/privacy` 404s on a site that stores no page there).
 * So every page this returns must be one `[slug]/page.tsx` actually serves.
 */

const page = (slug: string, format = 'standard', extra: Partial<PageConfig> = {}): PageConfig => ({
  name: slug,
  slug,
  format,
  collectionId: null,
  labels: {},
  ...extra,
});

test('ALLOW: a stored privacy page is linked, whatever its format', () => {
  for (const format of ['static', 'about', 'standard']) {
    assert.equal(resolvePrivacyPolicyHref([page('about'), page('privacy', format)], []), '/privacy', format);
  }
});

test('ALLOW: a slug that starts with privacy is linked at its own path', () => {
  assert.equal(resolvePrivacyPolicyHref([page('privacy-policy')], []), '/privacy-policy');
});

test('REFUSE: no stored policy page links nothing', () => {
  assert.equal(resolvePrivacyPolicyHref([], []), undefined);
  assert.equal(resolvePrivacyPolicyHref(undefined, []), undefined);
  assert.equal(resolvePrivacyPolicyHref([page('about'), page('terms'), page('our-privacy')], []), undefined);
});

test('REFUSE: a policy page the owner turned off is not linked (the route 404s it)', () => {
  assert.equal(resolvePrivacyPolicyHref([page('privacy', 'static', { enabled: false })], []), undefined);
});

test('REFUSE: a seed-only policy page is not linked (the route 404s it)', () => {
  assert.equal(resolvePrivacyPolicyHref([page('privacy-policy')], ['/privacy-policy']), undefined);
});

test('REFUSE: a nested privacy slug is not the site policy page', () => {
  assert.equal(resolvePrivacyPolicyHref([page('privacy/cookies')], []), undefined);
});

test('the first servable policy page wins, past an off one', () => {
  const pages = [page('privacy', 'static', { enabled: false }), page('privacy-policy')];
  assert.equal(resolvePrivacyPolicyHref(pages, []), '/privacy-policy');
});

test('a malformed config entry cannot crash the layout', () => {
  // siteData comes off the wire; `pageConfigs` has been observed carrying holes.
  const ragged = [undefined, null, {}, page('privacy')] as unknown as PageConfig[];
  assert.equal(resolvePrivacyPolicyHref(ragged, []), '/privacy');
});
