/**
 * F642 (release C, SQP-T1; design-square-parity.md 3.3, T-SQQ-1, T-SQQ-2;
 * mockup M-SQ-1): a Square shop's product questions are asked in the cart.
 *
 * The rule is read through the module namespace, so at a base without it each
 * row fails on its own assertion rather than the file failing to load. The
 * quote is read through the real `parseCartQuote`; the dialog, a `use client`
 * module, is read as comment-stripped source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as cartAsks from "./cartAsks.ts";
import { parseCartQuote } from "../cartQuote.ts";
import { SHOP_RULE_SENTENCES, checkoutRefusal } from "../checkoutRequest.ts";
import { stripComments } from "../source/stripComments.ts";

type Question = { productId: string; line: string; question: string; required: boolean };
type Rule = {
  cartQuestions: (items: ReadonlyArray<{ _id?: string; priceID?: string }>, quote: unknown, provider: unknown) => Question[];
  unansweredRequired: (questions: readonly Question[], answers: Record<string, string>) => Question | null;
  checkoutAnswers: (questions: readonly Question[], answers: Record<string, string>) => Array<{ line: string; answer: string }>;
};

function rule(): Rule {
  const ns = cartAsks as unknown as Record<string, unknown>; // named exports, checked below
  for (const name of ["cartQuestions", "unansweredRequired", "checkoutAnswers"]) assert.equal(typeof ns[name], "function", `cartAsks exports ${name}`);
  return ns as unknown as Rule; // the three were just checked
}

const COOKIES = "6a0000000000000000000b01";
const CAKE = "6a0000000000000000000b02";
const LOAF = "6a0000000000000000000b03";

/** VR_Client_API's quote for a Square bag: two products with a question, one without (contract C6 plus SV-SQ10). */
const SQUARE_QUOTE = parseCartQuote({
  lines: [
    { priceId: "SQVAR_COOKIES", unitCents: 2400, saleUnitCents: null, saleName: null, question: { question: "Which cookies go in your box?", required: true } },
    { priceId: "SQVAR_CAKE_8", unitCents: 3800, saleUnitCents: null, saleName: null, question: { question: "What name goes on the cake?", required: false } },
    { priceId: "SQVAR_CAKE_10", unitCents: 4800, saleUnitCents: null, saleName: null, question: { question: "What name goes on the cake?", required: false } },
    { priceId: "SQVAR_LOAF", unitCents: 900, saleUnitCents: null, saleName: null, question: null },
  ],
});

const BAG = [
  { _id: COOKIES, priceID: "SQVAR_COOKIES" },
  { _id: CAKE, priceID: "SQVAR_CAKE_8" },
  { _id: CAKE, priceID: "SQVAR_CAKE_10" },
  { _id: LOAF, priceID: "SQVAR_LOAF" },
];

const dialog = stripComments(fs.readFileSync(new URL("../../components/Navigation/CartDialog.tsx", import.meta.url), "utf8"));

