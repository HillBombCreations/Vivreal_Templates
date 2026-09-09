import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDetailJsonLd,
  asOfferPrice,
  DEFAULT_OFFER_CURRENCY,
} from './schema.ts';

/**
 * THE OFFER MUST NOT CONTRADICT THE PAGE IT SHIPS ON.
 *
 * Structured data is a claim made to a search engine on every product page in
 * the fleet, and a wrong-but-confident claim is worse than an absent one: an
 * omitted `availability` is legal in the vocabulary and says nothing, while a
 * present one is acted on.
 *
 * Three things were wrong in one object literal:
 *
 *   - `availability` was hard-coded to `InStock` for every product, so a
 *     product whose stock had run out could ship a visible, disabled "Out of
 *     stock" button (the renderer's `DetailAddToCart`, drawn from
 *     `computeProductStockState`) and an in-stock claim in the SAME document;
 *   - `price` was `String(input.price)` over a Mongo Mixed field, so an
 *     authored "$9.00" emitted an `Offer` that fails validation and takes the
 *     whole `Product` down with it;
 *   - `priceCurrency` was hard-coded to USD even though Square carries the
 *     merchant's real currency all the way into this repo.
 *
 * Both directions are pinned for each. Removing a true claim is as much a
 * regression as keeping a false one.
 */

const product = (overrides: Record<string, unknown> = {}) =>
  buildDetailJsonLd({
    format: 'products',
    title: 'Sourdough Loaf',
    price: '8.50',
    sku: 'abc123',
    ...overrides,
  });

const offerOf = (schema: Record<string, unknown>) =>
  schema.offers as Record<string, unknown> | undefined;

// ---------------------------------------------------------------------------
// availability: the sharp one
// ---------------------------------------------------------------------------

test('a SOLD OUT product does not claim to be in stock', () => {
  // The defect, stated as a test. `inStock: false` is what the caller computes
  // from `computeProductStockState(...).isOutOfStock`, the same function that
  // draws the disabled "Out of stock" button on the page this schema ships on.
  const offer = offerOf(product({ inStock: false }));
  assert.equal(offer?.availability, 'https://schema.org/OutOfStock');
});

test('an IN STOCK product still says so', () => {
  const offer = offerOf(product({ inStock: true }));
  assert.equal(offer?.availability, 'https://schema.org/InStock');
});

test('an UNTRACKED product asserts nothing about availability', () => {
  // `Product.stock` is absent for most of the fleet, and absent means the
  // merchant never opted into inventory tracking, not that everything is in
  // stock. The field is omitted rather than guessed: `undefined` is the
  // renderer's own signal for untracked.
  const offer = offerOf(product());
  assert.ok(offer, 'sanity: this test asserted on nothing');
  assert.ok(
    !('availability' in offer),
    'an absent stock count must not be published as a positive in-stock claim',
  );
});

test('the Offer stays valid in all three states', () => {
  // Whatever availability does, `price` and `priceCurrency` are what Google
  // requires of an Offer carrying a price. Dropping either would silently cost
  // the fleet its product rich results, which is a bigger change than the one
  // being made.
  for (const inStock of [true, false, undefined]) {
    const offer = offerOf(product({ inStock }));
    assert.equal(offer?.['@type'], 'Offer');
    assert.equal(offer?.price, '8.50');
    assert.equal(typeof offer?.priceCurrency, 'string');
  }
});

// ---------------------------------------------------------------------------
// price: Mongo Mixed reaches this function verbatim
// ---------------------------------------------------------------------------

test('an authored "$9.00" does not emit an invalid Offer', () => {
  // `objectValue.price` is Mixed, so this is a real stored shape and not a
  // hypothetical. It used to be passed straight through by `String(...)`.
  // Rejecting falls back to `Thing`, the same branch a product with no price at
  // all already took: no rich result either way, but a valid document.
  const schema = product({ price: '$9.00' });
  assert.equal(schema['@type'], 'Thing');
  assert.equal(schema.offers, undefined);
});

test('free text and empty prices are refused the same way', () => {
  for (const price of ['From $12', '', '   ', 'Market price', '9,00', Number.NaN, -3]) {
    const schema = product({ price });
    assert.equal(
      schema['@type'],
      'Thing',
      `"${String(price)}" is not a publishable price and must not reach an Offer`,
    );
  }
});

test('a real price still emits a real Product, in both stored shapes', () => {
  // The other direction. Square stores a dollars STRING ("8.50"); the portal's
  // own create form stores whatever was typed, commonly "9" or a number.
  assert.equal(offerOf(product({ price: '8.50' }))?.price, '8.50');
  assert.equal(offerOf(product({ price: '9' }))?.price, '9');
  assert.equal(offerOf(product({ price: 9 }))?.price, '9');
  assert.equal(offerOf(product({ price: 9.5 }))?.price, '9.5');
  assert.equal(offerOf(product({ price: ' 8.50 ' }))?.price, '8.50');
  assert.equal(offerOf(product({ price: '0' }))?.price, '0');
});

test('asOfferPrice rejects rather than repairs, exactly as asPublishDate does', () => {
  // Stripping the "$" would be guessing at the currency the number is
  // denominated in, which is the other thing this change stopped doing.
  assert.equal(asOfferPrice('$9.00'), undefined);
  assert.equal(asOfferPrice('9.00'), '9.00');
  assert.equal(asOfferPrice(undefined), undefined);
});

// ---------------------------------------------------------------------------
// priceCurrency: real where we have it, named guess where we do not
// ---------------------------------------------------------------------------

