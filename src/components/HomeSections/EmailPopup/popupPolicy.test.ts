import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHONE_MAX_WIDTH,
  PHONE_MEDIA_QUERY,
  isShopOrCheckoutPath,
  resolvePopupTrigger,
  type PopupPage,
} from './popupPolicy.ts';

/**
 * O10: on a phone the newsletter popup never covers a shop, product or checkout
 * page, and with no owner choice it waits for a scroll. A computer keeps today's
 * 3 s timer.
 */

const PAGES: PopupPage[] = [
  { slug: 'shop', format: 'products' },
  { slug: 'menu', format: 'catalog', blocks: [{ config: { bindings: [{ integrationProvider: 'square' }] } }] },
  { slug: 'checkoutsuccess', format: 'checkout-success' },
  { slug: 'checkoutcancel', format: 'checkout-cancel' },
  { slug: 'about', format: 'about' },
  { slug: 'blog', format: 'blog' },
  { slug: 'features', format: 'products' },
  { slug: 'features/ai-sites', format: 'about' },
];

test('the phone width is what a 390 phone matches and a 1440 computer does not', () => {
  assert.ok(390 <= PHONE_MAX_WIDTH);
  assert.ok(1440 > PHONE_MAX_WIDTH);
  assert.equal(PHONE_MEDIA_QUERY, '(max-width: 767px)');
});

test('REFUSE: a 390 shop page never opens the popup, whatever the owner chose', () => {
  const onShop = isShopOrCheckoutPath(PAGES, '/shop');
  assert.equal(onShop, true);
  for (const ownerMode of [undefined, 'delay', 'scroll', 'exit'] as const) {
    assert.equal(
      resolvePopupTrigger({ ownerMode, isPhone: true, onShopOrCheckoutPath: onShop }),
      null,
      String(ownerMode),
    );
  }
});

test('REFUSE: product pages, a page that sells and the checkout pages count as shop pages', () => {
  for (const path of ['/shop/blue-mug', '/shop/blue-mug/', '/menu', '/menu/latte', '/checkoutsuccess', '/checkoutcancel']) {
    assert.equal(isShopOrCheckoutPath(PAGES, path), true, path);
  }
});

test('ALLOW: home, an ordinary page, a blog post and a nested page are not shop pages', () => {
  for (const path of ['/', '', null, undefined, '/about', '/blog', '/blog/first-post', '/features/ai-sites', '/not-a-page']) {
    assert.equal(isShopOrCheckoutPath(PAGES, path), false, String(path));
  }
});

test('ALLOW: desktop home keeps the 3 s timer', () => {
  assert.equal(resolvePopupTrigger({ ownerMode: undefined, isPhone: false, onShopOrCheckoutPath: false }), 'delay');
});

test('ALLOW: a computer shop page is unchanged', () => {
  assert.equal(resolvePopupTrigger({ ownerMode: undefined, isPhone: false, onShopOrCheckoutPath: true }), 'delay');
  assert.equal(resolvePopupTrigger({ ownerMode: 'exit', isPhone: false, onShopOrCheckoutPath: true }), 'exit');
});

test('ALLOW: a phone with no owner choice waits for a scroll; an owner choice is kept', () => {
  assert.equal(resolvePopupTrigger({ ownerMode: undefined, isPhone: true, onShopOrCheckoutPath: false }), 'scroll');
  assert.equal(resolvePopupTrigger({ ownerMode: 'delay', isPhone: true, onShopOrCheckoutPath: false }), 'delay');
});
