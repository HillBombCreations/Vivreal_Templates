import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveContactErrorMessage, shouldResetContactFormOnSubmit } from "./contactErrorMessage.ts";

// Task 14 item 9 (dashboard-insights-phase-3-capture/plan.md, ux-critique F1/F2/F3)

test("resolveContactErrorMessage: a real server string wins over the fallback", () => {
  assert.equal(
    resolveContactErrorMessage("Your message is too long. Please shorten it and send again.", "fallback"),
    "Your message is too long. Please shorten it and send again.",
  );
});

test("resolveContactErrorMessage: falls back when the server value is absent, non-string, or whitespace-only", () => {
  assert.equal(resolveContactErrorMessage(undefined, "fallback"), "fallback");
  assert.equal(resolveContactErrorMessage(null, "fallback"), "fallback");
  assert.equal(resolveContactErrorMessage("   ", "fallback"), "fallback");
  assert.equal(resolveContactErrorMessage(500, "fallback"), "fallback");
  assert.equal(resolveContactErrorMessage({ message: "nope" }, "fallback"), "fallback");
});

test("shouldResetContactFormOnSubmit: resets on and only on a genuine 2xx", () => {
  assert.equal(shouldResetContactFormOnSubmit(true), true);
  assert.equal(shouldResetContactFormOnSubmit(false), false);
});
