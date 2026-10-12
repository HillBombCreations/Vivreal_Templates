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
import { denyConsent, grantConsent, resetConsentApplied } from '../../lib/consent.ts';
import { resolveVendorScripts } from '../../lib/vendorTags.ts';

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
