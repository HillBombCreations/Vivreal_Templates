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
