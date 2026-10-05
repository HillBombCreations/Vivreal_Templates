import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../../lib/source/stripComments.ts";

/**
 * route.ts imports `next/server`, which the plain-Node test runner cannot
 * load, so this pins the structural decisions in the module itself, exactly
 * as `checkout/confirm/route.test.ts` and `delivery-quote/route.test.ts` do.
 * The behaviour worth pinning — what `resolveContactRecipient` actually
 * resolves to under an ALLOW/REFUSE/no-email body — lives in
 * `src/lib/contactRecipient.test.ts`, which CAN be loaded and called.
 *
 * Every ABSENCE assertion below runs against comment-stripped source. A grep
 * for a removed pattern otherwise matches the comment explaining the
 * removal, and the check silently becomes one that can never fail.
 */
const source = fs.readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const code = stripComments(source);

/**
 * The exact lines this file replaced (verbatim, from before this fix). Kept
 * as the CONTROL for the absence assertions below: every pattern they refuse
 * is one this version really contained, so a typo in a regex cannot read as
 * a clean pass.
 */
const DRAFT_CONDITIONAL_LOOKUP =
  "const site = body.contactEmail?.trim() ? null : await resolveSiteContact();";
const DRAFT_RECIPIENT_LINE =
  'const to = (body.contactEmail?.trim() || site?.email || "").trim();';
const DRAFT_DROP_ON_NO_EMAIL = 'error: "No contact email configured"';

test("comment stripping did not eat the code (control)", () => {
  assert.ok(code.includes("export async function POST"), "stripper removed real code");
  assert.notEqual(code, source, "there were comments to strip");
  assert.equal(code.length, source.length, "offsets must be preserved");
  assert.ok(code.includes('"https://client.vivreal.io"'), "the stripper ate a URL string literal");
  assert.ok(!code.includes("mail relay") && !code.includes("security hotfix"), "a comment survived stripping");
});

// ---------------------------------------------------------------------------
// F1 — the open relay. Nothing a caller sends may choose the recipient.
// ---------------------------------------------------------------------------

