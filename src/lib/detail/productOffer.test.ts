import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { offerVariantKey, offerFieldValue } from './productOffer.ts';
import { buildDetailJsonLd } from '../../components/JsonLd/schema.ts';
// The renderer's REAL resolution, imported by relative path on purpose.
// `@hillbombcreations/site-renderer/dist/lib/variant.js` is not importable by
// that specifier: the package's `exports` map exposes only `.` and `./agent`.
// A relative path bypasses the exports map, which is what lets this suite prove
// the local copy agrees with the original rather than merely assert that it
// should. Production code does NOT do this (a relative node_modules path is not
// something to ship through a bundler); it uses the local copy, and this is the
// test that keeps the two honest across a renderer bump.
import {
  resolveVariant as rendererResolveVariant,
  getSafeFieldValue as rendererGetSafeFieldValue,
} from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/variant.js';

/**
 * A VARIANT-PRICED PRODUCT MUST SHIP A REAL OFFER, FOR THE VARIANT ON DISPLAY.
 *
 * `buildDetailJsonLd` only emits an `Offer` when handed a publishable price,
 * and the route only handed it `typeof product.price === 'string'`. A variant
 * product's price is a MAP, so all nine stock-tracking products in the fleet
 * fell through to `Thing` and told search engines nothing at all: no price, no
 * currency, no availability. An absent claim is legal, but an absent claim
 * about a product that is for sale is a hole, not a safety property.
 *
 * The shape is one ordinary `Offer` describing the variant the page renders,
 * NOT an `AggregateOffer` price range. Both the vocabulary and Google rule that
 * out, and `productOffer.ts` carries the quotes. What this suite pins is the
 * consequence: the resolution has to agree with the renderer exactly, because
 * the whole justification for describing "the first variant" is that the first
 * variant is what the HTML shows.
 */

// ---------------------------------------------------------------------------
// Which variant the offer describes
// ---------------------------------------------------------------------------

test('the offer describes the FIRST authored variant, which is the one rendered', () => {
  assert.equal(offerVariantKey({ name: 'Dozen', values: ['Single', 'Half Dozen'] }), 'Single');
});

test('a product with no variants resolves to no variant key', () => {
  assert.equal(offerVariantKey(undefined), null);
  assert.equal(offerVariantKey({ name: 'Size', values: [] }), null);
  assert.equal(offerVariantKey({ name: 'Size' }), null);
});

// ---------------------------------------------------------------------------
// Reading a Variantable field for that variant
// ---------------------------------------------------------------------------

test('a variant price map resolves to the rendered variant, not to nothing', () => {
  // The defect, stated as a test. This map used to produce `undefined`, which
  // sent the whole product to `Thing`.
  const price = { Single: '3', 'Half Dozen': '14', 'Full Dozen': '28' };
  const values = ['Single', 'Half Dozen', 'Full Dozen'];
  assert.equal(offerFieldValue(price, 'Single', values), '3');
});

test('a scalar field is returned unchanged, so single-price products do not move', () => {
  assert.equal(offerFieldValue('8.50', null, undefined), '8.50');
  assert.equal(offerFieldValue('Sourdough Loaf', null, undefined), 'Sourdough Loaf');
});

test('a numeric value in a variant map is stringified, as the renderer does', () => {
  // An authored number has to reach `asOfferPrice` as "4", or a legitimately
  // priced variant is rejected as unpublishable.
  assert.equal(offerFieldValue({ Single: 4 }, 'Single', ['Single']), '4');
});

test('an absent field stays absent', () => {
  assert.equal(offerFieldValue(undefined, 'Single', ['Single']), undefined);
  assert.equal(offerFieldValue({}, 'Single', ['Single']), undefined);
});

test('a variant map missing the rendered key falls back the way the page does', () => {
  // Both fallbacks exist upstream so a partially authored map still renders
  // something. Reproducing them is not optional: omitting a field the page is
  // displaying is its own contradiction.
  assert.equal(offerFieldValue({ default: '9', Other: '1' }, 'Single', ['Single']), '9');
  assert.equal(offerFieldValue({ Other: '1' }, 'Single', ['Single']), '1');
});

