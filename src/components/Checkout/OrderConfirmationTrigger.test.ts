import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../lib/source/stripComments.ts";

/**
 * The trigger is a .tsx client component, which `node --experimental-strip-types`
 * cannot load at all, so this pins the structural decisions the same way every
 * other route/component suite in this repo does.
 *
 * Both files are read, because the wiring is the half that was missing for
 * nine months: a perfectly correct component nobody renders is exactly the
 * state this whole change exists to fix.
 */
const triggerSrc = fs.readFileSync(
  new URL("./OrderConfirmationTrigger.tsx", import.meta.url),
  "utf8",
);
const trigger = stripComments(triggerSrc);

const pageSrc = fs.readFileSync(
  new URL("../../app/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const page = stripComments(pageSrc);

test("comment stripping did not eat the code (control)", () => {
  assert.ok(trigger.includes("export default function OrderConfirmationTrigger"));
  assert.notEqual(trigger, triggerSrc, "there were comments to strip");
  assert.ok(!trigger.includes("mail problem"), "a block comment survived");
  assert.ok(page.includes("export default async function DynamicPage"));
});

// ---------------------------------------------------------------------------
// IT IS ACTUALLY RENDERED. The missing half.
// ---------------------------------------------------------------------------

test("the slug page imports AND renders the trigger", () => {
  assert.match(
    page,
    /import OrderConfirmationTrigger from "@\/components\/Checkout\/OrderConfirmationTrigger"/,
    "imported",
  );
  assert.match(page, /<OrderConfirmationTrigger \/>/, "and actually rendered");
});

test("it is gated on the checkout-success FORMAT, not on a slug", () => {
  // A customer can rename their success page. `checkout-success` is the format
  // createCheckoutSession's success_url lands on, and it is a fact about the
  // page rather than about its URL.
  assert.match(page, /format === "checkout-success" && <OrderConfirmationTrigger \/>/);
  // And it must NOT fire on the cancel page: nobody paid.
  assert.doesNotMatch(
    page,
    /checkout-cancel" && <OrderConfirmationTrigger/,
    "a cancelled checkout has no order to confirm",
  );
});

// ---------------------------------------------------------------------------
// The two ways this component could be silently wrong.
// ---------------------------------------------------------------------------

test("the URL is read inside the effect, never in a useState initializer", () => {
  // A `useState(() => window...)` initializer RUNS ON THE SERVER during SSR,
  // where there is no window, and React never re-runs it on the client. The
  // value would be wrong forever and nothing would report it.
  assert.doesNotMatch(trigger, /useState/, "no state at all: there is nothing to render");
  assert.match(
    trigger,
    /useEffect\(\(\) => \{[\s\S]*window\.location\.search/,
    "window is read inside the effect",
  );
});

test("it posts at most once per session id per browsing context", () => {
  assert.match(trigger, /const attempted = new Set<string>\(\)/, "module-scope guard");
  assert.match(trigger, /attempted\.has\(sessionId\)\) return/, "checked before posting");
  assert.match(trigger, /attempted\.add\(sessionId\)/, "and recorded before the request");
});

test("the guard is NOT persisted, so a reload after a failure retries", () => {
  // A reload after a SUCCESS is free: the upstream stamps the PaymentIntent
  // and answers already-sent. A reload after a FAILURE is the retry that gets
  // the buyer their receipt. sessionStorage would trade the second for the
  // first, which is the wrong way round.
  assert.doesNotMatch(trigger, /sessionStorage/);
  assert.doesNotMatch(trigger, /localStorage/);
});

test("no session id means no post, so opening the page sends nothing", () => {
  assert.match(trigger, /if \(!sessionId \|\| attempted\.has\(sessionId\)\) return;/);
});

test("the request survives the shopper navigating away", () => {
  assert.match(trigger, /keepalive: true/);
});

test("the rejection is handled, and the handler says why it is swallowed", () => {
  assert.match(trigger, /\.catch\(\(\) => \{/, "a rejection must not surface as unhandled");
  // The reason lives in the comment, which is exactly why this one assertion
  // reads the RAW source rather than the stripped copy.
  assert.match(triggerSrc, /Swallowed with a reason/);
});

test("it renders nothing, so the Studio preview card stays effect-free", () => {
  assert.match(trigger, /return null;/);
  assert.doesNotMatch(trigger, /CheckoutResultTemplate/, "it sits beside the card, not inside it");
});

test("it posts to the confirm route and nowhere else", () => {
  assert.match(trigger, /fetch\("\/api\/checkout\/confirm"/);
  const fetches = [...trigger.matchAll(/fetch\(\s*["'`]([^"'`]+)/g)].map((m) => m[1]);
  assert.deepEqual(fetches, ["/api/checkout/confirm"]);
});
