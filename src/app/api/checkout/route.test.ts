import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../../lib/source/stripComments.ts";

// route.ts imports `next/server`, which the plain-Node test runner cannot load,
// so this pins the structural decisions in the module itself, exactly as
// delivery-quote/route.test.ts does. The redaction it depends on is tested by
// being CALLED, in src/lib/log/redact.test.ts.
const source = fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8");

/**
 * Every absence assertion runs against the source with comments removed. A
 * grep for a removed pattern otherwise matches the comment explaining that it
 * was removed, and the check silently becomes one that can never pass.
 */
const code = stripComments(source);

/** The two lines this route shipped before H37, kept as the control. */
const OLD_BODY_LOG =
  "console.log('[checkout] Response status:', res.status, 'body:', text.slice(0, 300));";
const OLD_DETAIL = "{ error: data.error ?? data.message ?? \"Checkout failed\", detail: text.slice(0, 200) },";

test("comment stripping did not eat the code (control)", () => {
  assert.ok(code.includes("export async function POST"), "stripper removed real code");
  // Comment bytes are replaced with spaces, so the length is unchanged by
  // design; what must differ is the content.
  assert.notEqual(code, source, "there were comments to strip");
  assert.equal(code.length, source.length, "offsets must be preserved");
  // The bug this stripper was rewritten for: a `//` inside a string literal.
  assert.ok(code.includes('"https://"'), "the stripper ate a URL string literal");
  // And it really does still remove comments, in both forms.
  assert.ok(!code.includes("bearer capability"), "a line comment survived");
  assert.ok(!code.includes("dead button"), "a block comment survived");
});

test("H37: the upstream response body is never logged", () => {
  // On success that body carries the hosted checkout URL, which is a bearer
  // capability: reading the log is enough to open the shopper's session.
  assert.doesNotMatch(code, /console\.\w+\([^;]*\btext\b/, "a console call still takes the body");
  assert.doesNotMatch(code, /text\.slice/, "the body is still being sliced into something");
});

test("H37 control: those assertions really do catch the old line", () => {
  // Without this, a typo in the regexes above would read as a clean pass.
  assert.match(OLD_BODY_LOG, /console\.\w+\([^;]*\btext\b/);
  assert.match(OLD_BODY_LOG, /text\.slice/);
  assert.match(OLD_DETAIL, /detail:/);
});

test("what IS logged is the status and the field names, never the values", () => {
  assert.match(source, /topLevelKeys\(data\)/);
  assert.match(source, /from "@\/lib\/log\/redact"/);
});

test("the catch logs the failure redacted by shape, and does not swallow it", () => {
  assert.match(source, /console\.error\([^;]*redactSecrets\(message\)/);
});

test("no response returns an upstream detail field to the browser", () => {
  // Same leak in the other direction, and nothing reads it: the cart reads
  // `error`. delivery-quote/route.test.ts pins the same rule for itself.
  assert.doesNotMatch(code, /detail:/);
});

test("H37: a malformed request body is a 400, not an unhandled 500", () => {
  // `await request.json()` used to sit above the try, so a body that is not
  // JSON threw out of the handler and Next answered 500 with a stack.
  const jsonAt = code.indexOf("request.json()");
  const tryAt = code.indexOf("try {");
  assert.ok(jsonAt > -1 && tryAt > -1, "found both anchors");
  assert.ok(tryAt < jsonAt, "request.json() is not inside a try");
  assert.match(code, /catch\s*\{\s*return NextResponse\.json\(\s*\{ error: "We could not read that request\." \},\s*\{ status: 400 \}/);
});

test("the checkout URL handed back is proven to be a string URL", () => {
  // The old chain `data.data?.url ?? data.data ?? data.url` fell through to the
  // envelope OBJECT when it carried no url, handing the browser {} where a URL
  // belongs and leaving the shopper on a button that did nothing.
  assert.match(code, /typeof candidate === "string"/);
  assert.match(code, /url\.startsWith\("https:\/\/"\)/);
});

test("the shopper is told what to do in our words, not the upstream's", () => {
  // Upstream refusals read "No active Stripe integration found for this group",
  // which names the wrong company on a Square site and is internal vocabulary.
  assert.match(source, /function shopperMessage\(status: number\): string/);
  assert.doesNotMatch(code, /data\.error \?\? data\.message/, "upstream prose is still echoed");
  for (const banned of ["integration", "Stripe", "Square", "endpoint", "API_KEY is"]) {
    const messages = code.match(/return "[^"]+";/g) ?? [];
    for (const m of messages) {
      assert.ok(!m.includes(banned), `shopper-facing copy names "${banned}": ${m}`);
    }
  }
});

test("shopper-facing copy carries no em dash and no en dash", () => {
  const messages = code.match(/"[^"]{20,}"/g) ?? [];
  assert.ok(messages.length >= 4, `only found ${messages.length} sentences to check`);
  for (const m of messages) {
    assert.ok(!m.includes(String.fromCharCode(8212)), `em dash in ${m}`);
    assert.ok(!m.includes(String.fromCharCode(8211)), `en dash in ${m}`);
  }
});

test("the runtime is still declared explicitly", () => {
  assert.match(source, /export const runtime = "edge"/);
  assert.match(source, /export const dynamic = "force-dynamic"/);
});
