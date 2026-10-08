import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveOrderConfirmation,
  shopHrefFor,
  statusAfterTimeout,
  UNCONFIRMED_COPY,
  ORDER_CHECKING_COPY,
  ORDER_CHECK_TIMEOUT_MS,
  ORDER_UNVERIFIED_HEADING,
  ORDER_UNVERIFIED_BODY,
  NO_PAID_ORDER_HEADING,
  NO_PAID_ORDER_BODY,
  BACK_TO_SHOP_COPY,
} from "./orderConfirmationGate.ts";
import type { OrderCheck } from "./orderConfirmationId.ts";

const STRIPE = "cs_test_a1B2c3D4e5F6";
const SQUARE = "Xk9pQ2mNz7Lr4TbW";

async function land(search: string, answer: OrderCheck | Error) {
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

for (const [provider, id] of [["Stripe", STRIPE], ["Square", SQUARE]] as const) {
  test(`ALLOW (a): a ${provider} order the server confirms paid shows the confirmation`, async () => {
    assert.deepEqual(await land(`?session_id=${id}`, "confirmed"), { status: "confirmed", asked: [id] });
  });

  test(`REFUSE (b): a ${provider} order nobody could check is "unverified", never the card or "not found"`, async () => {
    assert.deepEqual(await land(`?session_id=${id}`, "unverified"), { status: "unverified", asked: [id] });
    assert.equal((await land(`?session_id=${id}`, new Error("boom"))).status, "unverified", "a throwing confirm");
  });

  test(`REFUSE (c): a ${provider} id the server positively has no paid order for is "no-paid-order"`, async () => {
    assert.deepEqual(await land(`?session_id=${id}`, "no-paid-order"), { status: "no-paid-order", asked: [id] });
  });
}

test("REFUSE (TB-5): a crafted session id the server does not confirm never shows the card", async () => {
  const fake = "cs_test_TBcraftedFAKE";
  assert.deepEqual(await land(`?session_id=${fake}`, "no-paid-order"), { status: "no-paid-order", asked: [fake] });
});

test("REFUSE (b): no id (a Square return link without one), an empty or malformed id is never posted, and is unverified", async () => {
  for (const search of ["", "?session_id=", "?session_id=cs_", "?session_id=../../x", "?other=cs_test_abc", "?session_id=short"]) {
    assert.deepEqual(await land(search, "confirmed"), { status: "unverified", asked: [] }, search);
  }
});

test("a check still running at the timeout is unverified; a settled answer is never overwritten", () => {
  assert.equal(statusAfterTimeout("checking"), "unverified");
  for (const settled of ["confirmed", "unverified", "no-paid-order"] as const) {
    assert.equal(statusAfterTimeout(settled), settled);
  }
  assert.ok(ORDER_CHECK_TIMEOUT_MS > 5_000, "longer than VR_Client_API's own 5 s Square read");
});

test("(b) reassures and (c) is neutral, in the agreed words", () => {
  assert.deepEqual(UNCONFIRMED_COPY.unverified, {
    heading: "Thanks for your order.",
    body: "We could not show the confirmation here, but if you paid, the shop has your order and you will get a receipt by email.",
  });
  assert.deepEqual(UNCONFIRMED_COPY["no-paid-order"], {
    heading: "We could not find a paid order for this link.",
    body: "If you paid, check your email for a receipt.",
  });
});

test("REFUSE: no unconfirmed line says the order does not exist, congratulates, or has dashes", () => {
  const lines = [
    ORDER_CHECKING_COPY,
    ORDER_UNVERIFIED_HEADING,
    ORDER_UNVERIFIED_BODY,
    NO_PAID_ORDER_HEADING,
    NO_PAID_ORDER_BODY,
    BACK_TO_SHOP_COPY,
  ];
  for (const line of lines) {
    assert.doesNotMatch(line, /[\u2013\u2014]/);
    assert.doesNotMatch(line, /order confirmed|could not find that order/i);
  }
  // Control: the patterns do catch the sentences this replaced.
  assert.match("We could not find that order.", /could not find that order/i);
  assert.match("Order confirmed!", /order confirmed/i);
  assert.match("a \u2014 b", /[\u2013\u2014]/);
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
