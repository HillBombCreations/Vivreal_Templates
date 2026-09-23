import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../../../lib/source/stripComments.ts";

/**
 * route.ts imports `next/server`, which the plain-Node test runner cannot
 * load, so this pins the structural decisions in the module itself, exactly as
 * the sibling checkout/route.test.ts and delivery-quote/route.test.ts do.
 *
 * Every ABSENCE assertion runs against the comment-stripped source. A grep for
 * a removed pattern otherwise matches the comment explaining the removal, and
 * the check silently becomes one that can never fail.
 */
const source = fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const code = stripComments(source);

/**
 * The 2026-01-07 draft of this exact file, on the unmerged branch
 * `feat/cdn-media-urls-ecommerce`. It is kept here as the CONTROL for the
 * absence assertions below: every pattern they refuse is one that version
 * really contained, so a typo in a regex cannot read as a clean pass.
 */
const DRAFT_STRIPE_INIT = 'const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);';
const DRAFT_RETRIEVE = 'const session = await stripe.checkout.sessions.retrieve(sessionId, {';
const DRAFT_BODY = 'body: JSON.stringify({ products, contactEmail, businessName, customerEmail }),';
const DRAFT_BODY_LOG = 'body: bodyText.slice(0, 2000),';

test("comment stripping did not eat the code (control)", () => {
  assert.ok(code.includes("export async function POST"), "stripper removed real code");
  assert.notEqual(code, source, "there were comments to strip");
  assert.equal(code.length, source.length, "offsets must be preserved");
  assert.ok(code.includes('"https://client.vivreal.io"'), "the stripper ate a URL string literal");
  assert.ok(!code.includes("mail relay"), "a block comment survived");
});

// ---------------------------------------------------------------------------
// The defect in the never-merged draft: it tried to verify the payment HERE.
// ---------------------------------------------------------------------------

test("this route never touches Stripe, because the key here is the wrong key", () => {
  // A customer's Checkout Session lives in THAT CUSTOMER's Stripe account.
  // A single global STRIPE_SECRET_KEY in this app would 404 every lookup.
  assert.doesNotMatch(code, /STRIPE_SECRET_KEY/, "this app must not hold a Stripe credential");
  assert.doesNotMatch(code, /checkout\.sessions\.retrieve/, "session lookup belongs upstream");
  assert.doesNotMatch(code, /from ["']stripe["']/, "no Stripe SDK in this route");
});

test("control: those assertions really do catch the draft's lines", () => {
  assert.match(DRAFT_STRIPE_INIT, /STRIPE_SECRET_KEY/);
  assert.match(DRAFT_RETRIEVE, /checkout\.sessions\.retrieve/);
});

// ---------------------------------------------------------------------------
// The trust boundary. Nothing a browser sends may choose a recipient or a word.
// ---------------------------------------------------------------------------

test("only the session id is forwarded; the shop comes from the build env", () => {
  assert.match(code, /JSON\.stringify\(\{\s*sessionId,\s*siteId\s*\}\)/, "exactly two fields go upstream");
  assert.match(code, /process\.env\.SITE_ID/, "siteId is a build env var, never a body field");
});

test("no recipient, no shop name and no cart is ever read off the request body", () => {
  for (const field of ["contactEmail", "customerEmail", "businessName", "products", "stripeKey"]) {
    assert.doesNotMatch(
      code,
      new RegExp(`\\b${field}\\b`),
      `${field} must not appear: it is what made the upstream route a mail relay`,
    );
  }
  // Control: a field that IS read is present, so the loop is testing those
  // names and not a file that mentions nothing.
  assert.match(code, /\bsessionId\b/);
});

test("control: the draft really did send all four of those", () => {
  for (const field of ["contactEmail", "customerEmail", "businessName", "products"]) {
    assert.match(DRAFT_BODY, new RegExp(`\\b${field}\\b`));
  }
});

test("the session id is shape-checked before it reaches an upstream URL", () => {
  assert.match(code, /\^cs_\[A-Za-z0-9_\]/, "must pin the Stripe id charset");
  assert.match(code, /SESSION_ID\.test\(sessionId\)/, "and must actually apply it");
});

test("a preview build cannot post a nonsense site id at the live API", () => {
  assert.match(code, /siteId === "preview"/);
});

// ---------------------------------------------------------------------------
// What may be logged, and what the shopper is told.
// ---------------------------------------------------------------------------

test("the upstream body is never logged or returned", () => {
  assert.doesNotMatch(code, /\.slice\(0,\s*\d+\)/, "no body slicing into a log or a response");
  assert.doesNotMatch(code, /detail:/, "no upstream detail reaches the browser");
  assert.doesNotMatch(code, /res\.text\(\)/, "the body is not even read");
});

test("control: the draft logged a 2000-byte slice of it", () => {
  assert.match(DRAFT_BODY_LOG, /\.slice\(0,\s*\d+\)/);
});

test("an upstream or network failure is a 200, never a broken confirmation page", () => {
  // The order is paid for and recorded whatever this returns. A non-2xx here
  // would be rendered by nothing and frighten somebody whose purchase worked.
  const statuses = [...code.matchAll(/status:\s*(\d{3})/g)].map((m) => m[1]);
  assert.ok(statuses.length > 0, "control: the file does set statuses");
  // 400 is reachable only for a malformed request, which no real buyer makes.
  assert.deepEqual(
    [...new Set(statuses)].sort(),
    ["200", "400"],
    "only a bad request may be a 4xx; upstream trouble must answer 200",
  );
});

test("the catch does not swallow silently: it logs before it answers", () => {
  assert.match(code, /catch \{\s*\n\s*console\.error/, "the catch block must log");
});
