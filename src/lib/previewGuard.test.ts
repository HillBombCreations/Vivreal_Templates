/**
 * Owner ideas 2026-10-29, T12 (plan 3.8, D48): a preview never gets the public
 * edge copy. The edge half is release-walk check C-ISR3 (a local server has no
 * edge); this pins the three layers the app owns.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  PREVIEW_BACKSTOP_SCRIPT,
  PREVIEW_MARKER_COOKIE,
  isPreviewNonce,
  newPreviewNonce,
  previewLinkTarget,
  withPreviewNonce,
} from './previewGuard.ts';
import { PREVIEW_QUERY_PARAM, resolvePreviewRedirectTarget } from './api/previewToken.ts';

test('ALLOW: enable lands on its target with a nonce, other query and hash kept', () => {
  assert.equal(withPreviewNonce('/about', 'abc12345'), '/about?vr_pv=abc12345');
  assert.equal(withPreviewNonce('/menu?view=month#top', 'abc12345'), '/menu?view=month&vr_pv=abc12345#top');
  assert.equal(withPreviewNonce('/about?vr_pv=old00000&vr_pv_r=1', 'abc12345'), '/about?vr_pv=abc12345', 'replaced, reload marker dropped');
  const nonce = newPreviewNonce();
  assert.ok(isPreviewNonce(nonce) && nonce !== newPreviewNonce());
});

test('REFUSE: the preview param itself is never re-emitted (the middleware loop guard), nor an off-site target', () => {
  const target = resolvePreviewRedirectTarget(`/about?${PREVIEW_QUERY_PARAM}=tok&x=1`);
  const location = withPreviewNonce(target, 'abc12345');
  assert.ok(!location.includes(PREVIEW_QUERY_PARAM), location);
  assert.equal(withPreviewNonce(resolvePreviewRedirectTarget('//evil.example/x'), 'abc12345'), '/?vr_pv=abc12345');
  assert.equal(withPreviewNonce('https://evil.example/x', 'abc12345'), '/?vr_pv=abc12345');
});

test('ALLOW: an internal link in draft mode carries the nonce', () => {
  assert.equal(previewLinkTarget('/menu', 'https://shop.example/about?vr_pv=abc12345', 'abc12345'), 'https://shop.example/menu?vr_pv=abc12345');
  assert.equal(previewLinkTarget('blog/first?x=1', 'https://shop.example/', 'abc12345'), 'https://shop.example/blog/first?x=1&vr_pv=abc12345');
});

test('REFUSE: another site, an API call, a mailto, a same-page hash or an already-nonced link is left alone', () => {
  const here = 'https://shop.example/about?vr_pv=abc12345';
  for (const href of ['https://other.example/x', '/api/booking/request', 'mailto:a@b.co', '#team', '/about?vr_pv=abc12345#x', '/menu?vr_pv=abc12345']) {
    assert.equal(previewLinkTarget(href, here, 'abc12345'), null, href);
  }
});

function runBackstop({ cookie, meta, href }: { cookie: string; meta: boolean; href: string }) {
  const replaced: string[] = [];
  const doc = {
    cookie,
    querySelector: (sel: string) => (meta && sel === 'meta[name="vr-draft"]' ? {} : null),
  };
  vm.runInNewContext(PREVIEW_BACKSTOP_SCRIPT, {
    document: doc,
    URL,
    Math,
    window: { location: { href, replace: (u: string) => replaced.push(u) } },
  });
  return { replaced, cookie: doc.cookie };
}

test('REFUSE: no marker cookie, the backstop does nothing (every ordinary visitor)', () => {
  assert.deepEqual(runBackstop({ cookie: 'a=1', meta: false, href: 'https://s.example/about' }).replaced, []);
});

test('ALLOW: marker set and a public copy (no draft meta) reloads once with a fresh nonce', () => {
  const out = runBackstop({ cookie: `x=1; ${PREVIEW_MARKER_COOKIE}=1`, meta: false, href: 'https://s.example/about' });
  assert.equal(out.replaced.length, 1);
  const url = new URL(out.replaced[0]);
  assert.ok(isPreviewNonce(url.searchParams.get('vr_pv')));
  assert.equal(url.searchParams.get('vr_pv_r'), '1');
});

test('REFUSE: a draft render, or a second miss, never reloads (no loop); the second miss drops the marker', () => {
  assert.deepEqual(runBackstop({ cookie: `${PREVIEW_MARKER_COOKIE}=1`, meta: true, href: 'https://s.example/about' }).replaced, []);
  const again = runBackstop({ cookie: `${PREVIEW_MARKER_COOKIE}=1`, meta: false, href: 'https://s.example/about?vr_pv=x1r&vr_pv_r=1' });
  assert.deepEqual(again.replaced, []);
  assert.match(again.cookie, /vr_pv_on=; Path=\/; Max-Age=0/);
});

test('the routes and the layout reach the guard', () => {
  const enable = fs.readFileSync(new URL('../app/api/preview/enable/route.ts', import.meta.url), 'utf8');
  const wellFormed = enable.indexOf('if (isWellFormedPreviewToken(rawToken)) {');
  assert.ok(enable.indexOf('location = withPreviewNonce(target, newPreviewNonce());') > wellFormed, 'only a real preview gets a nonce');
  assert.ok(enable.indexOf('name: PREVIEW_MARKER_COOKIE,') > wellFormed);
  assert.match(enable, /Location: location,/);
  const disable = fs.readFileSync(new URL('../app/api/preview/disable/route.ts', import.meta.url), 'utf8');
  assert.match(disable, /\(await draftMode\(\)\)\.disable\(\);/);
  assert.match(disable, /jar\.delete\(PREVIEW_TOKEN_COOKIE\);\s*jar\.delete\(PREVIEW_MARKER_COOKIE\);/);
  assert.match(disable, /resolvePreviewRedirectTarget\(/, 'same-origin targets only');
  const layout = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /\{isDraft && <meta name=\{DRAFT_META_NAME\} content="1" \/>\}/);
  assert.match(layout, /<script dangerouslySetInnerHTML=\{\{ __html: PREVIEW_BACKSTOP_SCRIPT \}\} \/>/);
  assert.match(layout, /\{isDraft && <PreviewLinkNonce \/>\}/);
});
