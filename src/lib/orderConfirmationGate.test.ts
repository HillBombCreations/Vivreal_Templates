import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveOrderConfirmation,
  shopHrefFor,
  ORDER_CHECKING_COPY,
  ORDER_NOT_FOUND_HEADING,
  ORDER_NOT_FOUND_BODY,
  BACK_TO_SHOP_COPY,
} from "./orderConfirmationGate.ts";

const STRIPE = "cs_test_a1B2c3D4e5F6";
const SQUARE = "Xk9pQ2mNz7Lr4TbW";

async function land(search: string, answer: boolean | Error) {
  const asked: string[] = [];
  const status = await resolveOrderConfirmation({
    search,
    confirm: async (id) => {
      asked.push(id);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { status, asked };
}

test("ALLOW: a Stripe session the server confirms paid shows the confirmation", async () => {
  assert.deepEqual(await land(`?session_id=${STRIPE}`, true), { status: "confirmed", asked: [STRIPE] });
});

test("ALLOW: a Square order the server confirms paid shows the confirmation", async () => {
  assert.deepEqual(await land(`?session_id=${SQUARE}`, true), { status: "confirmed", asked: [SQUARE] });
});

test("REFUSE (TB-5): a crafted session id the server does not confirm never shows it", async () => {
  const fake = "cs_test_TBcraftedFAKE";
  assert.deepEqual(await land(`?session_id=${fake}`, false), { status: "unconfirmed", asked: [fake] });
});

test("REFUSE: an unconfirmed Square-shaped id never shows it", async () => {
  assert.deepEqual(await land(`?session_id=${SQUARE}`, false), { status: "unconfirmed", asked: [SQUARE] });
});

test("REFUSE: no id, an empty id, or a malformed id is never posted and never confirmed", async () => {
  for (const search of ["", "?session_id=", "?session_id=cs_", "?session_id=../../x", "?other=cs_test_abc", "?session_id=short"]) {
    assert.deepEqual(await land(search, true), { status: "unconfirmed", asked: [] }, search);
  }
});

test("REFUSE: a confirm that throws is not a confirmation", async () => {
  assert.equal((await land(`?session_id=${STRIPE}`, new Error("boom"))).status, "unconfirmed");
});

test("the neutral copy is the agreed sentence, with no dashes and no order details", () => {
  assert.equal(
    `${ORDER_NOT_FOUND_HEADING} ${ORDER_NOT_FOUND_BODY}`,
    "We could not find that order. If you paid, check your email for a receipt.",
  );
  for (const line of [ORDER_CHECKING_COPY, ORDER_NOT_FOUND_HEADING, ORDER_NOT_FOUND_BODY, BACK_TO_SHOP_COPY]) {
    assert.doesNotMatch(line, /[–—]/);
    assert.doesNotMatch(line, /confirmed|thank you/i);
  }
});

test("the shop link is the first switched-on products page", () => {
  assert.equal(
    shopHrefFor([
      { slug: "about", format: "standard" },
      { slug: "old-shop", format: "products", enabled: false },
      { slug: "shop", format: "products" },
      { slug: "more", format: "products" },
    ]),
    "/shop",
  );
});

test("the shop link falls back to home when there is no usable products page", () => {
  assert.equal(shopHrefFor(undefined), "/");
  assert.equal(shopHrefFor([]), "/");
  assert.equal(shopHrefFor([{ slug: "shop", format: "products", enabled: false }]), "/");
  assert.equal(shopHrefFor([{ slug: "", format: "products" }]), "/");
});
