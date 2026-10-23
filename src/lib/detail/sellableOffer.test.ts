import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as offer from './productOffer.ts';
import { buildDetailJsonLd } from '../../components/JsonLd/schema.ts';
// The renderer's real first-size rule, by relative path for the reason
// `productOffer.test.ts` gives. A namespace import, so this file still loads on
// a renderer without it and its parity test fails as an assertion.
import * as rendererItemAction from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/itemAction.js';

/**
 * W1 (D13, D14): what the product page's one `Offer` tells search engines when
 * the item, or the size the page shows, cannot be bought.
 *
 *   - D13: an item that cannot be bought (`purchasable: false`) is OutOfStock.
 *   - D14: the page starts on the first size that sells (renderer 1.89.0,
 *     `firstSellableVariant`), so the Offer describes THAT size. Only when no
 *     size sells is the Offer OutOfStock.
 *   - Absent fields: exactly today's Offer.
 *
 * `inStockFor` is the route's expression. On a tree without `offerInStock` it
 * falls back to the expression the route used before W1, so the REFUSE tests
 * below fail on their assertions there, not on a missing import.
 */

type StockState = { tracked: boolean; isOutOfStock: boolean };
type SaleFields = { purchasable?: unknown; notForSaleVariants?: unknown };

const todayInStock = (stock: StockState): boolean | undefined => (stock.tracked ? !stock.isOutOfStock : undefined);
const inStockFor = (stock: StockState, sale: SaleFields, variant: string | null): boolean | undefined => {
  // Cast: on a tree without W1 the export does not exist yet (see above).
  const fn = (offer as Record<string, unknown>).offerInStock as
    | ((s: StockState, p: SaleFields, v: string | null) => boolean | undefined)
    | undefined;
  return fn ? fn(stock, sale, variant) : todayInStock(stock);
};
// Cast: the second parameter is new in W1; on a tree without it, it is ignored.
const variantFor = offer.offerVariantKey as (u: offer.OfferVariantConfig | undefined, nfs?: unknown) => string | null;

const UNTRACKED: StockState = { tracked: false, isOutOfStock: false };
const IN_STOCK: StockState = { tracked: true, isOutOfStock: false };
const SOLD_OUT: StockState = { tracked: true, isOutOfStock: true };

const SIZES = { name: 'Size', values: ['Half Dozen', 'Dozen'] };
const PRICES = { 'Half Dozen': '12.00', Dozen: '22.00' };

/** The route's product arm, reduced to the fields that decide the Offer. */
function productOffer(sale: SaleFields, stock: StockState, usingVariant = SIZES, price: unknown = PRICES) {
  const variant = variantFor(usingVariant, sale.notForSaleVariants);
  const schema = buildDetailJsonLd({
    format: 'products',
    title: 'Cookies',
    price: offer.offerFieldValue(price, variant, usingVariant.values),
    inStock: inStockFor(stock, sale, variant),
  });
  return { variant, offers: (schema as { offers?: Record<string, unknown> }).offers };
}

test('ALLOW: with no W1 fields the Offer is byte for byte what it was', () => {
  for (const stock of [UNTRACKED, IN_STOCK, SOLD_OUT]) {
    const today = buildDetailJsonLd({ format: 'products', title: 'Cookies', price: '12.00', inStock: todayInStock(stock) });
    const now = productOffer({}, stock);
    assert.equal(now.variant, 'Half Dozen', 'the first size, as before');
    assert.equal(JSON.stringify(buildDetailJsonLd({ format: 'products', title: 'Cookies', price: '12.00', inStock: inStockFor(stock, {}, now.variant) })), JSON.stringify(today));
    assert.equal(inStockFor(stock, { purchasable: true }, now.variant), todayInStock(stock), 'purchasable true is no change');
  }
});

