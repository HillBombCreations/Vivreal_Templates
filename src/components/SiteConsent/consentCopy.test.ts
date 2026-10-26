/**
 * The vivreal.io cookie banner says exactly what Accept turns on (owner
 * decision, 2026-10-12): Google Analytics and Microsoft Clarity, and no
 * visitor-identification service (RB2B was dropped on 2026-08-20).
 *
 * `index.tsx` is JSX and cannot load under this repo's `node --test`, so the
 * copy is pinned by reading the source, and the behaviour it describes is
 * pinned through the React-free controller it renders (`lib/consent.ts`).
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installDom, type DomHarness } from '../../lib/__testing__/domHarness.ts';
import { COOKIE_CONSENT_KEY, denyConsent, grantConsent, resetConsentApplied, runConsentMount, withdrawConsent } from '../../lib/consent.ts';
import { mergeAttributionCustomFields } from '../../lib/leadAttribution.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { isVivrealOwnSite, VIVREAL_HELP_SITE_ID, VIVREAL_MARKETING_SITE_ID } from '../../lib/vivrealApex.ts';
import { resolvePrivacyPolicyHref } from '../../lib/pages/policyPage.ts';
import { bannerPolicySentence, resolveBannerPrivacyHref } from './bannerPolicy.ts';
import { CLARITY_MASK_SNIPPET, resolveVendorScripts } from '../../lib/vendorTags.ts';
import { resolveConsentGaScripts } from '../../lib/gaConsentLoad.ts';
import { runAttributionCapture } from '../../lib/attributionCapture.ts';
import { getAttribution } from '../../lib/attribution.ts';

const BANNER_TEXT =
  'We use cookies to see how people use this site and to make it better. If you accept, we turn on Google Analytics, ' +
  'which counts visits, and Microsoft Clarity, which shows us how people move around a page, with anything you type hidden. ' +
  'Accepting also lets Google measure whether a visit that began with one of our ads led to a signup, so we can see which ' +
  'ads are worth running. It does not build a personalized ad profile of you. ' +
  'Reject, and neither runs. You can change your mind any time under Cookie settings at the bottom of the page. ' +
  'See our Privacy Policy.';

const source = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');

/** The banner paragraph's visible text: tags and `{' '}` removed, whitespace collapsed. */
function bannerParagraphText(): string {
  const open = source.indexOf('<p className="text-sm"');
  const close = source.indexOf('</p>', open);
  assert.ok(open > 0 && close > open, 'found the banner paragraph');
  return source
    .slice(source.indexOf('>', open) + 1, close)
    .replace(/\{' '\}/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
}

// The paragraph ends in `{bannerPolicySentence(privacyHref, Link)}`, and the
// layout passes `resolveBannerPrivacyHref(privacyHref, vivrealOwnSite)`
// (./bannerPolicy.ts). The banner renders only on Vivreal's own two sites, so
// the closing is rendered for real for each of them, as the layout resolves it.
const POLICY_CALL = '{bannerPolicySentence(privacyHref, Link)}';

/** What each Vivreal site stores (read-only check 2026-10-21, PR #202) and the link its banner must carry. */
const OWN_SITES = [
  { site: 'vivreal.io', siteId: VIVREAL_MARKETING_SITE_ID, pages: ['pricing', 'privacy'], href: '/privacy' },
  { site: 'help.vivreal.io', siteId: VIVREAL_HELP_SITE_ID, pages: ['getting-started', 'terms'], href: 'https://vivreal.io/privacy' },
];

function renderOwnSiteClosing(siteId: string, slugs: string[]): string {
  const pages = slugs.map((slug) => ({ name: slug, slug, format: 'static', collectionId: null, labels: {} }));
  const href = resolveBannerPrivacyHref(resolvePrivacyPolicyHref(pages, []), isVivrealOwnSite(siteId));
  return renderToStaticMarkup(createElement('p', null, bannerPolicySentence(href, 'a')));
}

test('the banner text is the owner-approved sentence, exactly, on both Vivreal sites', () => {
  const text = bannerParagraphText();
  assert.ok(text.endsWith(POLICY_CALL), 'the policy sentence closes the paragraph');
  const base = text.slice(0, -POLICY_CALL.length).trim();
  for (const { site, siteId, pages } of OWN_SITES) {
    const closing = renderOwnSiteClosing(siteId, pages).replace(/<[^>]*>/g, '');
    assert.equal(`${base}${closing}`, BANNER_TEXT, site);
  }
});

test('the Privacy Policy link points at the real policy on each Vivreal site, and Cookie settings is still there', () => {
  for (const { site, siteId, pages, href } of OWN_SITES) {
    assert.match(
      renderOwnSiteClosing(siteId, pages),
      new RegExp(`<a href="${href.replace(/[.]/g, '[.]')}"[^>]*>Privacy Policy</a>`),
      site,
    );
  }
  assert.ok(source.includes(POLICY_CALL));
  assert.match(source, /onClick=\{onWithdraw\}[\s\S]*?>\s*Cookie settings\s*<\/button>/);
});

test('no identification-service wording or code remains in the banner', () => {
  for (const needle of [/rb2b/i, /identification/i, /who you are/i, /employer/i]) assert.doesNotMatch(source, needle);
});

let dom: DomHarness;
beforeEach(() => {
  dom = installDom({ hostname: 'vivreal.io' });
  resetConsentApplied();
});
afterEach(() => dom.restore());

/** Every config shape a site document could carry: the kept vendor, the dropped one, and unknowns. */
const CONFIG = [
  { provider: 'clarity', id: 'fakeclarity0' },
  { provider: 'rb2b', id: 'FAKE00000000' },
  { provider: 'reb2b', id: 'FAKE00000000' },
  { provider: 'clearbit', id: 'abc123' },
];

test('REFUSE: Accept loads Clarity and grants Google Analytics, and loads no identification script', () => {
  grantConsent(true, resolveVendorScripts(CONFIG));
  const scripts = dom.scripts();
  assert.deepEqual(scripts.map((s) => s.id).filter(Boolean), ['vr-vendor-clarity'], 'Clarity is the only injected script');
  const bodies = scripts.map((s) => s.innerHTML).join(' ').toLowerCase();
  assert.ok(bodies.includes('clarity.ms/tag/'), 'control: the search reads the injected script bodies');
  for (const needle of ['rb2b', 'reb2b', 'b2bjsstore', 'clearbit']) assert.equal(bodies.includes(needle), false, needle);
  const granted = dom.gtagCalls().filter((c) => c[0] === 'consent' && c[1] === 'update');
  assert.deepEqual(
    granted,
    [['consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted' }]],
    'Google Analytics and the ad-measurement signals are upgraded to granted',
  );
});

