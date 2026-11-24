/**
 * F557, F643 (release C, SQP-T2; design-square-parity.md 4.3 with its fix pass
 * of 2026-11-21, owners' answer `decisions.md:1170`; T-SQN-1, T-SQN-2; mockup
 * M-SQ-1): the cart's newsletter box, on a Stripe or a Square shop whose owner
 * turned on "ask to join the list". It always starts unticked; ticked sends
 * `joinList: true`.
 *
 * Read through the module namespace, so at a base without the rule each row
 * fails on its own assertion. The dialog is read as comment-stripped source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as cartAsks from "./cartAsks.ts";
import { readCartSettings } from "./cartSettings.ts";
import { stripComments } from "../source/stripComments.ts";

type Rule = {
  showsJoinBox: (settings: { askToJoinList: boolean }, provider: unknown, businessName: unknown) => boolean;
  joinBoxLabel: (name: string) => string;
};

function rule(): Rule {
  const ns = cartAsks as unknown as Record<string, unknown>; // named exports, checked below
  for (const name of ["showsJoinBox", "joinBoxLabel"]) assert.equal(typeof ns[name], "function", `cartAsks exports ${name}`);
  return ns as unknown as Rule; // the two were just checked
}

const ON = readCartSettings({ askToJoinList: true });
const OFF = readCartSettings({ askToJoinList: false });

const dialog = stripComments(fs.readFileSync(new URL("../../components/Navigation/CartDialog.tsx", import.meta.url), "utf8"));

test("ALLOW (T-SQN-1): the box shows, unticked, on a Stripe and on a Square shop with the switch on", () => {
  const { showsJoinBox } = rule();
  assert.equal(ON.askToJoinList, true, "only a stored true is on");
  assert.equal(showsJoinBox(ON, "stripe", "Juniper Lane Bakery"), true);
  assert.equal(showsJoinBox(ON, "square", "Juniper Lane Bakery"), true);
  assert.match(dialog, /const \[joinTicked, setJoinTicked\] = useState\(false\);/, "it starts unticked");
  assert.match(dialog, /\.\.\.\(joinBox && joinTicked \? \{ joinList: true as const \} : \{\}\)/, "ticked sends joinList: true");
  assert.equal(cartAsks.JOIN_BOX_LINE, "You can unsubscribe any time.");
});

test("REFUSE (T-SQN-1): no box with the switch off, on a shop with no provider, or with no business name", () => {
  const { showsJoinBox } = rule();
  assert.equal(showsJoinBox(OFF, "square", "Juniper Lane Bakery"), false);
  for (const stored of [undefined, "true", 1, null]) {
    assert.equal(readCartSettings({ askToJoinList: stored }).askToJoinList, false, `${JSON.stringify(stored)} is off`);
  }
  assert.equal(showsJoinBox(ON, null, "Juniper Lane Bakery"), false);
  assert.equal(showsJoinBox(ON, "shopify", "Juniper Lane Bakery"), false);
  assert.equal(showsJoinBox(ON, "square", "   "), false);
  assert.equal(showsJoinBox(ON, "square", undefined), false);
  assert.doesNotMatch(dialog, /useState\(true\)[^\n]*joinTicked|setJoinTicked\(true\)/, "nothing ticks it for the shopper");
});

test("ALLOW (T-SQN-2): WSQ-18 names the business and closes with one period", () => {
  const { joinBoxLabel } = rule();
  assert.equal(joinBoxLabel("Juniper Lane Bakery"), "Email me news and offers from Juniper Lane Bakery.");
  assert.equal(joinBoxLabel("Acme Co."), "Email me news and offers from Acme Co.");
  assert.equal(joinBoxLabel("St. Paul Sweets"), "Email me news and offers from St. Paul Sweets.", "a period inside keeps the closing one");
});

test("REFUSE (T-SQN-2): a name ending in ! or ? gets no added period, and no dash ever shows", () => {
  const { joinBoxLabel } = rule();
  assert.equal(joinBoxLabel("Wow Bakes!"), "Email me news and offers from Wow Bakes!");
  assert.equal(joinBoxLabel("Why Not?"), "Email me news and offers from Why Not?");
  assert.equal(joinBoxLabel("  Maple Row Co. "), "Email me news and offers from Maple Row Co.");
  assert.ok(!/[–—]/.test(joinBoxLabel("A") + cartAsks.JOIN_BOX_LINE));
});