test('a key outside usingVariant.values is treated as no selection', () => {
  // The map must CONTAIN the off-list key for this to prove anything. An
  // earlier version of this case used a key absent from both the map and the
  // values list, where the guarded and unguarded paths happen to agree, so
  // deleting the guard left it green. Caught by mutation testing, and the point
  // generalises: an assertion about a guard has to be written at an input the
  // guard actually changes.
  const price = { Single: '3', Bogus: '42', default: '99' };
  assert.equal(
    offerFieldValue(price, 'Bogus', ['Single', 'Half Dozen']),
    '99',
    'a key the product does not offer must not be read out of the map',
  );
  // And the same key, once it IS an offered variant, resolves normally.
  assert.equal(offerFieldValue(price, 'Bogus', ['Bogus', 'Single']), '42');
});

// ---------------------------------------------------------------------------
// The local copy must AGREE with the renderer, case by case
// ---------------------------------------------------------------------------

test('DIFFERENTIAL: the local resolution matches the renderer on every shape', () => {
  // The one guard that matters for a copied function. `productOffer.ts`
  // reimplements `resolveVariant` and `getSafeFieldValue` because the renderer
  // does not export them, and a copy that drifts makes the JSON-LD disagree
  // with the button, which is the bug this whole change set is about.
  //
  // Every case below is run through BOTH implementations and compared, so a
  // renderer bump that changes the resolution fails here instead of silently
  // changing what the fleet claims to Google.
  // The fixtures carry a real `_id` because the renderer's `DetailProductData`
  // requires one. They are still cast at the call boundary below, for a reason
  // worth stating: `objectValue` is Mongo Mixed, so production really does
  // contain shapes the declared type forbids (a price authored as a number is
  // one of them, and it is in this list on purpose). What matters here is what
  // the two implementations DO with real data, not what the declaration says
  // can reach them.
  const products = [
    { _id: 'p1', name: 'Plain', price: '4' },
    { _id: 'p2', name: 'Plain', price: 4 },
    {
      _id: 'p3',
      name: { Original: 'Sourdough Boules', Asiago: 'Asiago' },
      price: { Original: '10', Asiago: '13' },
      usingVariant: { name: 'Bread Flavors', values: ['Original', 'Asiago'] },
    },
    {
      _id: 'p4',
      name: 'Cinnamon Roll',
      price: { Single: '5', 'Full Pan': '18' },
      usingVariant: { name: 'Cinnamon Roll Sizes', values: ['Single', 'Full Pan'] },
    },
    {
      _id: 'p5',
      name: 'Partially authored',
      price: { default: '9' },
      usingVariant: { name: 'Size', values: ['Single', 'Full Pan'] },
    },
    {
      _id: 'p6',
      name: 'First key only',
      price: { Other: '7' },
      usingVariant: { name: 'Size', values: ['Single'] },
    },
    { _id: 'p7', name: 'No values', price: { Single: '2' }, usingVariant: { name: 'Size', values: [] } },
    { _id: 'p8', name: 'Priceless', usingVariant: { name: 'Size', values: ['Single'] } },
  ];

  type RendererProduct = Parameters<typeof rendererResolveVariant>[1];

  let compared = 0;
  for (const product of products) {
    const asRendered = product as unknown as RendererProduct;
    // The route never has a selection: this is a server render.
    const rendererKey = rendererResolveVariant(null, asRendered);
    const localKey = offerVariantKey(product.usingVariant);
    assert.equal(localKey, rendererKey, `variant key drifted for ${JSON.stringify(product)}`);

    for (const field of ['name', 'price'] as const) {
      const expected = rendererGetSafeFieldValue(asRendered, field, null);
      const actual = offerFieldValue(
        (product as Record<string, unknown>)[field],
        localKey,
        product.usingVariant?.values,
      );
      assert.equal(
        actual,
        expected,
        `${field} drifted for ${JSON.stringify(product)}: renderer said ${String(expected)}, this repo said ${String(actual)}`,
      );
      compared += 1;
    }
  }
  // Guard against the whole loop silently doing nothing, which is how a
  // differential test passes while proving zero (the vacuity failure mode this
  // repo has already been bitten by once).
  assert.equal(compared, products.length * 2, 'sanity: the comparison did not run');

  // The off-list-key guard, compared the same way. The loop above cannot reach
  // it, because `offerVariantKey` always returns a key that IS in the list, so
  // it needs an explicit selection to exercise. Production cannot reach it
  // either, for the same reason; it is mirrored because this module's whole
  // value is being the same function as the renderer's, and a copy that is
  // "the same except in the branch nobody hits" stops being checkable.
  const offList = {
    _id: 'p9',
    price: { Single: '3', Bogus: '42', default: '99' },
    usingVariant: { name: 'Size', values: ['Single', 'Half Dozen'] },
  } as unknown as RendererProduct;
  assert.equal(
    offerFieldValue({ Single: '3', Bogus: '42', default: '99' }, 'Bogus', ['Single', 'Half Dozen']),
    rendererGetSafeFieldValue(offList, 'price', 'Bogus'),
    'the off-list-variant guard drifted from the renderer',
  );
});

