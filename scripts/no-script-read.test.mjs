/**
 * scripts/no-script-read.mjs (F323, T-323-1; vivreal-hq
 * docs/projects/next-release-C/design-home-pages.md 4.3 and 5).
 *
 * The measure every F323 proof shares: what a reader that runs no scripts
 * sees. Hermetic: planted HTML in the shapes the BR-04 and 2026-11-16 reads
 * recorded, no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NO_SCRIPT_RATIO_MIN,
  passesWithoutScripts,
  readWithoutScripts,
} from "./no-script-read.mjs";

const words = (n) => "x".repeat(n);

/** The BR-04 home: the whole body, h1 included, inside the first hidden segment, a grey box in front. */
const BR04_HOME = [
  "<!DOCTYPE html><html><head><title>Waves of Grain</title><style>.a{}</style></head>",
  '<body class="font-sans"><script>self.__next_f=[]</script>',
  '<!--$?--><template id="B:0"></template><div class="min-h-screen animate-pulse"></div><!--/$-->',
  '<div hidden id="S:0"><main><h1>Waves of Grain Co</h1><p>Fresh bread from our oven every morning.</p></main></div>',
  '<script>$RC("B:0","S:0")</script></body></html>',
].join("");

/** The help article read: menu, title band and footer visible (1,231 characters), the body hidden (5,035). */
function helpArticle() {
  const title = "Your site dashboard";
  // Two separating spaces: nav to title, title to footer.
  const visibleRest = words(1231 - title.length - 2);
  return [
    "<html><body>",
    `<nav>${visibleRest.slice(0, 600)}</nav><h1>${title}</h1><footer>${visibleRest.slice(600)}</footer>`,
    '<!--$?--><template id="B:0"></template><!--/$-->',
    `<div hidden id="S:0"><article><p>${words(5035)}</p></article></div>`,
    "</body></html>",
  ].join("");
}

/** A complete page: the h1 and the body before any hidden part. */
const COMPLETE = [
  "<html><body><header>Menu Home About</header>",
  "<main><h1>Waves of Grain Co</h1><p>Fresh bread from our oven every morning. Order online for pickup.</p></main>",
  "<footer>Waves of Grain Co, 12 Main Street</footer>",
  "<script>self.__next_f.push([1,\"x\"])</script></body></html>",
].join("");

/** A complete page followed by one icon-only hidden box (Windward's social icon shape): icons carry no text. */
const COMPLETE_WITH_ICON_BOX = COMPLETE.replace(
  "</body>",
  '<div hidden id="S:1"><a href="https://instagram.com/x"><svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg></a></div></body>',
);

/** Complete, except the one string the reader must see sits only in a late hidden segment. */
const COMPLETE_TEXT_ONLY_HIDDEN = [
  "<html><body><main><h1>Waves of Grain Co</h1>",
  `<p>${words(400)}</p></main>`,
  '<!--$?--><template id="B:1"></template><!--/$-->',
  '<div hidden id="S:1"><p>Order online</p></div>',
  "</body></html>",
].join("");

test("REFUSE: the BR-04 home (h1 and body hidden behind a grey box) does not pass", () => {
  const read = readWithoutScripts(BR04_HOME);
  assert.equal(read.h1Visible, false);
  assert.equal(read.visibleChars, 0);
  assert.ok(read.hiddenChars > 0);
  assert.equal(read.pendingBoxes, 1);
  assert.equal(read.skeletonVisible, true);
  const verdict = passesWithoutScripts(read, []);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((r) => r.includes("<h1>")), verdict.reasons.join("; "));
  assert.ok(verdict.reasons.some((r) => r.includes("ratio")), verdict.reasons.join("; "));
});

test("REFUSE: the help article (menu, title and footer visible, body hidden) does not pass on its ratio", () => {
  const read = readWithoutScripts(helpArticle());
  assert.equal(read.visibleChars, 1231);
  assert.equal(read.hiddenChars, 5035);
  assert.equal(read.h1Visible, true);
  const verdict = passesWithoutScripts(read, []);
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.reasons.length, 1);
  assert.match(verdict.reasons[0], /ratio 0\.196/);
});

test("REFUSE: a page whose expected text is not visible does not pass", () => {
  const read = readWithoutScripts(COMPLETE_TEXT_ONLY_HIDDEN);
  assert.ok(read.visibleChars / (read.visibleChars + read.hiddenChars) >= NO_SCRIPT_RATIO_MIN);
  const verdict = passesWithoutScripts(read, ["Order online"]);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((r) => r.includes("Order online")), verdict.reasons.join("; "));
});

test("ALLOW: a complete page passes, with its text visible", () => {
  const read = readWithoutScripts(COMPLETE);
  assert.equal(read.h1Visible, true);
  assert.equal(read.hiddenChars, 0);
  assert.equal(read.pendingBoxes, 0);
  assert.equal(read.skeletonVisible, false);
  const verdict = passesWithoutScripts(read, ["Waves of Grain Co", "Order online"]);
  assert.deepEqual(verdict, { ok: true, reasons: [] });
});

test("ALLOW: a complete page followed by an icon-only hidden box passes (icons carry no text)", () => {
  const read = readWithoutScripts(COMPLETE_WITH_ICON_BOX);
  assert.equal(read.hiddenChars, 0);
  assert.equal(passesWithoutScripts(read, ["Waves of Grain Co"]).ok, true);
});

test("the measure ignores script, style and template text and collapses whitespace", () => {
  const read = readWithoutScripts(
    "<html><head><style>h1{color:red}</style></head><body>\n<h1>  A   B </h1><script>var longText='zzzzzzzz'</script><template><p>tpl</p></template></body></html>",
  );
  assert.equal(read.visibleText, "A B");
  assert.equal(read.visibleChars, 3);
});

test("the ratio floor is the design's fixed value", () => {
  assert.equal(NO_SCRIPT_RATIO_MIN, 0.9);
});
