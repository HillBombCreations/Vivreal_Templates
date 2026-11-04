import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveOrderConfirmation,
  shopHrefFrom,
  type ShopPage,
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

// F48: the back-link is `shopHrefFrom(findShopPage(siteData.pageConfigs))`
// (`app/[slug]/page.tsx`, pinned in ConfirmedOrderGate.test.ts). The renderer's
// barrel cannot load under `node --test`, so its `findShopPage` is read from the
// INSTALLED, pinned build by file URL, and composed here exactly as the page does.
type FindShopPage = (pages: readonly (ShopPage & { format?: string; blocks?: unknown })[] | undefined | null) => ShopPage | undefined;
const linkStackUrl = new URL("../../node_modules/@hillbombcreations/site-renderer/dist/lib/linkStack.js", import.meta.url);
// Cast: a module imported by file URL is untyped; only this one export is read.
const { findShopPage } = (await import(linkStackUrl.href)) as { findShopPage: FindShopPage };
const backToShopHref = (pages: Parameters<FindShopPage>[0]) => shopHrefFrom(findShopPage(pages));

// The coordinated products group as the portal stores it on Cobalt & Crumb's /shop.
const productsGroup = {
  type: { kind: "group", dispatchId: "group" },
  enabled: true,
  config: { coordinated: "products", children: [{ type: { kind: "page-template", dispatchId: "products-grid" }, enabled: true }] },
};

test("loaded the renderer's shop rule, not nothing (control)", () => {
  assert.equal(typeof findShopPage, "function");
});

test("ALLOW: the shop link is the first switched-on products page, as before", () => {
  assert.equal(
    backToShopHref([
      { slug: "about", format: "standard" },
      { slug: "old-shop", format: "products", enabled: false },
      { slug: "shop", format: "products" },
      { slug: "more", format: "products" },
    ]),
    "/shop",
  );
});

test("F48 ALLOW: a Catalog page holding the products listing is the shop (Cobalt & Crumb's /shop)", () => {
  assert.equal(
    backToShopHref([
      { slug: "menu", format: "menu" },
      { slug: "events", format: "catalog" },
      { slug: "shop", format: "catalog", blocks: [productsGroup] },
    ]),
    "/shop",
  );
});

test("F48 REFUSE: several Catalog service pages and no products listing fall back to home", () => {
  assert.equal(
    backToShopHref([
      { slug: "injectables-fillers", format: "catalog" },
      { slug: "skin-treatments", format: "catalog" },
      { slug: "wellness", format: "catalog" },
      { slug: "about", format: "standard" },
    ]),
    "/",
  );
});

test("REFUSE: no pages, a switched-off shop, an empty slug or the home page fall back to home", () => {
  assert.equal(backToShopHref(undefined), "/");
  assert.equal(backToShopHref([]), "/");
  assert.equal(backToShopHref([{ slug: "shop", format: "products", enabled: false }]), "/");
  assert.equal(backToShopHref([{ slug: "", format: "products" }]), "/");
  assert.equal(backToShopHref([{ slug: "home", format: "catalog", blocks: [productsGroup] }]), "/");
  assert.equal(shopHrefFrom(undefined), "/");
  assert.equal(shopHrefFrom({ slug: "shop", enabled: false }), "/", "never a switched-off page, whoever picked it");
});