// ---------------------------------------------------------------------------
// The nine products that are actually in the fleet
// ---------------------------------------------------------------------------

test('LIVE SHAPES: every stock-tracking product in the fleet gains a publishable price', () => {
  // Read out of production (read-only) while designing this, and reproduced
  // here as fixtures so the shapes are pinned rather than remembered. All nine
  // are Stripe, all nine are variant-priced, and all nine shipped `Thing`
  // before this change.
  //
  // Three distinct stock shapes appear among them, and each needs its own
  // answer: a full per-variant map, a SCALAR count against a variant price map
  // (Sourdough Boules), and a map that tracks only SOME variants (the cinnamon
  // roll's "Full Pan" has no entry).
  const live: Array<{ label: string; price: unknown; values: string[]; expected: string }> = [
    { label: 'Double Chocolate Fudge Brownies', price: { Single: '4', 'Full Pan': '32' }, values: ['Single', 'Full Pan'], expected: '4' },
    { label: 'Sourdough Boules', price: { Original: '10', Asiago: '13' }, values: ['Original', 'Asiago'], expected: '10' },
    { label: 'Southern Sun Lemon Bars', price: { 'Single Piece': '4', 'Half Pan': '22', 'Full Pan': '40' }, values: ['Single Piece', 'Half Pan', 'Full Pan'], expected: '4' },
    { label: "Golden Ember S'mores Bars", price: { 'Single Piece': '4', 'Half Pan': '22', 'Full Pan': '40' }, values: ['Single Piece', 'Half Pan', 'Full Pan'], expected: '4' },
    { label: 'Volunteer Dream Cookies', price: { 'Single Piece': '4', 'Half Dozen': '22', 'Full Dozen': '44' }, values: ['Single Piece', 'Half Dozen', 'Full Dozen'], expected: '4' },
    { label: 'Brown Butter Chocolate Chunk Cookie', price: { 'Single Piece': '3', 'Half Dozen': '14', 'Full Dozen': '28' }, values: ['Single Piece', 'Half Dozen', 'Full Dozen'], expected: '3' },
    { label: 'Brown Butter Monster Cookie', price: { 'Single Piece': '3', 'Half Dozen': '14', 'Full Dozen': '28' }, values: ['Single Piece', 'Half Dozen', 'Full Dozen'], expected: '3' },
    { label: 'Sunrise Sourdough Cinnamon Roll', price: { Single: '5', 'Full Pan': '18' }, values: ['Single', 'Full Pan'], expected: '5' },
    { label: 'Oatmeal Creme Pie', price: { Single: '3', 'Half Dozen': '14', 'Full Dozen': '28' }, values: ['Single', 'Half Dozen', 'Full Dozen'], expected: '3' },
  ];
  assert.equal(live.length, 9, 'sanity: the fleet fixture lost a product');
  for (const { label, price, values, expected } of live) {
    const key = offerVariantKey({ name: 'v', values });
    assert.equal(
      offerFieldValue(price, key, values),
      expected,
      `${label} must resolve a real price for the variant its page renders`,
    );
  }
});

