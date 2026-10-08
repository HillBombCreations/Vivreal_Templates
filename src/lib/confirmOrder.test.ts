import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { confirmOrder, type ConfirmResponse } from "./confirmOrder.ts";
import { stripComments } from "./source/stripComments.ts";

/**
 * The answer cache is module scope, so every test uses its own order ids.
 */
const reply = (ok: boolean, body: unknown): ConfirmResponse => ({ ok, json: async () => body });

test("ALLOW (a): the route's `confirmed` outcome is a confirmed order", async () => {
  const ok = reply(true, { sent: true, confirmed: true, outcome: "confirmed" });
  assert.equal(await confirmOrder("cs_allow_1", async () => ok), "confirmed");
});

test("(c): the route's positive no is `no-paid-order`", async () => {
  const no = reply(true, { sent: false, reason: "upstream", outcome: "no-paid-order" });
  assert.equal(await confirmOrder("cs_nopaid_1", async () => no), "no-paid-order");
  assert.equal(await confirmOrder("SqNoPaid0001", async () => no), "no-paid-order");
});

test("(b): anything else is `unverified`, never confirmed and never a positive no", async () => {
  const answers: Array<[string, ConfirmResponse]> = [
    ["cs_unv_outcome", reply(true, { sent: false, reason: "unreachable", outcome: "unverified" })],
    ["cs_unv_sent_only", reply(true, { sent: true })],
    ["cs_unv_false", reply(true, { sent: true, confirmed: false })],
    ["cs_unv_truthy", reply(true, { confirmed: "true" })],
    ["cs_unv_bad_outcome", reply(true, { outcome: "CONFIRMED" })],
    ["cs_unv_bad_request", reply(false, { confirmed: true, outcome: "confirmed" })],
    ["cs_unv_null", reply(true, null)],
    ["cs_unv_string", reply(true, "confirmed")],
  ];
  for (const [id, res] of answers) {
    assert.equal(await confirmOrder(id, async () => res), "unverified", id);
  }
  const unreadable: ConfirmResponse = { ok: true, json: async () => { throw new SyntaxError("bad json"); } };
  assert.equal(await confirmOrder("cs_unv_unreadable", async () => unreadable), "unverified");
});

test("a route answer without `outcome` (a tab open across a deploy) still reads `confirmed: true`", async () => {
  assert.equal(await confirmOrder("cs_legacy_1", async () => reply(true, { sent: true, confirmed: true })), "confirmed");
});

test("one request per order: the receipt trigger and the cart clear share it", async () => {
  let posts = 0;
  const post = async () => {
    posts += 1;
    return reply(true, { confirmed: true, outcome: "confirmed" });
  };
  const [a, b] = await Promise.all([confirmOrder("cs_shared_1", post), confirmOrder("cs_shared_1", post)]);
  assert.deepEqual([a, b], ["confirmed", "confirmed"]);
  assert.equal(await confirmOrder("cs_shared_1", post), "confirmed");
  assert.equal(posts, 1);
  // A different order is its own request.
  await confirmOrder("cs_shared_2", post);
  assert.equal(posts, 2);
});

test("a network failure is unverified and is retried on the next call; any other answer is final", async () => {
  let posts = 0;
  const flaky = async () => {
    posts += 1;
    if (posts === 1) throw new TypeError("Failed to fetch");
    return reply(true, { confirmed: true, outcome: "confirmed" });
  };
  assert.equal(await confirmOrder("cs_retry_1", flaky), "unverified");
  assert.equal(await confirmOrder("cs_retry_1", flaky), "confirmed");
  assert.equal(posts, 2);

  let refusals = 0;
  const refusing = async () => {
    refusals += 1;
    return reply(true, { confirmed: false, outcome: "no-paid-order" });
  };
  await confirmOrder("cs_final_1", refusing);
  await confirmOrder("cs_final_1", refusing);
  assert.equal(refusals, 1);
});

test("the default request posts the id to the confirm route, keepalive, and nowhere else", () => {
  const code = stripComments(fs.readFileSync(new URL("./confirmOrder.ts", import.meta.url), "utf8"));
  assert.match(code, /fetch\("\/api\/checkout\/confirm"/);
  assert.match(code, /keepalive: true/);
  assert.match(code, /body: JSON\.stringify\(\{ sessionId \}\)/);
  const fetches = [...code.matchAll(/fetch\(\s*["'`]([^"'`]+)/g)].map((m) => m[1]);
  assert.deepEqual(fetches, ["/api/checkout/confirm"]);
  assert.doesNotMatch(code, /sessionStorage|localStorage/, "not persisted, so a reload retries");
});
