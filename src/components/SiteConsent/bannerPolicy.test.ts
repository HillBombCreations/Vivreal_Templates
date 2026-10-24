import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bannerPolicySentence, resolveBannerPrivacyHref } from './bannerPolicy.ts';
import { resolvePrivacyPolicyHref } from '../../lib/pages/policyPage.ts';
import { isVivrealOwnSite, VIVREAL_HELP_SITE_ID, VIVREAL_MARKETING_SITE_ID } from '../../lib/vivrealApex.ts';
import type { PageConfig } from '@/types/SiteData';

/**
 * Walk 2026-10-21, D4: the vivreal.io cookie banner linked "Privacy Policy" to
 * a hard-coded `/privacy`, which 404s on help.vivreal.io. The banner now links
 * the page the layout resolves; on Vivreal's own sites with no stored page
 * (help) it links the vivreal.io policy that covers them, which is what help's
 * own footer already links. Review of 20f26ce.
 *
 * Rendered for real with react-dom/server; `'a'` stands in for `next/link`,
 * which does not load under `node --test` (see ./bannerPolicy.ts).
 */

/** The banner paragraph's closing, rendered inside a <p> so an empty result is visible. */
function renderClosing(privacyHref: string | undefined): string {
  return renderToStaticMarkup(createElement('p', null, bannerPolicySentence(privacyHref, 'a')));
}

/**
 * The banner's closing exactly as the root layout produces it for a site:
 * stored pages -> `resolvePrivacyPolicyHref` -> `resolveBannerPrivacyHref` with
 * `isVivrealOwnSite(SITE_ID)` -> the rendered sentence.
 */
function renderSiteClosing(siteId: string | undefined, pages: PageConfig[]): string {
  const privacyHref = resolvePrivacyPolicyHref(pages, []);
  return renderClosing(resolveBannerPrivacyHref(privacyHref, isVivrealOwnSite(siteId)));
}

const page = (slug: string): PageConfig => ({ name: slug, slug, format: 'static', collectionId: null, labels: {} });

const LINK_STYLE = 'class="underline" style="color:var(--primary, inherit)"';
const HELP_PAGES = [page('getting-started'), page('terms'), page('your-website')];
const MARKETING_PAGES = [page('pricing'), page('privacy')];
const CUSTOMER_SITE_IDS = ['0123456789abcdef01234567', `${VIVREAL_HELP_SITE_ID}x`, undefined, ''];

test('ALLOW: a stored policy page is linked at its real path', () => {
  assert.equal(
    renderClosing('/privacy-policy'),
    `<p> See our <a href="/privacy-policy" ${LINK_STYLE}>Privacy Policy</a>.</p>`,
  );
});

test('REFUSE: no policy page renders no link and no "See our Privacy Policy" sentence', () => {
  for (const href of [undefined, '']) {
    const html = renderClosing(href);
    assert.equal(html, '<p></p>', JSON.stringify(href));
    assert.doesNotMatch(html, /href|privacy/i);
  }
});

test('ALLOW: help.vivreal.io, which stores no policy page, links the vivreal.io policy in its banner', () => {
  assert.equal(resolvePrivacyPolicyHref(HELP_PAGES, []), undefined, 'control: help stores no policy page');
  assert.equal(
    renderSiteClosing(VIVREAL_HELP_SITE_ID, HELP_PAGES),
    `<p> See our <a href="https://vivreal.io/privacy" ${LINK_STYLE}>Privacy Policy</a>.</p>`,
  );
});

test('ALLOW: vivreal.io keeps linking its own stored /privacy, not the absolute fallback', () => {
  assert.equal(
    renderSiteClosing(VIVREAL_MARKETING_SITE_ID, MARKETING_PAGES),
    `<p> See our <a href="/privacy" ${LINK_STYLE}>Privacy Policy</a>.</p>`,
  );
});

test('REFUSE: a customer site with no policy page gets no link, never the vivreal.io policy', () => {
  for (const siteId of CUSTOMER_SITE_IDS) {
    assert.equal(isVivrealOwnSite(siteId), false, `control: ${JSON.stringify(siteId)} is not a Vivreal site`);
    const html = renderSiteClosing(siteId, HELP_PAGES);
    assert.equal(html, '<p></p>', JSON.stringify(siteId));
    assert.doesNotMatch(html, /vivreal\.io|href/, JSON.stringify(siteId));
  }
});

test('REFUSE: a customer site that stores a policy page keeps its own path, unchanged', () => {
  for (const siteId of CUSTOMER_SITE_IDS) {
    assert.equal(resolveBannerPrivacyHref('/privacy-policy', isVivrealOwnSite(siteId)), '/privacy-policy');
  }
});

test('the layout gives the banner the resolved fallback and the email popup the stored page only', () => {
  const layout = fs.readFileSync(new URL('../../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(
    layout,
    /<SiteConsent\b[^>]*?privacyHref=\{resolveBannerPrivacyHref\(privacyHref, vivrealOwnSite\)\}[^>]*?\/>/,
  );
  assert.equal((layout.match(/resolveBannerPrivacyHref\(/g) ?? []).length, 1, 'the banner is the only consumer');
  assert.equal((layout.match(/privacyHref=\{privacyHref\}/g) ?? []).length, 1, 'control: the email popup still gets the stored page');
  const banner = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.ok(banner.includes('{bannerPolicySentence(privacyHref, Link)}'), 'the banner renders the helper');
  assert.doesNotMatch(banner, /href="\/privacy"/);
});
