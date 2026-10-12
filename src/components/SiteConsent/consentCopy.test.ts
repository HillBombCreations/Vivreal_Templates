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
import { denyConsent, grantConsent, resetConsentApplied, runConsentMount, withdrawConsent } from '../../lib/consent.ts';
import { CLARITY_MASK_SNIPPET, resolveVendorScripts } from '../../lib/vendorTags.ts';
import { resolveConsentGaScripts } from '../../lib/gaConsentLoad.ts';

const BANNER_TEXT =
  'We use cookies to see how people use this site and to make it better. If you accept, we turn on Google Analytics, ' +
  'which counts visits, and Microsoft Clarity, which shows us how people move around a page, with anything you type hidden. ' +
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

test('the banner text is the owner-approved sentence, exactly', () => {
  assert.equal(bannerParagraphText(), BANNER_TEXT);
});

test('the Privacy Policy link and the Cookie settings control are still there', () => {
  assert.match(source, /<Link\s+href="\/privacy"[\s\S]*?>\s*Privacy Policy\s*<\/Link>/);
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
  assert.deepEqual(granted, [['consent', 'update', { analytics_storage: 'granted' }]], 'Google Analytics is upgraded to granted');
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
  assert.deepEqual(dom.gtagCalls().filter((c) => c[1] === 'update'), [['consent', 'update', { analytics_storage: 'granted' }]]);
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
