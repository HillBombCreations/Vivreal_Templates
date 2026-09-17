import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test").
import { PAYMENTS_PROVIDER_TYPES, isPaymentsProvider } from "./payments.ts";

test("PAYMENTS_PROVIDER_TYPES: exactly the backend D4 mutex set (stripe + square)", () => {
  assert.equal(PAYMENTS_PROVIDER_TYPES.has("stripe"), true);
  assert.equal(PAYMENTS_PROVIDER_TYPES.has("square"), true);
  // Lock the set size so an accidental addition (e.g. shopify, whose checkout
  // is a hosted-redirect fork and is NOT in the backend mutex set) fails loudly.
  assert.equal(PAYMENTS_PROVIDER_TYPES.size, 2);
});

test("isPaymentsProvider: canonical lowercase members -> true", () => {
  assert.equal(isPaymentsProvider("stripe"), true);
  assert.equal(isPaymentsProvider("square"), true);
});

test("isPaymentsProvider: mixed case + surrounding whitespace -> true", () => {
  assert.equal(isPaymentsProvider("Stripe"), true);
  assert.equal(isPaymentsProvider("SQUARE"), true);
  assert.equal(isPaymentsProvider("  stripe  "), true);
  assert.equal(isPaymentsProvider("\tSquare "), true);
});

test("isPaymentsProvider: non-payments providers -> false", () => {
  assert.equal(isPaymentsProvider("linkedin"), false);
  assert.equal(isPaymentsProvider("mailchimp"), false);
  // Deliberately excluded — hosted-redirect checkout (Phase 5), not in the mutex set.
  assert.equal(isPaymentsProvider("shopify"), false);
});

test("isPaymentsProvider: empty / undefined / null -> false", () => {
  assert.equal(isPaymentsProvider(""), false);
  assert.equal(isPaymentsProvider("   "), false);
  assert.equal(isPaymentsProvider(undefined), false);
  assert.equal(isPaymentsProvider(null), false);
});

// ── pagesNeedCart — the CartProvider mount gate ──────────────────────────
// Found in the first live Square E2E: the inline Providers gate scanned only
// TOP-LEVEL block bindings, but a coordinated Products group carries its
// payments binding on the GRID CHILD (config.children[].config.bindings) —
// so the cart never mounted on a page authored with the storefront unit and
// every add-to-cart / Buy now silently no-opped.
import { pagesNeedCart } from "./payments.ts";

test("pagesNeedCart: page.format 'products' -> true", () => {
  assert.equal(pagesNeedCart([{ format: "products" }]), true);
});

test("pagesNeedCart: legacy page.integrations[] payments type -> true", () => {
  assert.equal(pagesNeedCart([{ integrations: [{ type: "square" }] }]), true);
  assert.equal(pagesNeedCart([{ integrations: [{ name: "Stripe" }] }]), true);
});

test("pagesNeedCart: payments binding on a TOP-LEVEL block -> true", () => {
  assert.equal(
    pagesNeedCart([
      { blocks: [{ config: { bindings: [{ integrationProvider: "square" }] } }] },
    ]),
    true,
  );
});

test("pagesNeedCart: payments binding on a coordinated group CHILD -> true (the Square E2E gap)", () => {
  const page = {
    format: "catalog",
    integrations: [],
    blocks: [
      { config: { bindings: [{ collectionId: "c1" }] } },
      {
        type: { kind: "group", dispatchId: "group" },
        config: {
          coordinated: "products",
          children: [
            { config: {} },
            { config: {} },
            { config: { bindings: [{ integrationProvider: "square" }] } },
          ],
        },
      },
    ],
  };
  assert.equal(pagesNeedCart([page]), true);
});

test("pagesNeedCart: collection-only bindings / no payments anywhere -> false", () => {
  assert.equal(
    pagesNeedCart([
      { format: "catalog", blocks: [{ config: { bindings: [{ collectionId: "c1" }] } }] },
    ]),
    false,
  );
  assert.equal(pagesNeedCart([]), false);
});

test("pagesNeedCart: shopify binding does NOT mount the cart (hosted-redirect fork)", () => {
  assert.equal(
    pagesNeedCart([
      { blocks: [{ config: { bindings: [{ integrationProvider: "shopify" }] } }] },
    ]),
    false,
  );
});

// ── Storefront Phase 0.2: the inquiry-only gate ──────────────────────────
import { isInquiryOnlyPage } from "./payments.ts";

type TestBinding = { collectionId?: string; integrationProvider?: string; sectionConfig?: Record<string, unknown> };
const storefront = (bindings: TestBinding[], extra: { enabled?: boolean } = {}) => ({
  type: { kind: "page-template", dispatchId: "products" },
  config: { bindings },
  ...extra,
});
const inquiryBinding: TestBinding = { collectionId: "c-seasons", sectionConfig: { purchaseMode: "inquiry", inquiryParam: "season" } };
const inquiryPage = { format: "products", blocks: [storefront([inquiryBinding])] };

test("Phase 0.2: an inquiry-only products page mounts no bag", () => {
  assert.equal(isInquiryOnlyPage(inquiryPage), true);
  assert.equal(pagesNeedCart([inquiryPage]), false);
});

test("Phase 0.2: the coordinated grid child in inquiry mode also mounts no bag", () => {
  const grid = { type: { kind: "layout", dispatchId: "products-grid" }, config: { bindings: [inquiryBinding] } };
  const coordinated = {
    format: "products",
    blocks: [{ type: { kind: "group", dispatchId: "group" }, config: { coordinated: "products", children: [grid] } }],
  };
  assert.equal(pagesNeedCart([coordinated]), false);
});

test("Phase 0.2: inquiry on a LATER binding keeps the bag, because the listing reads the first binding", () => {
  const later = { format: "products", blocks: [storefront([{ collectionId: "c-shop" }, inquiryBinding])] };
  assert.equal(isInquiryOnlyPage(later), false);
  assert.equal(pagesNeedCart([later]), true);
});

test("Phase 0.2: a disabled inquiry storefront does not decide; the live storefront after it does", () => {
  const page = { format: "products", blocks: [storefront([inquiryBinding], { enabled: false }), storefront([{ collectionId: "c-shop" }])] };
  assert.equal(isInquiryOnlyPage(page), false);
  assert.equal(pagesNeedCart([page]), true);
});

test("Phase 0.2: a payments binding anywhere on the page keeps the bag", () => {
  const mixed = { format: "products", blocks: [storefront([inquiryBinding, { integrationProvider: "stripe" }])] };
  assert.equal(isInquiryOnlyPage(mixed), false);
  assert.equal(pagesNeedCart([mixed]), true);
  assert.equal(pagesNeedCart([{ ...inquiryPage, integrations: [{ type: "square" }] }]), true);
});

test("Phase 0.2: another selling page on the site keeps the bag", () => {
  assert.equal(pagesNeedCart([inquiryPage, { format: "products" }]), true);
});

test("Phase 0.2: inquiry mode is an exact literal", () => {
  const wrongCase = { format: "products", blocks: [storefront([{ collectionId: "c", sectionConfig: { purchaseMode: "Inquiry" } }])] };
  assert.equal(pagesNeedCart([wrongCase]), true);
  assert.equal(pagesNeedCart([{ format: "products" }]), true);
});
