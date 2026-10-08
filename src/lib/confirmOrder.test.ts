import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { confirmOrder, type ConfirmResponse } from "./confirmOrder.ts";
import { stripComments } from "./source/stripComments.ts";

/**
 * The answer cache is module scope, so every test uses its own order ids.
 */
const reply = (ok: boolean, body: unknown): ConfirmResponse => ({ ok, json: async () => body });

test("ALLOW: `confirmed: true` from the route is a confirmed order", async () => {
  assert.equal(await confirmOrder("cs_allow_1", async () => reply(true, { sent: true, confirmed: true })), true);
});

test("REFUSE: anything short of `confirmed: true` is not confirmed", async () => {
  const answers: Array<[string, ConfirmResponse]> = [
    ["cs_refuse_sent_only", reply(true, { sent: true })],
    ["cs_refuse_false", reply(true, { sent: true, confirmed: false })],
    ["cs_refuse_truthy", reply(true, { confirmed: "true" })],
    ["cs_refuse_bad_request", reply(false, { confirmed: true })],
    ["cs_refuse_null", reply(true, null)],
    ["cs_refuse_string", reply(true, "confirmed")],
  ];
  for (const [id, res] of answers) {
    assert.equal(await confirmOrder(id, async () => res), false, id);
  }
  const unreadable: ConfirmResponse = { ok: true, json: async () => { throw new SyntaxError("bad json"); } };
  assert.equal(await confirmOrder("cs_refuse_unreadable", async () => unreadable), false);
});

test("one request per order: the receipt trigger and the cart clear share it", async () => {
  let posts = 0;
  const post = async () => {
    posts += 1;
    return reply(true, { confirmed: true });
  };
  const [a, b] = await Promise.all([confirmOrder("cs_shared_1", post), confirmOrder("cs_shared_1", post)]);
  assert.deepEqual([a, b], [true, true]);
  assert.equal(await confirmOrder("cs_shared_1", post), true);
  assert.equal(posts, 1);
  // A different order is its own request.
  await confirmOrder("cs_shared_2", post);
  assert.equal(posts, 2);
});

test("a network failure is unconfirmed and is retried on the next call; any other answer is final", async () => {
  let posts = 0;
  const flaky = async () => {
    posts += 1;
    if (posts === 1) throw new TypeError("Failed to fetch");
    return reply(true, { confirmed: true });
  };
  assert.equal(await confirmOrder("cs_retry_1", flaky), false);
  assert.equal(await confirmOrder("cs_retry_1", flaky), true);
  assert.equal(posts, 2);

  let refusals = 0;
  const refusing = async () => {
    refusals += 1;
    return reply(true, { confirmed: false });
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
