/**
 * F432 (release C; the Templates half, the renderer's rides 1.102.0): every
 * form field in the cart is 16 px on a phone. A phone browser zooms the page
 * into any field whose text is under 16 px when it is tapped, and the cart
 * then sits off screen until the shopper pinches back. At the `md` width and
 * up the fields keep their 14 px, as the renderer's own fields do
 * (`text-base md:text-sm`).
 *
 * The cart files are `use client` React modules the plain-Node runner cannot
 * load, so this reads their comment-stripped source, as CartDialog.test.ts does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../lib/source/stripComments.ts";

const FILES = ["CartDialog.tsx", "CartChoices.tsx"];

/** Every input, select and textarea in a source, with its class tokens (a template literal's static part). */
function fields(source: string): Array<{ tag: string; tokens: string[] }> {
  const out: Array<{ tag: string; tokens: string[] }> = [];
  for (const m of source.matchAll(/<(input|select|textarea)\b/g)) {
    // The tag's attributes run to the next element: an arrow handler's `=>`
    // holds a `>`, so the tag's own end cannot be found by the first `>`.
    const next = source.indexOf("<", m.index + 1);
    const attributes = source.slice(m.index, next === -1 ? undefined : next);
    const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(attributes);
    const raw = cls ? (cls[1] ?? cls[2] ?? "") : "";
    out.push({ tag: m[1], tokens: raw.replace(/\$\{[^}]*\}/g, " ").split(/\s+/).filter(Boolean) });
  }
  return out;
}

/** The field's text size below the `md` width: its unprefixed `text-<size>` token. */
const SIZES = ["text-xs", "text-sm", "text-base", "text-lg", "text-xl"];
const phoneSize = (tokens: string[]) => tokens.find((t) => SIZES.includes(t));

const cartFields = FILES.flatMap((file) =>
  fields(stripComments(fs.readFileSync(new URL(`./${file}`, import.meta.url), "utf8"))).map((f) => ({ file, ...f })),
);

test("CONTROL: the scan finds the cart's four fields (promo code, ZIP, pickup time, note)", () => {
  assert.deepEqual(cartFields.map((f) => `${f.file}:${f.tag}`), [
    "CartDialog.tsx:input",
    "CartChoices.tsx:input",
    "CartChoices.tsx:select",
    "CartChoices.tsx:textarea",
  ]);
  assert.equal(phoneSize(["h-10", "text-sm", "md:text-base"]), "text-sm", "the scan reads the unprefixed size");
});

test("ALLOW (F432): every cart field is 16 px on a phone and 14 px from the md width up", () => {
  for (const f of cartFields) {
    assert.equal(phoneSize(f.tokens), "text-base", `${f.file} ${f.tag}`);
    assert.ok(f.tokens.includes("md:text-sm"), `${f.file} ${f.tag} keeps 14 px at md and up`);
  }
});

test("REFUSE (F432): no cart field is under 16 px on a phone", () => {
  for (const f of cartFields) {
    const size = phoneSize(f.tokens);
    assert.ok(size !== "text-xs" && size !== "text-sm", `${f.file} ${f.tag} is ${size} on a phone, so tapping it zooms the page`);
    assert.ok(size !== undefined, `${f.file} ${f.tag} names its size`);
  }
});
