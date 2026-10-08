import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../lib/source/stripComments.ts";

/**
 * The component is .tsx, which `node --experimental-strip-types` cannot load,
 * so its decision is tested behaviourally in `lib/confirmedOrderCart.test.ts`
 * and this pins the wiring, which is where RW3-6 could still be silently wrong.
 */
const componentSrc = fs.readFileSync(new URL("./ClearCartOnConfirmedOrder.tsx", import.meta.url), "utf8");
const component = stripComments(componentSrc);
const page = stripComments(fs.readFileSync(new URL("../../app/[slug]/page.tsx", import.meta.url), "utf8"));

test("comment stripping did not eat the code (control)", () => {
  assert.ok(component.includes("export default function ClearCartOnConfirmedOrder"));
  assert.notEqual(component, componentSrc, "there were comments to strip");
  assert.ok(page.includes("export default async function DynamicPage"));
});

test("the slug page renders it on the checkout-success format, and never on checkout-cancel", () => {
  assert.match(page, /import ClearCartOnConfirmedOrder from "@\/components\/Checkout\/ClearCartOnConfirmedOrder"/);
  assert.match(page, /format === "checkout-success" && <ClearCartOnConfirmedOrder \/>/);
  assert.equal((page.match(/<ClearCartOnConfirmedOrder \/>/g) ?? []).length, 1, "rendered exactly once");
  assert.doesNotMatch(page, /checkout-cancel" && <ClearCartOnConfirmedOrder/, "a cancelled checkout keeps its cart");
});

test("it clears only after the stored cart has hydrated, through the tested decision", () => {
  // Before hydration the provider's IndexedDB read would put the items back.
  assert.match(component, /if \(!cartHydrated \|\| !setCart\) return;/);
  assert.match(component, /\[cartHydrated, setCart\]/, "re-runs when hydration completes");
  assert.match(component, /if \(shouldClearCartForOrder\(window\.location\.search, storage\)\) setCart\(\{\}\);/);
});

test("it tolerates a site with no cart provider", () => {
  assert.match(component, /useOptionalCart\(\)/);
  assert.doesNotMatch(component, /useCartContext\(/, "the throwing hook would crash a cartless site");
});

test("the URL is read inside the effect, never in a useState initializer", () => {
  assert.doesNotMatch(component, /useState/);
  assert.match(component, /useEffect\(\(\) => \{[\s\S]*window\.location\.search/);
});