test('a real currency wins over the fallback', () => {
  // Square sets `priceCurrency` authoritatively from the connected merchant
  // account. It reaches this repo and was being dropped by the product
  // allowlist, which is how a Canadian Square merchant published US dollars.
  assert.equal(offerOf(product({ currency: 'CAD' }))?.priceCurrency, 'CAD');
  assert.equal(offerOf(product({ currency: 'cad' }))?.priceCurrency, 'CAD');
});

test('an absent or malformed currency falls back to the named default', () => {
  // Stripe never captured a currency, and a Square item with a variable price
  // stores `priceCurrency: ""` (observed in prod). An Offer that carries a
  // price MUST carry a currency, so unlike availability there is no
  // assert-nothing option: the fallback is kept, and it is named rather than
  // inlined so it reads as the guess it is.
  assert.equal(offerOf(product())?.priceCurrency, DEFAULT_OFFER_CURRENCY);
  assert.equal(offerOf(product({ currency: '' }))?.priceCurrency, DEFAULT_OFFER_CURRENCY);
  assert.equal(offerOf(product({ currency: 'US' }))?.priceCurrency, DEFAULT_OFFER_CURRENCY);
  assert.equal(offerOf(product({ currency: 'DOLLARS' }))?.priceCurrency, DEFAULT_OFFER_CURRENCY);
});

// ---------------------------------------------------------------------------
// Nothing else in the builder moved
// ---------------------------------------------------------------------------

test('collection-list shares the products Offer, and the other formats are untouched', () => {
  const item = buildDetailJsonLd({
    format: 'collection-list',
    title: 'Chocolate Croissant',
    price: '4.25',
    inStock: false,
  });
  assert.equal(item['@type'], 'Product');
  assert.equal(offerOf(item)?.availability, 'https://schema.org/OutOfStock');

  const event = buildDetailJsonLd({ format: 'shows', title: 'A show', startDate: '2026-09-05' });
  assert.equal(event['@type'], 'Event');
  const article = buildDetailJsonLd({ format: 'blog', title: 'A post', authorName: 'Jo' });
  assert.equal(article['@type'], 'Article');
});

// ---------------------------------------------------------------------------
// Source pins for the call site, which is JSX and cannot be executed here
// ---------------------------------------------------------------------------

const source = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8');

test('SOURCE PIN: the route derives the claim from the SAME function as the button', () => {
  // A second implementation of "is this sold out" is how the button and the
  // schema drift apart again. The renderer exports the aggregate it draws the
  // button from; the route imports it rather than reimplementing it.
  //
  // Sliced to the product arm so the file's dense comments cannot satisfy this
  // on their own: an earlier pin in this family was found to be vacuous because
  // both strings it searched for appeared only in prose.
  const whole = source('../../app/[slug]/[itemId]/page.tsx');
  const start = whole.indexOf('const productJsonLd = buildDetailJsonLd({');
  assert.ok(start > 0, 'sanity: the product JSON-LD call site was not found');
  const arm = whole.slice(start, whole.indexOf('});', start));
  // Asserted over the import SECTION rather than one exact import line. The
  // first version of this pin matched `import { computeProductStockState }`
  // literally and broke the moment the import grew a second name, which is a
  // false alarm rather than a finding. What has to stay true is that the stock
  // state comes from the renderer and is not reimplemented here.
  const header = whole.slice(0, whole.indexOf('export const revalidate'));
  assert.ok(header.length > 0, 'sanity: the import section was not found');
  // COMMENT LINES STRIPPED FIRST. The import block carries a comment naming
  // these same helpers, so a whole-text search passes on the explanation alone:
  // deleting the import and keeping the comment left this green, found by
  // mutation testing. It is the same vacuity that made one of #150's pins
  // useless, in a file that had already been warned about it.
  const importedCode = header
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t !== '' && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
  assert.ok(
    importedCode.includes('computeProductStockState') &&
      importedCode.includes('@hillbombcreations/site-renderer'),
    'the stock state must come from the renderer, not a local copy',
  );
  assert.ok(
    !whole.includes('function computeProductStockState'),
    'and it must not be reimplemented in this file, or the button and the claim can drift',
  );
  assert.ok(
    arm.includes('inStock: productStock.tracked ? !productStock.isOutOfStock : undefined'),
    'untracked must reach the builder as undefined so the field is omitted, not guessed',
  );
  assert.ok(
    arm.includes('currency: product.priceCurrency'),
    'and the real currency must be passed when the provider gave us one',
  );
});

test('SOURCE PIN: the product allowlist stops dropping the currency Square sends', () => {
  // `transformProduct` is an allowlist: a field it does not name is gone, and
  // this one was. VR_Client_API projects the whole `objectValue`, so the value
  // really does arrive.
  const code = source('../../lib/api/products/transformProduct.ts');
  const start = code.indexOf('export function transformProduct(');
  assert.ok(start > 0, 'sanity: transformProduct was not found, this pin read nothing');
  const body = code.slice(start);
  assert.ok(
    body.includes('priceCurrency:'),
    'the currency must survive the allowlist or every product claims the default',
  );
  assert.ok(
    body.includes('stock:'),
    'sanity: stock is still carried, which is what the availability claim is derived from',
  );
});

test('SOURCE PIN: the hard-coded in-stock claim is gone from the builder', () => {
  // The mutation this whole file exists to catch: restoring the literal would
  // make every behavioural assertion above pass again except the untracked one,
  // so this pin names the exact shape that must not come back.
  const code = source('./schema.ts');
  assert.ok(
    !code.includes("availability: 'https://schema.org/InStock',"),
    'availability must be derived from stock, never asserted unconditionally',
  );
  assert.ok(
    !code.includes('price: String(input.price)'),
    'a Mixed price must be validated before it is published as an Offer',
  );
});
