import { test } from "node:test";
import assert from "node:assert/strict";
import { stripComments } from "./stripComments.ts";

test("line and block comments are removed", () => {
  assert.equal(stripComments("const a = 1; // secret").trim(), "const a = 1;");
  assert.equal(stripComments("const /* secret */ a = 1;").replace(/\s+/g, " "), "const a = 1;");
});

test("a // inside a string literal is NOT a comment", () => {
  // The bug this module exists for: blanking this ate the URL and made an
  // absence assertion pass for the wrong reason.
  const src = 'if (url.startsWith("https://")) return url;';
  assert.equal(stripComments(src), src);
  assert.ok(stripComments(src).includes('"https://"'));
});

test("a comment marker inside every quote style survives", () => {
  for (const src of [
    "const a = '// not a comment';",
    'const b = "/* not a comment */";',
    "const c = `// not a comment`;",
  ]) {
    assert.equal(stripComments(src), src, src);
  }
});

test("an escaped quote does not end the string early", () => {
  const q = String.fromCharCode(92) + '"';
  const src = 'const a = "he said ' + q + 'hi' + q + ' // still a string";';
  assert.equal(stripComments(src), src);
});

test("offsets and line numbers are preserved", () => {
  const src = "a // one\nb /* two\nthree */ c\n";
  const out = stripComments(src);
  assert.equal(out.length, src.length, "length changed");
  assert.equal(out.split("\n").length, src.split("\n").length, "line count changed");
});

test("the stripper can actually remove something (control)", () => {
  // Without this, a stripper that returned its input unchanged would pass
  // every assertion above that compares input to output.
  const src = "keep // drop";
  assert.notEqual(stripComments(src), src);
  assert.ok(!stripComments(src).includes("drop"));
  assert.ok(stripComments(src).includes("keep"));
});

test("an unterminated comment does not hang or throw", () => {
  assert.ok(!stripComments("a /* never closed").includes("never"));
  assert.equal(stripComments(""), "");
});
