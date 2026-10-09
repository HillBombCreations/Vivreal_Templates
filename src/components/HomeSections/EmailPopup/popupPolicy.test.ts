import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHONE_MAX_WIDTH,
  PHONE_MEDIA_QUERY,
  classifyPopupPath,
  resolvePopupTrigger,
  type PopupPage,
} from './popupPolicy.ts';

/**
 * O10 and QA-W2-2: the newsletter popup never opens on a checkout page, never
 * covers a shop or product page on a phone, and with no owner choice it waits
 * for a scroll on a phone. A computer keeps today's 3 s timer elsewhere.
 */

const PAGES: PopupPage[] = [
  { slug: 'shop', format: 'products' },
  { slug: 'menu', format: 'catalog', blocks: [{ config: { bindings: [{ integrationProvider: 'square' }] } }] },
  { slug: 'about', format: 'about' },
  { slug: 'blog', format: 'blog' },
  { slug: 'features', format: 'products' },
  { slug: 'features/ai-sites', format: 'about' },
];
const STORED_CHECKOUT: PopupPage[] = [
  ...PAGES,
  { slug: 'checkoutsuccess', format: 'checkout-success' },
  { slug: 'checkoutcancel', format: 'checkout-cancel' },
];

test('the phone width is what a 390 phone matches and a 1440 computer does not', () => {
  assert.ok(390 <= PHONE_MAX_WIDTH);
  assert.ok(1440 > PHONE_MAX_WIDTH);
  assert.equal(PHONE_MEDIA_QUERY, '(max-width: 767px)');
});

test('REFUSE (QA-W2-2): checkout pages never open the popup, stored or built in, at any width', () => {
  // PAGES stores no checkout page, like Cobalt: the built-in slugs still count.
  for (const pages of [PAGES, STORED_CHECKOUT]) {
    for (const path of ['/checkoutcancel', '/checkoutsuccess', '/checkoutcancel/']) {
      const pathKind = classifyPopupPath(pages, path);
      assert.equal(pathKind, 'checkout', path);
      for (const isPhone of [true, false]) {
        for (const ownerMode of [undefined, 'delay', 'scroll', 'exit'] as const) {
          assert.equal(resolvePopupTrigger({ ownerMode, isPhone, pathKind }), null, `${path} ${isPhone} ${ownerMode}`);
        }
      }
    }
  }
});

test('REFUSE: a 390 shop page never opens the popup, whatever the owner chose', () => {
  const pathKind = classifyPopupPath(PAGES, '/shop');
  assert.equal(pathKind, 'shop');
  for (const ownerMode of [undefined, 'delay', 'scroll', 'exit'] as const) {
    assert.equal(resolvePopupTrigger({ ownerMode, isPhone: true, pathKind }), null, String(ownerMode));
  }
});

test('REFUSE: product pages and a page that sells count as shop pages', () => {
  for (const path of ['/shop/blue-mug', '/shop/blue-mug/', '/menu', '/menu/latte']) {
    assert.equal(classifyPopupPath(PAGES, path), 'shop', path);
  }
});

test('ALLOW: home, an ordinary page, a blog post, a nested page and an unknown path are neither', () => {
  for (const path of ['/', '', null, undefined, '/about', '/blog', '/blog/first-post', '/features/ai-sites', '/not-a-page', '/checkoutcancelled']) {
    assert.equal(classifyPopupPath(PAGES, path), null, String(path));
  }
});

test('ALLOW: desktop home keeps the 3 s timer', () => {
  assert.equal(resolvePopupTrigger({ ownerMode: undefined, isPhone: false, pathKind: null }), 'delay');
});

test('ALLOW: a computer shop page is unchanged', () => {
  assert.equal(resolvePopupTrigger({ ownerMode: undefined, isPhone: false, pathKind: 'shop' }), 'delay');
  assert.equal(resolvePopupTrigger({ ownerMode: 'exit', isPhone: false, pathKind: 'shop' }), 'exit');
});

test('ALLOW: a phone with no owner choice waits for a scroll; an owner choice is kept', () => {
  assert.equal(resolvePopupTrigger({ ownerMode: undefined, isPhone: true, pathKind: null }), 'scroll');
  assert.equal(resolvePopupTrigger({ ownerMode: 'delay', isPhone: true, pathKind: null }), 'delay');
});
