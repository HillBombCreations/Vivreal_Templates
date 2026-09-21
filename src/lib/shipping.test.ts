import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shipsOrders,
  declaresPickupOnly,
  verifiableFulfilmentClaim,
  type FulfilmentClaim,
} from "./shipping.ts";

/**
 * The two expressions that used to decide `requiresShipping` inline, kept as
 * the control. H35 was that these two disagreed on exactly one input.
 */
const cartReading = (b?: { shipping?: boolean } | null) => !!b?.shipping;
const buyNowReading = (b?: { shipping?: boolean } | null) => b?.shipping !== false;

test("H35 DECISION: unset means the business does NOT ship", () => {
  // The case the whole item was about. Read the decision in shipping.ts before
  // changing this line: it is chosen for the service-business majority, who
  // never ship and never touch the field.
  assert.equal(shipsOrders({}), false);
  assert.equal(shipsOrders(undefined), false);
  assert.equal(shipsOrders(null), false);
  assert.equal(shipsOrders({ shipping: undefined }), false);
});

test("H35 CONTROL: this goes red if the default is flipped back", () => {
  // A helper that defaulted unset to "ships" would pass every other test in
  // this file, because every other case sets the field. This is the one that
  // would not, so it is the one that guards the decision.
  const flippedBack = (b?: { shipping?: boolean } | null) => b?.shipping !== false;
  assert.equal(flippedBack({}), true, "the control itself is wrong");
  assert.notEqual(
    shipsOrders({}),
    flippedBack({}),
    "shipsOrders now matches the OLD Buy Now default, so H35 has regressed",
  );
});

test("an explicit value is honoured in both directions", () => {
  assert.equal(shipsOrders({ shipping: true }), true);
  assert.equal(shipsOrders({ shipping: false }), false);
});

test("H35: the two old readings disagreed on exactly one input, and that input is unset", () => {
  // Proves the bug was real and names its single trigger, so nobody has to
  // take the item's word for it.
  const inputs: Array<{ shipping?: boolean } | null | undefined> = [
    { shipping: true },
    { shipping: false },
    {},
    undefined,
    null,
  ];
  const disagreed = inputs.filter((b) => cartReading(b) !== buyNowReading(b));
  assert.equal(disagreed.length, 3, "expected the unset-shaped inputs to disagree");
  for (const b of disagreed) {
    assert.equal(b?.shipping, undefined, "a SET value disagreed, which is a different bug");
  }
  // And the survivor is the cart's reading, on every input.
  for (const b of inputs) {
    assert.equal(shipsOrders(b), cartReading(b), JSON.stringify(b));
  }
});

test("declaresPickupOnly is NOT the inverse of shipsOrders", () => {
  // The distinction both functions exist for. Silence is a usable answer for
  // "collect an address"; it is not permission to advertise "Pickup only".
  assert.equal(shipsOrders({}), false);
  assert.equal(declaresPickupOnly({}), false, "silence must not become a claim");

  assert.equal(declaresPickupOnly({ shipping: false }), true);
  assert.equal(declaresPickupOnly({ shipping: true }), false);
  assert.equal(declaresPickupOnly(undefined), false);
  assert.equal(declaresPickupOnly(null), false);
});

test("the two differ on exactly the unset case, and nowhere else", () => {
  // If these ever collapse into each other, one of them is redundant and the
  // "Pickup only" badge has started being inferred from silence.
  const inputs: Array<{ shipping?: boolean } | null | undefined> = [
    { shipping: true },
    { shipping: false },
    {},
    undefined,
    null,
  ];
  const differ = inputs.filter((b) => !shipsOrders(b) !== declaresPickupOnly(b));
  assert.ok(differ.length > 0, "the two functions have collapsed into inverses");
  for (const b of differ) {
    assert.equal(b?.shipping, undefined);
  }
});

/* ------------------------------------------------------------------ */
/* The honesty floor on the hero fulfilment badge                      */
/* ------------------------------------------------------------------ */

test("HONESTY FLOOR: an unset flag asserts NOTHING about fulfilment", () => {
  // The case that matters. "Fast delivery" is contradicted at checkout, and
  // "Pickup available" is a different unverified claim, false for the salons
  // and trades this default was chosen for. Silence is the only honest answer.
  assert.equal(verifiableFulfilmentClaim({}), null);
  assert.equal(verifiableFulfilmentClaim(undefined), null);
  assert.equal(verifiableFulfilmentClaim(null), null);
  assert.equal(verifiableFulfilmentClaim({ shipping: undefined }), null);
});

test("a claim is made only when the owner actually told us", () => {
  assert.equal(verifiableFulfilmentClaim({ shipping: true }), "ships");
  assert.equal(verifiableFulfilmentClaim({ shipping: false }), "pickup");
});