// ---------------------------------------------------------------------------
// The whole chain: resolution into the builder, which is what actually ships
// ---------------------------------------------------------------------------

/** What the route does, minus the JSX: resolve for the rendered variant, build. */
function offerFor(product: {
  name?: unknown;
  price?: unknown;
  usingVariant?: { name?: string; values?: string[] };
  currency?: string;
  inStock?: boolean;
}) {
  const key = offerVariantKey(product.usingVariant);
  const values = product.usingVariant?.values;
  return buildDetailJsonLd({
    format: 'products',
    title: offerFieldValue(product.name, key, values) || 'Product',
    price: offerFieldValue(product.price, key, values),
    currency: product.currency,
    inStock: product.inStock,
  });
}

test('a VARIANT-PRICED product now emits a real Product with a real Offer', () => {
  // The defect this task fixes. Every one of these shipped `Thing` before:
  // no price, no currency, no availability, on a product that is for sale.
  const schema = offerFor({
    name: 'Double Chocolate Fudge Brownies',
    price: { Single: '4', 'Full Pan': '32' },
    usingVariant: { name: 'Brownie Sizes', values: ['Single', 'Full Pan'] },
    inStock: true,
  });
  assert.equal(schema['@type'], 'Product');
  assert.equal(schema.name, 'Double Chocolate Fudge Brownies');
  assert.deepEqual(schema.offers, {
    '@type': 'Offer',
    price: '4',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  });
});

test('a variant-NAMED product stops calling itself "Product"', () => {
  // Sourdough Boules authors `name` as a variant map too. The old string-only
  // gate resolved it to undefined and the title fell back to the literal
  // "Product", which was harmless while the schema was an empty `Thing` and is
  // not harmless now that it carries a price.
  const schema = offerFor({
    name: { Original: 'Sourdough Boules', Asiago: 'Asiago' },
    price: { Original: '10', Asiago: '13' },
    usingVariant: { name: 'Bread Flavors', values: ['Original', 'Asiago'] },
  });
  assert.equal(schema.name, 'Sourdough Boules');
  assert.notEqual(schema.name, 'Product');
});

test('MIXED AVAILABILITY: the offer reports the RENDERED variant, not the best one', () => {
  // The modelling question, answered by refusing to aggregate. The page shows
  // the first variant, and its button is disabled because that variant is sold
  // out, even though another variant has stock. A whole-product "in stock"
  // would be a claim the page visibly contradicts.
  //
  // The route derives `inStock` from `resolveStock(stock, renderedVariant)`, so
  // this is that state arriving here: sold out.
  const schema = offerFor({
    name: 'Cinnamon Roll',
    price: { Single: '5', 'Full Pan': '18' },
    usingVariant: { name: 'Sizes', values: ['Single', 'Full Pan'] },
    inStock: false,
  });
  assert.equal(
    (schema.offers as Record<string, unknown>).availability,
    'https://schema.org/OutOfStock',
  );
  assert.equal(
    (schema.offers as Record<string, unknown>).price,
    '5',
    'and the price is that same sold-out variant, so the two halves describe one thing',
  );
});

test('a variant with untracked stock asserts nothing, and still ships its price', () => {
  const offer = offerFor({
    name: 'Cinnamon Roll',
    price: { 'Full Pan': '18', Single: '5' },
    usingVariant: { name: 'Sizes', values: ['Full Pan', 'Single'] },
  }).offers as Record<string, unknown>;
  assert.equal(offer.price, '18');
  assert.ok(!('availability' in offer), 'untracked means omit, exactly as for a scalar product');
});

test('a RANGE OF ONE is a price, not a range', () => {
  // A single-key variant map, and the case where every variant costs the same.
  // Neither is a range, and neither gets special handling: one variant is
  // rendered and one price is stated.
  const single = offerFor({
    name: 'One size',
    price: { Only: '12' },
    usingVariant: { name: 'Size', values: ['Only'] },
  });
  assert.equal((single.offers as Record<string, unknown>).price, '12');

  const flat = offerFor({
    name: 'Flat priced',
    price: { Small: '7', Large: '7' },
    usingVariant: { name: 'Size', values: ['Small', 'Large'] },
  });
  assert.equal((flat.offers as Record<string, unknown>).price, '7');
});

