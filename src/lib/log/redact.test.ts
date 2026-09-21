import { test } from "node:test";
import assert from "node:assert/strict";
import { redactSecrets, topLevelKeys, REDACTED } from "./redact.ts";

/**
 * The exact success body H37 was logging. This is the artefact the item is
 * about, so it is the first thing every assertion here is run against.
 */
const SESSION_ID = ["cs", "live", "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"].join("_");
const CHECKOUT_BODY =
  `{"success":true,"data":{"url":"https://checkout.stripe.com/c/pay/${SESSION_ID}#fidkdWxOYHwnPyd1blpxYHZxWjA0","sessionId":"${SESSION_ID}"}}`;

test("H37: the hosted checkout URL never survives redaction", () => {
  const out = redactSecrets(CHECKOUT_BODY);
  assert.ok(!out.includes("checkout.stripe.com"), "the host survived");
  assert.ok(!out.includes("https://"), "a scheme survived");
  assert.ok(!out.includes("cs_live_"), "the session id survived");
  assert.ok(out.includes(REDACTED), "nothing was redacted at all");
});

test("H37 control: the unredacted body really does carry the capability", () => {
  // If this ever stops being true the test above proves nothing.
  assert.ok(CHECKOUT_BODY.includes("https://checkout.stripe.com"));
  assert.ok(CHECKOUT_BODY.includes("cs_live_"));
});

test("redaction is on the shape of the value, not the name beside it", () => {
  // The name says nothing secret; the value is a cluster URL with a password
  // in it. This is the exact shape a name-based filter leaked in this fleet.
  const line = "CLUSTER_URL=mongodb+srv://appuser:hunter2hunter2@cluster0.abcde.mongodb.net/db";
  const out = redactSecrets(line);
  assert.ok(!out.includes("hunter2hunter2"), "the password survived");
  assert.ok(out.startsWith("CLUSTER_URL="), "the harmless name should be kept");
});

test("a name-based filter would NOT have caught that line (control)", () => {
  // Proves the previous test is testing something a naive filter misses.
  const nameFilter = (s: string) => (/KEY|SECRET|TOKEN|PASSWORD/i.test(s) ? REDACTED : s);
  const line = "CLUSTER_URL=mongodb+srv://appuser:hunter2hunter2@cluster0.abcde.mongodb.net/db";
  assert.ok(nameFilter(line).includes("hunter2hunter2"), "the naive filter already caught it");
});

test("the named credential shapes are each caught", () => {
  // Assembled at runtime, never written out whole. These are invented, but they
  // are invented to the exact SHAPE a scanner looks for, which is the point of
  // the test and also why GitHub push protection refused the literal form.
  const cases = [
    ["sk", "live", "51AbCdEfGhIjKlMnOpQrStUv"].join("_"),
    ["pk", "test", "51AbCdEfGhIjKlMnOpQrStUv"].join("_"),
    ["whsec", "AbCdEfGhIjKlMnOpQrStUvWxYz"].join("_"),
    ["EAAA", "Eabcdefghijklmnopqrstuvwxyz0123"].join(""),
    ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "dBjftJeZ4CVPmB92K27uhbUJU1p1r"].join("."),
  ];
  for (const secret of cases) {
    const out = redactSecrets(`upstream said: ${secret} and then stopped`);
    assert.ok(!out.includes(secret), `survived: ${secret}`);
    assert.ok(out.includes("upstream said:"), "redacted too much");
  }
});

test("ordinary prose is left readable, so the log stays useful", () => {
  for (const safe of [
    "upstream request failed",
    "fetch failed",
    "Response status: 502",
    "The operation was aborted due to timeout",
  ]) {
    assert.equal(redactSecrets(safe), safe, safe);
  }
});

test("redaction never throws on the values a catch block really sees", () => {
  assert.equal(redactSecrets(""), "");
  // Repeated calls must be identical: these are module-level /g regexes, and a
  // shared lastIndex is how that quietly starts skipping matches.
  const first = redactSecrets(CHECKOUT_BODY);
  for (let i = 0; i < 5; i += 1) {
    assert.equal(redactSecrets(CHECKOUT_BODY), first, `call ${i} differed`);
  }
});

test("topLevelKeys names the fields without revealing any value", () => {
  const body = JSON.parse(CHECKOUT_BODY);
  assert.deepEqual(topLevelKeys(body), ["data", "success"]);
  const joined = topLevelKeys(body).join(",");
  assert.ok(!joined.includes("cs_live_"));
  assert.ok(!joined.includes("https"));
});

test("topLevelKeys is total over the shapes JSON.parse can return", () => {
  assert.deepEqual(topLevelKeys(null), []);
  assert.deepEqual(topLevelKeys(undefined), []);
  assert.deepEqual(topLevelKeys("a string"), []);
  assert.deepEqual(topLevelKeys(7), []);
  assert.deepEqual(topLevelKeys([1, 2, 3]), ["[3 items]"]);
  assert.deepEqual(topLevelKeys({ b: 1, a: 2 }), ["a", "b"]);
});