test("the site contact lookup is unconditional, never gated on the body", () => {
  // The defect: resolveSiteContact() was only called when the body did NOT
  // supply its own contactEmail, so a caller supplying ANY value skipped the
  // server-side lookup entirely.
  assert.doesNotMatch(code, /body\.contactEmail/, "the body's contactEmail must never be read");
  // 2026-10-04: resolveSiteContact() now takes an `onFailure` alerting hook
  // (idle-dead-socket fix), so the call spans several lines, but it is still
  // the unconditional `const site = await resolveSiteContact(` start this
  // control is really about — never `body.contactEmail ? null : ...`.
  assert.match(code, /const site = await resolveSiteContact\(\{/);
});

test("control: the replaced code really did gate the lookup on body.contactEmail", () => {
  assert.match(DRAFT_CONDITIONAL_LOOKUP, /body\.contactEmail/);
  assert.match(DRAFT_RECIPIENT_LINE, /body\.contactEmail/);
});

test("the recipient comes from resolveContactRecipient(), imported from the shared module", () => {
  assert.match(
    code,
    /import \{ resolveContactRecipient, resolveSiteContact \} from "@\/lib\/contactRecipient";/,
  );
  assert.match(code, /const \{ to, siteName, branding \} = resolveContactRecipient\(body, site\);/);
});

test("the recipient is resolved in exactly one place, never re-derived with a body fallback", () => {
  // A second `||`-chained fallback elsewhere in the file is how the defect
  // would come back under a different variable name.
  const calls = [...code.matchAll(/resolveContactRecipient\(/g)];
  assert.equal(calls.length, 1, "resolveContactRecipient must be called exactly once");
  assert.doesNotMatch(code, /\bto\s*=\s*\(?\s*body\./, "no second body-derived recipient binding");
});

test("the forwarded request never contains the body's own siteId/apiKey-adjacent fields unchecked", () => {
  // Not a new claim, just confirming the F1 fix did not loosen this: siteId
  // keeps coming from the build env, never the body.
  assert.match(code, /siteId: process\.env\.SITE_ID \|\| undefined/);
});

// ---------------------------------------------------------------------------
// F2 — a submission is never silently dropped for lack of a recipient.
// ---------------------------------------------------------------------------

test("there is no early return when the site has no contact email configured", () => {
  assert.doesNotMatch(code, /No contact email configured/, "the drop-and-500 path must be gone");
});

test("control: the replaced code really did drop the submission with a 500", () => {
  assert.match(DRAFT_DROP_ON_NO_EMAIL, /No contact email configured/);
});

test("an empty recipient omits contactEmail from the upstream fetch body rather than sending it empty", () => {
  assert.match(code, /\.\.\.\(to \? \{ contactEmail: to \} : \{\}\)/);
  // The upstream `fetch(...)` call (not the unrelated `enriched` object used
  // only to render the HTML) must carry the conditional form, not a bare
  // `contactEmail: to,` that would send an empty string on a no-email site.
  const fetchCallStart = code.indexOf("await fetch(`${clientApiUrl}/tenant/sendContactEmail`");
  assert.ok(fetchCallStart > -1, "control: the upstream fetch call must exist");
  const fetchCallBody = code.slice(fetchCallStart, code.indexOf(");", fetchCallStart));
  assert.doesNotMatch(fetchCallBody, /contactEmail: to,/, "must be conditional, not unconditional");
});

// ---------------------------------------------------------------------------
// Reply-To — the visitor's own address rides as reply-to content, never as
// a recipient. (VR_Client_API's service layer sets the actual SMTP
// Reply-To header from this same field; this route's job is only to keep
// forwarding it unchanged, under its own name, never as `contactEmail`.)
// ---------------------------------------------------------------------------

test("customerEmail (the visitor's address) is forwarded verbatim and never promoted to a recipient", () => {
  assert.match(code, /customerEmail,/, "the visitor's address must still be forwarded");
  assert.doesNotMatch(code, /contactEmail:\s*customerEmail/, "the visitor's address must never become the recipient");
});

// ---------------------------------------------------------------------------
// review-templates-183.md concern 4 — the contact alert must actually be
// FLUSHED before this edge route's response, not merely enqueued, since
// nothing else flushes Sentry here and Amplify can freeze the container the
// instant the response is sent.
// ---------------------------------------------------------------------------

test("a failed recipient lookup starts a gated Sentry flush, not an unconditional one", () => {
  assert.match(code, /recipientLookupFailed = true;/, "onFailure must record that the lookup failed");
  assert.match(
    code,
    /const flushPromise = recipientLookupFailed \? Sentry\.flush\(1500\) : Promise\.resolve\(\);/,
    "the flush must be gated on the failure, not started unconditionally",
  );
});

test("the flush starts after the lookup and before the recipient is resolved, not inside onFailure itself", () => {
  // onFailure fires synchronously from inside resolveSiteContact() and is
  // never awaited there (see contactRecipient.ts) — a flush started INSIDE
  // it would race the response rather than guard it. It must appear after
  // the resolveSiteContact(...) call closes.
  const resolveCallEnd = code.indexOf("resolveContactRecipient(body, site)");
  const flushIndex = code.indexOf("const flushPromise =");
  assert.ok(flushIndex > -1, "control: the flush assignment must exist");
  assert.ok(flushIndex < resolveCallEnd, "the flush must start before the recipient is resolved for the email body");
});

test("review-templates-183.md concern 6: the flush runs ALONGSIDE the upstream POST, never serially before it", () => {
  // The defect this guards against: starting (or awaiting) the flush BEFORE
  // the upstream `fetch(...)` call, which pays the full flush cost on top of
  // the POST's own latency instead of letting the two overlap. Proven by
  // position: the un-awaited `flushPromise` assignment must precede the
  // `fetch(` call (so they START together), and every explicit
  // `await flushPromise` must appear AFTER that same call, never before it.
  const flushAssignIndex = code.indexOf("const flushPromise =");
  const fetchCallIndex = code.indexOf("await fetch(`${clientApiUrl}/tenant/sendContactEmail`");
  assert.ok(flushAssignIndex > -1 && fetchCallIndex > -1, "control: both must exist");
  assert.ok(
    flushAssignIndex < fetchCallIndex,
    "flushPromise must be created before the POST starts, so the two run concurrently",
  );
  // The regression this guards against: a blocking `await Sentry.flush(1500);`
  // statement ahead of `flushPromise`'s own assignment, which serialises the
  // full flush cost before the POST even starts — `flushPromise` itself would
  // still exist afterward (as an unconditional no-op), so the two assertions
  // above alone cannot catch it.
  assert.doesNotMatch(
    code,
    /await Sentry\.flush\(1500\);/,
    "the flush must never be awaited directly — only indirectly, via `await flushPromise` after the POST has started",
  );

  const awaitFlushMatches = [...code.matchAll(/await flushPromise;/g)];
  assert.ok(
    awaitFlushMatches.length >= 2,
    "the flush must be explicitly awaited in both the success path and the catch block",
  );
  for (const match of awaitFlushMatches) {
    assert.ok(
      (match.index ?? -1) > fetchCallIndex,
      "await flushPromise must only ever run after the POST has started, never before it",
    );
  }
});
