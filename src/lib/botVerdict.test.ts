import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBotVerdict, BOT_VERDICT_HEADER } from "./botVerdict.ts";

// Task 14 item 2 (dashboard-insights-phase-3-capture/plan.md, D7) — the
// edge-computed bot verdict middleware.ts forwards as `x-vivreal-bot`.

test("computeBotVerdict: a real browser UA -> '0'", () => {
  assert.equal(
    computeBotVerdict(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    ),
    "0",
  );
});

test("computeBotVerdict: absent/blank UA -> '1' (no UA is a STRONGER bot signal than a spoofed one)", () => {
  assert.equal(computeBotVerdict(null), "1");
  assert.equal(computeBotVerdict(undefined), "1");
  assert.equal(computeBotVerdict(""), "1");
  assert.equal(computeBotVerdict("   "), "1");
});

test("computeBotVerdict: known crawler/monitor UAs -> '1'", () => {
  const bots = [
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "Mozilla/5.0 (compatible; UptimeRobot/2.0)",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "PostmanRuntime/... okhttp/4.9.0",
    "node-fetch",
    "axios/1.6.0",
  ];
  for (const ua of bots) {
    assert.equal(computeBotVerdict(ua), "1", `expected bot for UA: ${ua}`);
  }
});

test("computeBotVerdict: case-insensitive match", () => {
  assert.equal(computeBotVerdict("Some-BOT/1.0"), "1");
});

test("computeBotVerdict: never returns the raw UA -- only the literal '1'/'0' (no-visitor-linkage constraint)", () => {
  const ua = "a very identifying custom user agent string";
  const verdict = computeBotVerdict(ua);
  assert.ok(verdict === "0" || verdict === "1");
  assert.notEqual(verdict as string, ua);
});

test("BOT_VERDICT_HEADER is the literal the plan names", () => {
  assert.equal(BOT_VERDICT_HEADER, "x-vivreal-bot");
});