test('REFUSE: Reject injects nothing and grants nothing', () => {
  denyConsent(true);
  assert.deepEqual(dom.scripts().map((s) => s.id).filter(Boolean), []);
  assert.equal(dom.gtagCalls().filter((c) => c[0] === 'consent' && c[1] === 'update').length, 0);
});

/* ── Google Analytics loads only after an accept (owner decision, 2026-10-12) ── */

const GA = resolveConsentGaScripts({ provider: 'google_analytics', trackingId: 'G-TEST1234' });
const VENDORS = resolveVendorScripts([{ provider: 'clarity', id: 'fakeclarity0' }]);

/** Every GA request the page would make: a script whose src is gtag.js, or the GA init. */
function gaScripts(): string[] {
  return dom
    .scripts()
    .filter((s) => /googletagmanager\.com/.test(s.src) || s.id.startsWith('vr-ga-') || /gtag\(/.test(s.innerHTML))
    .map((s) => s.id);
}

/** A new page view: fresh DOM, stored choice carried, per-page guard reset. */
function nextPage(): void {
  const carried = new Map(dom.storage);
  dom.restore();
  dom = installDom({ hostname: 'vivreal.io' });
  for (const [k, v] of carried) dom.storage.set(k, v);
  resetConsentApplied();
}

test('the GA scripts resolve from a valid GA4 id only', () => {
  assert.deepEqual(GA.map((s) => s.domId), ['vr-ga-gtag', 'vr-ga-init']);
  assert.equal(GA[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST1234');
  assert.match(GA[1].innerHTML, /gtag\('consent','default',\{ad_storage:'denied',analytics_storage:'denied'\}\);.*gtag\('config','G-TEST1234'/);
  for (const bad of [null, {}, { provider: 'plausible', trackingId: 'G-TEST1234' }, { provider: 'google_analytics', trackingId: "G-1');alert(1);//" }]) {
    assert.deepEqual(resolveConsentGaScripts(bad), [], JSON.stringify(bad));
  }
});

test('REFUSE: no GA request before a choice', () => {
  runConsentMount(true, VENDORS, GA);
  assert.deepEqual(gaScripts(), []);
  assert.deepEqual(dom.scripts().map((s) => s.id).filter(Boolean), [], 'and no Clarity');
});

test('REFUSE: no GA request after a reject, on that page or the next', () => {
  runConsentMount(true, VENDORS, GA);
  denyConsent(true);
  assert.deepEqual(gaScripts(), []);
  nextPage();
  runConsentMount(true, VENDORS, GA);
  assert.deepEqual(gaScripts(), []);
});

test('ALLOW: GA loads after an accept, then is granted; a stored accept loads it on the next page', () => {
  runConsentMount(true, VENDORS, GA);
  grantConsent(true, VENDORS, GA);
  assert.deepEqual(gaScripts(), ['vr-ga-gtag', 'vr-ga-init']);
  const order = dom.scripts().map((s) => s.id);
  assert.ok(order.indexOf('vr-ga-init') < order.indexOf('vr-vendor-clarity'), 'GA is injected before the grant and the vendors');
  assert.deepEqual(dom.gtagCalls().filter((c) => c[1] === 'update'), [
    ['consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted' }],
  ]);
  nextPage();
  runConsentMount(true, VENDORS, GA);
  assert.deepEqual(gaScripts(), ['vr-ga-gtag', 'vr-ga-init'], 'restored without the banner');
});

test('REFUSE: after a withdrawal under Cookie settings, the next page view loads no GA', () => {
  grantConsent(true, VENDORS, GA);
  withdrawConsent(true, () => {});
  nextPage();
  runConsentMount(true, VENDORS, GA);
  assert.deepEqual(gaScripts(), []);
});

test('REFUSE: GA never loads on a customer site through the controller', () => {
  grantConsent(false, VENDORS, GA);
  runConsentMount(false, VENDORS, GA);
  assert.deepEqual(gaScripts(), []);
});

/* ── The banner renders nothing on a customer site (review of 20f26ce, a gap since G13) ── */

/**
 * index.tsx renders `null` unless `state.gated`, and its state only ever comes
 * from INERT or from these four controller calls with the layout's
 * `vivrealOwnSite`. The component cannot load under this runner (JSX, and the
 * repo has no DOM renderer), so the source is pinned to that shape and the
 * controller is driven through every state a customer visitor can reach.
 */
test('REFUSE: the banner and Cookie settings render nothing on a customer site, whatever the visitor stored', () => {
  const customer = isVivrealOwnSite('0123456789abcdef01234567');
  assert.equal(customer, false, 'control: a customer site id');
  const nothing = { gated: false, showBanner: false, showWithdraw: false };
  const shown = (s: { gated: boolean; showBanner: boolean; showWithdraw: boolean }) =>
    ({ gated: s.gated, showBanner: s.showBanner, showWithdraw: s.showWithdraw });
  for (const stored of [null, 'accepted', 'rejected']) {
    for (const gpc of [false, true]) {
      const label = `stored=${stored} gpc=${gpc}`;
      nextPage();
      dom.storage.delete(COOKIE_CONSENT_KEY);
      if (stored) dom.storage.set(COOKIE_CONSENT_KEY, stored);
      dom.setGpc(gpc);
      assert.deepEqual(shown(runConsentMount(customer, VENDORS, GA)), nothing, `mount ${label}`);
      assert.deepEqual(shown(grantConsent(customer, VENDORS, GA)), nothing, `accept ${label}`);
      assert.deepEqual(shown(denyConsent(customer)), nothing, `reject ${label}`);
      assert.deepEqual(shown(withdrawConsent(customer, () => {})), nothing, `withdraw ${label}`);
      assert.deepEqual(dom.scripts().map((s) => s.id).filter(Boolean), [], `nothing injected ${label}`);
    }
  }
  nextPage();
  dom.storage.delete(COOKIE_CONSENT_KEY);
  assert.equal(runConsentMount(true, VENDORS, GA).showBanner, true, 'control: the same mount shows the banner on a Vivreal site');
});

test('the component renders null before anything else unless gated, and takes its state only from the controller', () => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /const INERT: ConsentState = \{\s*gated: false,/);
  assert.ok(code.includes('useState<ConsentState>(INERT)'));
  const gate = code.indexOf('if (!state.gated) return null;');
  const firstJsx = code.indexOf('return (');
  assert.ok(gate > 0 && firstJsx > gate, 'the gate comes before any rendered markup');
  const setters = code.match(/setState\([^;]*/g) ?? [];
  assert.deepEqual(setters.map((s) => s.match(/^setState\((\w+)\(vivrealOwnSite\b/)?.[1]), [
    'runConsentMount',
    'grantConsent',
    'denyConsent',
    'withdrawConsent',
  ]);
});

test('the layout renders no head GA tag on the Vivreal site, and hands GA to the consent controller', () => {
  const layout = fs.readFileSync(new URL('../../app/layout.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes('{!vivrealOwnSite && <SiteAnalytics analytics={siteData.analytics} />}'));
  assert.equal((layout.match(/<SiteAnalytics\b/g) ?? []).length, 1, 'no other mount');
  assert.ok(/<SiteConsent[\s\S]*?analytics=\{siteData\.analytics\}/.test(layout));
  const consent = fs.readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');
  assert.ok(consent.includes('runConsentMount(vivrealOwnSite, vendors, ga)') && consent.includes('grantConsent(vivrealOwnSite, vendors, ga)'));
});

/* ── Clarity masks everything a visitor types ── */

interface MaskNode {
  nodeType: number;
  tag: string;
  attrs: Map<string, string>;
  children: MaskNode[];
  matches(sel: string): boolean;
  querySelectorAll(sel: string): MaskNode[];
  setAttribute(k: string, v: string): void;
}
const CONTROLS = new Set(['input', 'textarea', 'select']);
function node(tag: string, children: MaskNode[] = [], editable = false): MaskNode {
  const n: MaskNode = {
    nodeType: 1,
    tag,
    attrs: new Map(editable ? [['contenteditable', 'true']] : []),
    children,
    matches: () => CONTROLS.has(n.tag) || n.attrs.has('contenteditable'),
    querySelectorAll: () => {
      const out: MaskNode[] = [];
      const walk = (c: MaskNode): void => {
        for (const k of c.children) {
          if (k.matches('')) out.push(k);
          walk(k);
        }
      };
      walk(n);
      return out;
    },
    setAttribute: (k, v) => void n.attrs.set(k, v),
  };
  return n;
}

test('ALLOW: every input, textarea, select and contenteditable carries data-clarity-mask, including ones added later', () => {
  const fields = [node('input'), node('textarea'), node('select'), node('div', [], true)];
  const plain = node('p');
  const root = node('html', [node('body', [node('form', fields), plain])]);
  let observed: ((records: Array<{ addedNodes: MaskNode[] }>) => void) | undefined;
  class FakeObserver {
    constructor(cb: (records: Array<{ addedNodes: MaskNode[] }>) => void) {
      observed = cb;
    }
    observe(): void {}
  }
  new Function('document', 'MutationObserver', CLARITY_MASK_SNIPPET)({ documentElement: root }, FakeObserver);
  for (const f of fields) assert.equal(f.attrs.get('data-clarity-mask'), 'True', f.tag);
  assert.equal(plain.attrs.has('data-clarity-mask'), false, 'ordinary text is not masked');
  const later = node('input');
  const dialog = node('div', [node('textarea')]);
  assert.ok(observed, 'the masker watches for fields added later');
  observed([{ addedNodes: [later, dialog] }]);
  assert.equal(later.attrs.get('data-clarity-mask'), 'True', 'an input added later');
  assert.equal(dialog.children[0].attrs.get('data-clarity-mask'), 'True', 'a field inside a dialog added later');
});

test('the masker runs before the Clarity loader, in the one snippet, and Clarity loads only on accept', () => {
  const clarity = VENDORS[0].innerHTML;
  assert.ok(clarity.startsWith(CLARITY_MASK_SNIPPET), 'mask first');
  assert.ok(clarity.indexOf('clarity.ms/tag/') > CLARITY_MASK_SNIPPET.length);
  runConsentMount(true, VENDORS, GA);
  assert.equal(dom.scripts().some((s) => s.innerHTML.includes('clarity.ms')), false, 'not before a choice');
  grantConsent(true, VENDORS, GA);
  assert.equal(dom.scripts().some((s) => s.innerHTML.includes('clarity.ms')), true, 'after the accept');
});

/* ── vr_attr is set only after an Accept (owner decision, 2026-10-12) ── */

/** One page load as the layout runs it: attribution capture, then the consent mount. */
function loadAttributedPage(path: string): void {
  dom.setUrl(path);
  const stored = dom.storage.get(COOKIE_CONSENT_KEY) ?? null;
  runAttributionCapture({ vivrealOwnSite: true, consented: stored === 'accepted', consentDenied: stored === 'rejected' });
  runConsentMount(true, VENDORS, GA);
}

test('REFUSE: no vr_attr before a choice, on the landing page or the next one', () => {
  dom.setReferrer('https://www.linkedin.com/feed/');
  loadAttributedPage('/?utm_source=linkedin&utm_campaign=launch');
  assert.equal(dom.cookie('vr_attr'), null);
  nextPage();
  loadAttributedPage('/pricing');
  assert.equal(dom.cookie('vr_attr'), null);
  assert.equal(document.cookie, '', 'no cookie of any kind');
});

test('REFUSE: no vr_attr after Reject, and the held landing page is dropped', () => {
  loadAttributedPage('/?utm_source=linkedin&utm_campaign=launch');
  assert.ok(dom.session.has('vr_attr_pending'), 'control: the landing page was held');
  denyConsent(true);
  assert.equal(dom.cookie('vr_attr'), null);
  assert.equal(dom.session.has('vr_attr_pending'), false, 'dropped');
  nextPage();
  loadAttributedPage('/?utm_source=google');
  assert.equal(dom.cookie('vr_attr'), null, 'a rejected visitor is never written, even with a new campaign');
});

test('ALLOW: vr_attr is set after Accept, carrying the landing source, even when the Accept is on a later page', () => {
  dom.setReferrer('https://www.linkedin.com/feed/');
  loadAttributedPage('/?utm_source=linkedin&utm_campaign=launch');
  const session = new Map(dom.session);
  nextPage();
  for (const [k, v] of session) dom.session.set(k, v); // the same tab
  dom.setReferrer('https://vivreal.io/');
  loadAttributedPage('/pricing');
  grantConsent(true, VENDORS, GA);
  const attr = getAttribution();
  assert.ok(attr, 'written on accept');
  assert.equal(attr.first.utm_source, 'linkedin');
  assert.equal(attr.first.utm_campaign, 'launch');
  assert.equal(attr.first.landing_path, '/');
  assert.equal(attr.first.source, 'linkedin');
  assert.equal(dom.session.has('vr_attr_pending'), false, 'the held page is consumed');
});

test('ALLOW then REFUSE: a later withdrawal deletes vr_attr', () => {
  loadAttributedPage('/?utm_source=linkedin');
  grantConsent(true, VENDORS, GA);
  assert.notEqual(dom.cookie('vr_attr'), null, 'control: it was written');
  withdrawConsent(true, () => {});
  assert.equal(dom.cookie('vr_attr'), null);
  nextPage();
  loadAttributedPage('/?utm_source=google');
  assert.equal(dom.cookie('vr_attr'), null, 'and the next page, undecided again, writes none');
});

/* ── Review of f32b2f9: an old vr_attr does not survive Reject; old consent is not reused ── */

/** A vr_attr exactly as the pre-2026-10-12 code left it (written before any choice). */
function plantLegacyAttribution(): void {
  const legacy = { v: 2, first: { utm_source: 'linkedin', utm_campaign: 'old', source: 'linkedin', landing_path: '/' }, last: { source: 'linkedin' } };
  document.cookie = `vr_attr=${encodeURIComponent(JSON.stringify(legacy))}; Path=/; Max-Age=7776000; SameSite=Lax`;
  assert.notEqual(dom.cookie('vr_attr'), null, 'control: the legacy cookie is planted');
}

test('REFUSE: an existing vr_attr is deleted on Reject, and the lead carries no attribution', () => {
  plantLegacyAttribution();
  loadAttributedPage('/contact');
  denyConsent(true);
  assert.equal(dom.cookie('vr_attr'), null, 'gone');
  assert.equal(dom.cookie('vr_consent'), null, 'no accept mirror');
  const custom = { budget: '10k' };
  assert.equal(mergeAttributionCustomFields(custom, document.cookie, VIVREAL_MARKETING_SITE_ID), custom, 'the lead carries none');
});

test('REFUSE: an existing vr_attr is deleted on every page load where consent is denied', () => {
  denyConsent(true);
  plantLegacyAttribution(); // e.g. written by another vivreal.io property
  nextPage();
  dom.storage.set(COOKIE_CONSENT_KEY, 'rejected');
  document.cookie = `vr_attr=${encodeURIComponent('{"v":2,"first":{},"last":{}}')}; Path=/`;
  loadAttributedPage('/');
  assert.equal(dom.cookie('vr_attr'), null);
});

test('ALLOW: after Accept the lead carries the attribution (the server sees the accept mirror)', () => {
  loadAttributedPage('/?utm_source=linkedin&utm_campaign=launch');
  grantConsent(true, VENDORS, GA);
  assert.equal(dom.cookie('vr_consent'), 'accepted');
  const merged = mergeAttributionCustomFields({ budget: '10k' }, document.cookie, VIVREAL_MARKETING_SITE_ID);
  assert.equal(merged?.utm_campaign, 'launch');
});

test('REFUSE: an accept stored under the old v1 key alone loads neither GA nor Clarity, asks again, and is removed', () => {
  dom.storage.set('cookie_consent_v1', 'accepted');
  const state = runConsentMount(true, VENDORS, GA);
  assert.equal(state.showBanner, true, 'asked again under the current wording');
  assert.deepEqual(dom.scripts().map((s) => s.id).filter(Boolean), [], 'no GA, no Clarity');
  assert.equal(dom.storage.has('cookie_consent_v1'), false, 'the old key is removed');
  assert.equal(dom.cookie('vr_consent'), null);
});