test("SILENCE IS THE DEFAULT, not a special case for one known value", () => {
  // The requirement is that a value nobody anticipated is safe WITHOUT anyone
  // remembering to handle it. So feed the function inputs it was never written
  // for: anything that is not an explicit true or false must come back null.
  const unanticipated: unknown[] = [
    {},
    { shipping: null },
    { shipping: 0 },
    { shipping: 1 },
    { shipping: "true" },
    { shipping: "false" },
    { shipping: "pickup" },
    { shipping: [] },
    { shipping: {} },
    { shipping: NaN },
  ];
  for (const input of unanticipated) {
    const claim = verifiableFulfilmentClaim(input as { shipping?: boolean });
    assert.equal(
      claim,
      null,
      `${JSON.stringify(input)} produced the claim "${claim}"; silence must be the fall-through`,
    );
  }
});

test("CONTROL: this would catch a badge that guesses on unset", () => {
  // The exact shape that shipped before this change, and the one a future
  // edit is most likely to reintroduce. If it ever passes, the honesty floor
  // has gone.
  const guessing = (b?: { shipping?: boolean } | null): FulfilmentClaim =>
    shipsOrders(b) ? "ships" : "pickup";
  assert.equal(guessing({}), "pickup", "the control itself is wrong");
  assert.notEqual(
    verifiableFulfilmentClaim({}),
    guessing({}),
    "the badge has gone back to guessing on an unset flag",
  );
});

test("the claim never disagrees with what checkout actually does", () => {
  // A badge saying "ships" while checkout collects no address is the original
  // contradiction. These two must never drift apart again.
  for (const b of [{ shipping: true }, { shipping: false }, {}, undefined, null]) {
    if (verifiableFulfilmentClaim(b) === "ships") {
      assert.equal(shipsOrders(b), true, `claimed delivery but ${JSON.stringify(b)} collects no address`);
    }
    if (verifiableFulfilmentClaim(b) === "pickup") {
      assert.equal(shipsOrders(b), false, "claimed pickup while checkout collects an address");
    }
  }
});

/* ------------------------------------------------------------------ */
/* The guard against the bug class coming back                         */
/* ------------------------------------------------------------------ */

import fs from "node:fs";
import path from "node:path";
import { stripComments } from "./source/stripComments.ts";

const SRC = path.resolve(import.meta.dirname, "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The inline shapes this module replaced. Comments are stripped first. */
const INLINE_READINGS = [
  /\.shipping\s*!==\s*false/,
  /!!\s*\w+(\?\.)?\.?businessInfo\?\.shipping/,
  /!!\s*businessInfo\?\.shipping/,
  /\.shipping\s*===\s*false/,
  /\.shipping\s*\?\s*["']/,
];

test("no call site reads businessInfo.shipping inline any more", () => {
  const files = sourceFiles(SRC).filter(
    (f) => path.basename(f) !== "shipping.ts",
  );
  assert.ok(files.length > 100, `only scanned ${files.length} files, the walk is broken`);

  const offenders: string[] = [];
  for (const file of files) {
    const code = stripComments(fs.readFileSync(file, "utf8"));
    for (const shape of INLINE_READINGS) {
      if (shape.test(code)) {
        offenders.push(`${path.relative(SRC, file)} matches ${shape}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `read the decision in lib/shipping.ts, then call shipsOrders() or declaresPickupOnly():\n${offenders.join("\n")}`,
  );
});

test("that scan can actually fail (control)", () => {
  // A walk that found nothing, or regexes that match nothing, would report the
  // tree clean forever. Both halves are proved here on the real old code.
  const oldBuyNow = "requiresShipping: siteData?.businessInfo?.shipping !== false,";
  const oldCart = "requiresShipping: !!businessInfo?.shipping,";
  const oldBadge = "const hasNoShipping = businessInfo && businessInfo?.shipping === false;";
  assert.ok(INLINE_READINGS.some((r) => r.test(oldBuyNow)), "Buy Now shape not detected");
  assert.ok(INLINE_READINGS.some((r) => r.test(oldCart)), "cart shape not detected");
  assert.ok(INLINE_READINGS.some((r) => r.test(oldBadge)), "badge shape not detected");
});

test("every shipping decision in the tree now goes through the helper", () => {
  // The other direction: the rule is not merely absent, it is CALLED.
  const callers = sourceFiles(SRC).filter((f) =>
    /from "@\/lib\/shipping"/.test(fs.readFileSync(f, "utf8")),
  );
  assert.ok(
    callers.length >= 6,
    `only ${callers.length} modules import the helper; there were 7 inline readings`,
  );
});