test('REFUSE (D13): an item that cannot be bought is OutOfStock, whatever its stock count says', () => {
  for (const stock of [UNTRACKED, IN_STOCK]) {
    const { offers } = productOffer({ purchasable: false }, stock);
    assert.ok(offers, 'sanity: an Offer was emitted');
    assert.equal(offers.availability, 'https://schema.org/OutOfStock', JSON.stringify(stock));
    assert.equal(offers.price, '12.00', 'the price stays, only the availability changes');
  }
});

test('ALLOW (D14): with the first size off sale the Offer describes the first size that sells, with its price', () => {
  const { variant, offers } = productOffer({ purchasable: true, notForSaleVariants: ['Half Dozen'] }, UNTRACKED);
  assert.equal(variant, 'Dozen');
  assert.equal(offers?.price, '22.00');
  assert.equal(Object.hasOwn(offers ?? {}, 'availability'), false, 'untracked and sellable asserts nothing, as today');
});

test('REFUSE (D14): when no size sells the Offer is OutOfStock', () => {
  // C1 also says purchasable false here; the size list alone must be enough.
  const { offers } = productOffer({ notForSaleVariants: ['Half Dozen', 'Dozen'] }, UNTRACKED);
  assert.equal(offers?.availability, 'https://schema.org/OutOfStock');
});

test('REFUSE (D14): a malformed size list changes nothing', () => {
  for (const notForSaleVariants of ['Half Dozen', { 'Half Dozen': true }, null]) {
    const { variant, offers } = productOffer({ notForSaleVariants }, UNTRACKED);
    assert.equal(variant, 'Half Dozen', JSON.stringify(notForSaleVariants));
    assert.equal(Object.hasOwn(offers ?? {}, 'availability'), false, JSON.stringify(notForSaleVariants));
  }
});

test('PARITY: the size the Offer describes is the size the renderer starts the page on', () => {
  const firstSellableVariant = (rendererItemAction as Record<string, unknown>).firstSellableVariant as
    | ((p: { usingVariant?: { values?: readonly string[] }; notForSaleVariants?: unknown }) => string | null)
    | undefined;
  assert.equal(typeof firstSellableVariant, 'function', 'renderer 1.89.0 exports firstSellableVariant');
  const cases: { usingVariant?: { name: string; values: string[] }; notForSaleVariants?: unknown }[] = [
    { usingVariant: SIZES },
    { usingVariant: SIZES, notForSaleVariants: ['Half Dozen'] },
    { usingVariant: SIZES, notForSaleVariants: ['Dozen'] },
    { usingVariant: SIZES, notForSaleVariants: ['Half Dozen', 'Dozen'] },
    { usingVariant: SIZES, notForSaleVariants: ['Gone'] },
    { usingVariant: { name: 'Size', values: [] } },
    {},
  ];
  for (const product of cases) {
    assert.equal(variantFor(product.usingVariant, product.notForSaleVariants), firstSellableVariant!(product), JSON.stringify(product));
  }
});

test('SOURCE PIN: the route starts the Offer on the first size that sells and asks offerInStock', () => {
  const whole = readFileSync(new URL('../../app/[slug]/[itemId]/page.tsx', import.meta.url), 'utf8');
  const start = whole.indexOf('const offerVariant = offerVariantKey(');
  assert.ok(start > 0, 'sanity: the variant resolution was not found');
  assert.ok(whole.startsWith('const offerVariant = offerVariantKey(product.usingVariant, product.notForSaleVariants);', start));
  const call = whole.slice(whole.indexOf('const productJsonLd = buildDetailJsonLd({'), whole.indexOf('});', whole.indexOf('const productJsonLd')));
  assert.ok(call.includes('inStock: offerInStock(productStock, product, offerVariant)'));
  // The product page's title and share card name the same size the page shows.
  const summary = readFileSync(new URL('./storefrontItem.ts', import.meta.url), 'utf8');
  assert.ok(summary.includes('offerVariantKey(product.usingVariant, product.notForSaleVariants)'));
});