test("ALLOW (T-SQQ-1): a Square cart asks each question product once, in cart order, with the question as written", () => {
  assert.deepEqual(rule().cartQuestions(BAG, SQUARE_QUOTE, "square"), [
    { productId: COOKIES, line: "SQVAR_COOKIES", question: "Which cookies go in your box?", required: true },
    { productId: CAKE, line: "SQVAR_CAKE_8", question: "What name goes on the cake?", required: false },
  ]);
  assert.match(dialog, /\{questions\.map\(\(q\) => \{/, "the dialog draws a box per question");
  assert.match(dialog, /<span className="min-w-0 break-words">\{q\.question\}<\/span>/, "labelled with the owner's question");
  assert.match(dialog, /\{q\.required \? null : <span[^>]*>\{QUESTION_OPTIONAL\}<\/span>\}/, "an optional one says Optional");
  assert.equal(cartAsks.ANSWER_PLACEHOLDER, "Your answer");
  assert.equal(cartAsks.QUESTION_OPTIONAL, "Optional");
});

test("REFUSE (T-SQQ-1): a Stripe cart, a cart with no quote, and a fourth question product draw no box", () => {
  const { cartQuestions } = rule();
  assert.deepEqual(cartQuestions(BAG, SQUARE_QUOTE, "stripe"), [], "Stripe's own page asks");
  assert.deepEqual(cartQuestions(BAG, SQUARE_QUOTE, undefined), []);
  assert.deepEqual(cartQuestions(BAG, null, "square"), [], "a failed quote asks nothing; checkout's backstop re-quotes");
  const four = parseCartQuote({
    lines: [1, 2, 3, 4].map((n) => ({ priceId: `SQ${n}`, unitCents: 100, saleUnitCents: null, saleName: null, question: { question: `Q${n}?`, required: false } })),
  });
  const asked = cartQuestions([1, 2, 3, 4].map((n) => ({ _id: `p${n}`, priceID: `SQ${n}` })), four, "square");
  assert.deepEqual(asked.map((q) => q.question), ["Q1?", "Q2?", "Q3?"], "at most three");
  // A malformed or blank question from the quote is no question.
  const bad = parseCartQuote({ lines: [{ priceId: "SQ9", unitCents: 100, saleUnitCents: null, saleName: null, question: { question: "   ", required: true } }] });
  assert.deepEqual(cartQuestions([{ _id: "p9", priceID: "SQ9" }], bad, "square"), []);
});

test("ALLOW (T-SQQ-2): the answers ride checkout as extras.answers, trimmed, on the product's first line", () => {
  const { cartQuestions, checkoutAnswers, unansweredRequired } = rule();
  const asked = cartQuestions(BAG, SQUARE_QUOTE, "square");
  const answers = { [COOKIES]: "  Chocolate chip and oatmeal  ", [CAKE]: "" };
  assert.equal(unansweredRequired(asked, answers), null, "the optional one may stay blank");
  assert.deepEqual(checkoutAnswers(asked, answers), [{ line: "SQVAR_COOKIES", answer: "Chocolate chip and oatmeal" }]);
  assert.equal(checkoutAnswers(asked, { [COOKIES]: "x".repeat(400) })[0].answer.length, 255, "cut to 255");
  assert.match(dialog, /\.\.\.\(sentAnswers\.length > 0 \? \{ answers: sentAnswers \} : \{\}\)/, "sent only when there is one");
});

test("REFUSE (T-SQQ-2): an empty required box holds Checkout with WSQ-13 and sends nothing", () => {
  const { cartQuestions, unansweredRequired } = rule();
  const asked = cartQuestions(BAG, SQUARE_QUOTE, "square");
  assert.equal(unansweredRequired(asked, { [COOKIES]: "   " })?.productId, COOKIES);
  assert.equal(cartAsks.ANSWER_NEEDED, "Answer this question to check out.");
  const held = dialog.indexOf("const missing = unansweredRequired(asked, answers);");
  const sent = dialog.indexOf("await handleCheckout({", held);
  assert.ok(held > 0 && sent > held, "the check runs before checkout is sent");
  assert.match(dialog.slice(held, sent), /if \(missing\) \{[\s\S]*?return;\s*\}/, "and returns before it");
});

test("ALLOW and REFUSE (QUESTION_REQUIRED): the refusal is a shop rule in WSQ-14's words, and the cart re-quotes", () => {
  assert.equal(SHOP_RULE_SENTENCES.QUESTION_REQUIRED, "Please answer the question in your cart, then check out again.");
  const refusal = checkoutRefusal(409, "anything upstream said", { errorCode: "QUESTION_REQUIRED" });
  assert.equal(refusal.error, SHOP_RULE_SENTENCES.QUESTION_REQUIRED, "our words, never the upstream sentence");
  assert.equal(refusal.code, "QUESTION_REQUIRED");
  assert.notEqual(checkoutRefusal(409, "x", { errorCode: "QUESTION_REQUIRED_NOT" }).code, "QUESTION_REQUIRED", "control: another code is not it");
  assert.match(dialog, /if \(err instanceof CheckoutShopRuleError && err\.code === "QUESTION_REQUIRED"\) \{\s*setRuleNotice\(err\.message\);\s*const again = await requote\(\);/);
});
