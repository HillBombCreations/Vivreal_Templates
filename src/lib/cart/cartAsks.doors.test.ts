/**
 * Release C, SQP-T3 (design-square-parity.md FP1.4, widened by its fix pass
 * of 2026-11-21; T-SQQ-3; mockup M-SQ-1 frames E1, E2, G): the two quick
 * checkout doors, Buy now and the "Added to bag" card, open the cart when it
 * asks something the payment page will not: the newsletter box (either
 * provider), or a product question on a Square shop. A QUESTION_REQUIRED
 * refusal on either door opens the cart, never a dead end.
 *
 * The rules are read through the module namespaces, so at a base without them
 * each row fails on its own assertion. The doors are `use client` modules,
 * read as comment-stripped source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as cartAsks from "./cartAsks.ts";
import { cartNeedsChoices, readCartSettings } from "./cartSettings.ts";
import { parseCartQuote } from "../cartQuote.ts";
import { stripComments } from "../source/stripComments.ts";

type NeedsWithAsks = (settings: ReturnType<typeof readCartSettings>, ways: { deliveryOn: boolean; ships: boolean }, asks?: { square: boolean; lineAsks: boolean }) => boolean;

function quoteAsksQuestion(): (quote: unknown) => boolean {
  const ns = cartAsks as unknown as Record<string, unknown>; // named exports, checked below
  assert.equal(typeof ns.quoteAsksQuestion, "function", "cartAsks exports quoteAsksQuestion");
  return ns.quoteAsksQuestion as (quote: unknown) => boolean; // checked above
}

const needs = cartNeedsChoices as unknown as NeedsWithAsks; // the third argument is new in release C; a base ignores it
const WAYS = { deliveryOn: false, ships: false };
const PLAIN = readCartSettings(undefined);
const TICK_ON = readCartSettings({ askToJoinList: true });

const question = (q: unknown) => parseCartQuote({ lines: [{ priceId: "SQVAR_1", unitCents: 2400, saleUnitCents: null, saleName: null, question: q }] });

const adapter = stripComments(fs.readFileSync(new URL("../cartAdapter.ts", import.meta.url), "utf8"));
const card = stripComments(fs.readFileSync(new URL("../../components/PageTemplates/ProductDetailClient/FloatingCartDialog.tsx", import.meta.url), "utf8"));

test("ALLOW (T-SQQ-3): Buy now with no question and the tick switch off posts checkout as today, on Square and on Stripe", () => {
  assert.equal(needs(PLAIN, WAYS), false, "a plain cart: straight to checkout");
  assert.equal(needs(PLAIN, WAYS, { square: true, lineAsks: false }), false, "a Square product with no question");
  assert.equal(quoteAsksQuestion()(question(null)), false, "the quote names no question");
});

test("REFUSE (T-SQQ-3): Buy now opens the cart for a Square product with a question, and for the tick switch on either provider", () => {
  assert.equal(quoteAsksQuestion()(question({ question: "Which cookies go in your box?", required: true })), true);
  assert.equal(needs(PLAIN, WAYS, { square: true, lineAsks: true }), true, "a Square product with a question");
  assert.equal(needs(TICK_ON, WAYS), true, "the tick switch on, Stripe or Square");
  assert.equal(needs(PLAIN, WAYS, { square: false, lineAsks: true }), false, "control: a Stripe product's question is Stripe's page's");
  assert.equal(quoteAsksQuestion()(null), true, "a failed quote cannot tell, so the cart opens and asks again");
  // Buy now asks the quote for its one line on a Square shop, before any checkout.
  const asked = adapter.indexOf("quoteAsksQuestion(await fetchCartQuote([{ price: priceID, quantity }]))");
  const posted = adapter.indexOf("await handleCheckout(");
  assert.ok(asked > 0 && posted > asked, "Buy now decides before it posts checkout");
  assert.match(adapter, /if \(needsCart\) \{\s*addAndOpenCart\(\);\s*return;\s*\}/);
});

test("REFUSE (T-SQQ-3): the Added to bag card opens the cart for the tick switch, and on Square for a question in the bag", () => {
  assert.match(card, /if \(cartNeedsChoices\(settings, ways\)\) \{\s*handleOpenCart\(\);\s*return;\s*\}/, "the tick switch, either provider");
  const asked = card.indexOf("lineAsks: quoteAsksQuestion(await fetchCartQuote(lines))");
  const posted = card.indexOf("await handleCheckout(");
  assert.ok(asked > 0 && posted > asked, "the card decides before it posts checkout");
  assert.match(card, /siteData\?\.paymentsProvider === "square"/, "the question check is Square's only");
});

test("REFUSE (T-SQQ-3): a QUESTION_REQUIRED answer on either door opens the cart", () => {
  assert.match(adapter, /if \(err instanceof CheckoutShopRuleError && err\.code === "QUESTION_REQUIRED"\) \{\s*addAndOpenCart\(\);\s*return;\s*\}/);
  assert.match(card, /if \(error instanceof CheckoutShopRuleError && error\.code === "QUESTION_REQUIRED"\) \{\s*handleOpenCart\(\);\s*return;\s*\}/);
});
