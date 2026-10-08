import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../lib/source/stripComments.ts";

/**
 * The component is .tsx, which `node --experimental-strip-types` cannot load,
 * so its decision is tested behaviourally in `lib/orderConfirmationGate.test.ts`
 * and this pins the wiring (TB-5).
 */
const componentSrc = fs.readFileSync(new URL("./ConfirmedOrderGate.tsx", import.meta.url), "utf8");
const component = stripComments(componentSrc);
const page = stripComments(fs.readFileSync(new URL("../../app/[slug]/page.tsx", import.meta.url), "utf8"));

test("comment stripping did not eat the code (control)", () => {
  assert.ok(component.includes("export default function ConfirmedOrderGate"));
  assert.notEqual(component, componentSrc, "there were comments to strip");
  assert.ok(page.includes("export default async function DynamicPage"));
});

test("the success page body renders only through the gate, and the cancel page never through it", () => {
  assert.match(page, /import ConfirmedOrderGate from "@\/components\/Checkout\/ConfirmedOrderGate"/);
  assert.match(
    page,
    /format === "checkout-success" \? \(\s*<ConfirmedOrderGate shopHref=\{shopHrefFor\(siteData\.pageConfigs\)\}>\{composedBody\}<\/ConfirmedOrderGate>\s*\) : \(\s*composedBody\s*\)/,
  );
  assert.equal((page.match(/<ConfirmedOrderGate /g) ?? []).length, 1, "rendered exactly once");
  assert.doesNotMatch(page, /checkout-cancel"[^\n]*ConfirmedOrderGate/);
});

test("REFUSE: the children (the congratulations card) render only on a confirmed status", () => {
  assert.match(component, /if \(status === "confirmed"\) return <>\{children\}<\/>;/);
  assert.equal((component.match(/\{children\}/g) ?? []).length, 1, "no other path renders the card");
  assert.match(component, /useState<OrderConfirmationStatus>\("checking"\)/, "starts unconfirmed on server and client");
});

test("it decides through the shared server confirmation, reading the URL in the effect", () => {
  assert.match(component, /import \{ confirmOrder \} from "@\/lib\/confirmOrder"/);
  assert.match(
    component,
    /useEffect\(\(\) => \{[\s\S]*resolveOrderConfirmation\(\{ search: window\.location\.search, confirm: confirmOrder \}\)/,
  );
});

test("the unconfirmed state links back to the shop with the neutral copy", () => {
  assert.match(component, /<Link\s+href=\{shopHref\}/);
  assert.match(component, /\{ORDER_NOT_FOUND_HEADING\}/);
  assert.match(component, /\{ORDER_NOT_FOUND_BODY\}/);
  assert.match(component, /\{BACK_TO_SHOP_COPY\}/);
});