test('an unpublishable variant price still emits nothing, rather than a repaired range', () => {
  // Emitting nothing stays a legal outcome. Reject-not-repair survives the move
  // to variants: a range synthesised from values that failed validation would
  // be worse than the `Thing` it replaces.
  for (const price of [{ Single: '$5' }, { Single: 'Market price' }, { Single: '' }, {}]) {
    const schema = offerFor({
      name: 'Unpriceable',
      price,
      usingVariant: { name: 'Size', values: ['Single'] },
    });
    assert.equal(
      schema['@type'],
      'Thing',
      `${JSON.stringify(price)} is not publishable and must not become an Offer`,
    );
  }
});

test('a Square variant product publishes its real currency', () => {
  const offer = offerFor({
    name: 'Shorts',
    price: { S: '82.00', M: '82.00' },
    usingVariant: { name: 'Size', values: ['S', 'M'] },
    currency: 'CAD',
    inStock: true,
  }).offers as Record<string, unknown>;
  assert.equal(offer.priceCurrency, 'CAD');
});

// ---------------------------------------------------------------------------
// Source pins for the JSX call site and the shape decision
// ---------------------------------------------------------------------------

const source = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8');

test('SOURCE PIN: the route reads product fields for the RENDERED variant', () => {
  const whole = source('../../app/[slug]/[itemId]/page.tsx');
  const start = whole.indexOf('const offerVariant = offerVariantKey(');
  assert.ok(start > 0, 'sanity: the variant resolution was not found, this pin read nothing');
  const arm = whole.slice(start, whole.indexOf('const productJsonLd', start));
  for (const field of ['product.name', 'product.price', 'product.description']) {
    assert.ok(
      arm.includes(`offerFieldValue(${field},`),
      `${field} must be resolved for the rendered variant, not required to be a bare string`,
    );
  }
  assert.ok(
    !arm.includes("typeof product.price === 'string'"),
    'the string-only price gate is the defect: it sent every variant product to Thing',
  );
  assert.ok(
    arm.includes("typeof product.imageUrl === 'string'"),
    'image stays scalar-only on purpose, see the comment there',
  );
});

test('SOURCE PIN: availability is resolved at the SAME variant as the price', () => {
  // An aggregate here would pair a whole-product "in stock" with one variant's
  // price, which stops being jointly true the moment that variant is the sold
  // out one.
  const whole = source('../../app/[slug]/[itemId]/page.tsx');
  const start = whole.indexOf('const productStock =');
  assert.ok(start > 0, 'sanity: the stock resolution was not found');
  const block = whole.slice(start, start + 400);
  assert.ok(
    block.includes('computeStockState(resolveStock(product.stock, offerVariant)'),
    'a variant product must report the RENDERED variant stock, the way the buy box does',
  );
  assert.ok(
    block.includes('computeProductStockState(product.stock'),
    'and a product with no variants must keep the aggregate, byte for byte as before',
  );
});

test('SOURCE PIN: no AggregateOffer, and the reason is recorded where it would be added', () => {
  // Google: "Don't use AggregateOffer to describe a set of product variants."
  // The next person to see a price map will reach for it, so the refusal lives
  // in the builder rather than only in a PR description.
  const code = source('../../components/JsonLd/schema.ts');
  // Anchored to EMITTED shapes (a key followed by a colon), not to the bare
  // words. The words appear in the docblock that explains the refusal, and an
  // earlier draft of this pin failed on its own explanation, which is the same
  // vacuity trap as a pin that passes on one.
  for (const emitted of ["'@type': 'AggregateOffer'", 'lowPrice:', 'highPrice:', 'offerCount:']) {
    assert.ok(
      !code.includes(emitted),
      `${emitted} belongs to AggregateOffer, which is the wrong type for variants`,
    );
  }
  assert.ok(
    code.includes("'@type': 'Offer'"),
    'sanity: a plain Offer is still what gets emitted, so this pin read the right file',
  );
  assert.ok(
    code.includes('AggregateOffer'),
    'and the decision must be recorded at the site where it would be reintroduced',
  );
});
