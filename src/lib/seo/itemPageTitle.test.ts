import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemPageTitle, menuItemOwnTitle } from './itemPageTitle.ts';

const SITE = 'Brightside';

const team = { format: 'team', name: 'Team', seo: { metaTitle: 'The barbers | Brightside' } };
const menu = { format: 'menu', name: 'Menu', seo: { metaTitle: 'Menu | The Old Mill Bakehouse' } };
const products = { format: 'products', name: 'Shop', seo: { metaTitle: 'Shop | Brightside' } };

test("RT5-166 ALLOW: a team member's own name wins over the page's SEO title", () => {
  assert.equal(itemPageTitle(team, { name: 'Sam Rivera' }, SITE), 'Sam Rivera | Brightside');
});

test('RT5-166 REFUSE: a team member with no name, or one the roster lookup missed, keeps the page title', () => {
  assert.equal(itemPageTitle(team, { name: '' }, SITE), 'The barbers | Brightside');
  assert.equal(itemPageTitle(team, undefined, SITE), 'The barbers | Brightside');
  // No page title either: the sensible fallback, never an empty title.
  assert.equal(itemPageTitle({ format: 'team', name: 'Team' }, undefined, SITE), 'Team Member | Brightside');
});

test('RT5-166 ALLOW: a menu item gets its own title, trimmed', () => {
  assert.equal(itemPageTitle(menu, { title: '  Brown Sugar Oat Cookie ' }, SITE), 'Brown Sugar Oat Cookie | Brightside');
  assert.equal(menuItemOwnTitle({ title: '  Brown Sugar Oat Cookie ' }), 'Brown Sugar Oat Cookie');
});

test('RT5-166 REFUSE: when the menu lookup fails, or the item has no usable title, the page title is used', () => {
  assert.equal(itemPageTitle(menu, undefined, SITE), 'Menu | The Old Mill Bakehouse');
  assert.equal(itemPageTitle(menu, { title: '   ' }, SITE), 'Menu | The Old Mill Bakehouse');
  assert.equal(itemPageTitle(menu, { title: 42 }, SITE), 'Menu | The Old Mill Bakehouse');
  assert.equal(menuItemOwnTitle(undefined), undefined);
  // No page SEO title: the page name, as before.
  assert.equal(itemPageTitle({ format: 'menu', name: 'Menu' }, undefined, SITE), 'Menu | Brightside');
});

test('product pages are unchanged: the page title, whatever the item carries', () => {
  assert.equal(itemPageTitle(products, { title: 'Oat Cookie', name: 'Oat Cookie' }, SITE), 'Shop | Brightside');
  assert.equal(itemPageTitle({ format: 'products', name: 'Shop' }, { title: 'Oat Cookie' }, SITE), 'Shop | Brightside');
});
