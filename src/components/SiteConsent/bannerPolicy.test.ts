import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bannerPolicySentence } from './bannerPolicy.ts';
import { resolvePrivacyPolicyHref } from '../../lib/pages/policyPage.ts';
import type { PageConfig } from '@/types/SiteData';

/**
 * Walk 2026-10-21, D4: the vivreal.io cookie banner linked "Privacy Policy" to
 * a hard-coded `/privacy`, which 404s on help.vivreal.io. The banner now links
 * the page the layout resolves, and drops the sentence when there is none.
 *
 * Rendered for real with react-dom/server; `'a'` stands in for `next/link`,
 * which does not load under `node --test` (see ./bannerPolicy.ts).
 */

/** The banner paragraph's closing, rendered inside a <p> so an empty result is visible. */
function renderClosing(privacyHref: string | undefined): string {
  return renderToStaticMarkup(createElement('p', null, bannerPolicySentence(privacyHref, 'a')));
}

const page = (slug: string): PageConfig => ({ name: slug, slug, format: 'static', collectionId: null, labels: {} });

test('ALLOW: a stored policy page is linked at its real path', () => {
  assert.equal(
    renderClosing('/privacy-policy'),
    '<p> See our <a href="/privacy-policy" class="underline" style="color:var(--primary, inherit)">Privacy Policy</a>.</p>',
  );
});

test('REFUSE: no policy page renders no link and no "See our Privacy Policy" sentence', () => {
  for (const href of [undefined, '']) {
    const html = renderClosing(href);
    assert.equal(html, '<p></p>', JSON.stringify(href));
    assert.doesNotMatch(html, /href|privacy/i);
  }
});

test('REFUSE: a help-shaped site (articles, no privacy page) gets no banner link; ALLOW: a site storing /privacy gets that one', () => {
  const help = [page('getting-started'), page('terms'), page('your-website')];
  assert.equal(renderClosing(resolvePrivacyPolicyHref(help, [])), '<p></p>');
  const marketing = [page('pricing'), page('privacy')];
  assert.match(renderClosing(resolvePrivacyPolicyHref(marketing, [])), /<a href="\/privacy" /);
});

test('the layout hands the resolved href to the banner, and the banner has no hard-coded /privacy', () => {
  const layout = fs.readFileSync(new URL('../../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<SiteConsent\b[^>]*?privacyHref=\{privacyHref\}[^>]*?\/>/);
  const banner = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.ok(banner.includes('{bannerPolicySentence(privacyHref, Link)}'), 'the banner renders the helper');
  assert.doesNotMatch(banner, /href="\/privacy"/);
});
