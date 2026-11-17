/**
 * F428 (plan-release-B 4.5, T-428; owner 2026-11-17T01:17:25Z): the cart's
 * "Pick a time" box keeps the native list, because the phone's own picker is
 * the right control for up to about 48 times, but its closed box is drawn to
 * match the ZIP box: no browser default bar, a chevron of its own, and the
 * placeholder muted until a time is picked.
 *
 * CartChoices.tsx is a `use client` React module the plain-Node runner cannot
 * load, so this reads its source with the comments blanked, as
 * CartDialog.test.ts does. The select's class expression is EVALUATED for an
 * empty and a picked time rather than matched as text.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../../lib/source/stripComments.ts";

const code = stripComments(fs.readFileSync(new URL("./CartChoices.tsx", import.meta.url), "utf8"));

/** The cart panel's own text colour (CartDialog), which each option sets back. */
const CART_TEXT = "text-[var(--text-primary,#0b1220)]";
const MUTED = "text-black/50";

function tokens(classList: string): string[] {
  return classList.split(/\s+/).filter(Boolean);
}

/** `src` from the first `from` at or after `at` through the next `to`. */
function between(src: string, from: string, to: string, at = 0): string {
  const start = src.indexOf(from, at);
  assert.ok(start >= 0, `expected ${from} in the cart choices`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end > start, `expected ${to} after ${from}`);
  return src.slice(start, end + to.length);
}

/** The one select, from its opening tag through its closing one. */
function selectBlock(): string {
  assert.equal(code.split("<select").length - 1, 1, "one select in the cart choices");
  return between(code, "<select", "</select>");
}

/** The select's own attributes: everything before its first option. */
function selectOpening(): string {
  const block = selectBlock();
  return block.slice(0, block.indexOf("<option"));
}

/**
 * The select's classes with the pickup time set to `pickupAt`. A template
 * literal is evaluated with that one name in scope, so the test reads the
 * class list the shopper's browser gets; a plain string is itself.
 */
function selectClasses(pickupAt: string | null): string[] {
  const opening = selectOpening();
  const literal = opening.match(/className=\{`([^`]*)`\}/);
  const plain = opening.match(/className="([^"]*)"/);
  assert.ok(literal || plain, "the select has a class list");
  if (!literal) return tokens(plain?.[1] ?? "");
  const value: unknown = new Function("pickupAt", "return `" + literal[1] + "`;")(pickupAt);
  assert.equal(typeof value, "string", "the class expression gives a string");
  return tokens(String(value));
}

/** The ZIP box's classes, read from the same file. */
function zipClasses(): string[] {
  const at = code.indexOf('aria-label="Your ZIP"');
  assert.ok(at > 0, "the ZIP box is in the cart choices");
  const input = code.slice(code.lastIndexOf("<input", at), code.indexOf("/>", at));
  const m = input.match(/className="([^"]*)"/);
  assert.ok(m, "the ZIP box has a class list");
  return tokens(m[1]);
}

const PICKED = "2026-11-17T15:00:00.000Z";

test("REFUSE (F428): the closed box draws no browser default bar", () => {
  assert.ok(selectClasses(null).includes("appearance-none"), "appearance-none on the select");
  assert.ok(selectClasses(PICKED).includes("appearance-none"), "and still once a time is picked");
});

test("REFUSE (F428): the closed box has the ZIP box's height, border, radius, focus ring and disabled look", () => {
  const zip = zipClasses();
  // Control: the ZIP box is read, and carries the look being copied.
  for (const look of ["h-10", "rounded-xl", "border-black/10", "focus:border-black/25", "disabled:opacity-60"]) {
    assert.ok(zip.includes(look), `control: the ZIP box has ${look}`);
  }
  // flex-1 sits it beside its button; px-3 becomes pl-3 plus room for the chevron.
  const layoutOnly = new Set(["flex-1", "px-3"]);
  const select = selectClasses(null);
  for (const look of zip.filter((c) => !layoutOnly.has(c))) {
    assert.ok(select.includes(look), `the select has the ZIP box's ${look}`);
  }
  assert.ok(select.includes("pl-3"), "the same left padding as the ZIP box");
  const right = select.map((c) => c.match(/^pr-(\d+)$/)).find(Boolean);
  // right-3 plus a 4-wide chevron ends 7 in from the edge, so a long time stays clear of it.
  assert.ok(right && Number(right[1]) >= 8, "right padding leaves room for the chevron");
});

test("REFUSE (F428): a chevron is drawn in the box, hidden from screen readers and the pointer", () => {
  assert.match(code, /import \{[^}]*\bChevronDown\b[^}]*\} from "lucide-react";/, "the chevron comes from the icons the cart already uses");
  const selectAt = code.indexOf("<select");
  const wrapper = code.slice(code.lastIndexOf("<div", selectAt), selectAt);
  assert.match(wrapper, /className="[^"]*\brelative\b[^"]*"/, "the select sits in a box the chevron is placed against");
  const selectEnd = code.indexOf("</select>");
  const chevron = between(code, "<ChevronDown", "/>", selectEnd);
  assert.ok(code.indexOf("<ChevronDown", selectEnd) < code.indexOf("</div>", selectEnd), "the chevron is inside that box");
  assert.match(chevron, /aria-hidden="true"/);
  const chevronClasses = tokens(chevron.match(/className="([^"]*)"/)?.[1] ?? "");
  for (const c of ["pointer-events-none", "absolute"]) assert.ok(chevronClasses.includes(c), `the chevron has ${c}`);
  // Visibly disabled with the select it sits on.
  assert.ok(selectClasses(null).includes("peer"), "the select is the chevron's peer");
  assert.ok(chevronClasses.some((c) => c.startsWith("peer-disabled:")), "the chevron dims with a disabled select");
});

test('REFUSE (F428): "Pick a time" is muted until a time is picked, and the open list is not', () => {
  assert.ok(selectClasses(null).includes(MUTED), "muted while no time is picked");
  assert.ok(!selectClasses(PICKED).includes(MUTED), "the cart's text colour once a time is picked");
  const options = selectBlock().match(/<option\b[^>]*>/g) ?? [];
  assert.equal(options.length, 2, "the placeholder and the mapped times");
  for (const option of options) assert.ok(option.includes(CART_TEXT), `the option sets the cart's text colour back: ${option}`);
  const dialog = stripComments(fs.readFileSync(new URL("./CartDialog.tsx", import.meta.url), "utf8"));
  assert.ok(dialog.includes(CART_TEXT), "that is the cart panel's own text colour");
});

test("ALLOW (F428): the words, the label and what a pick does are unchanged", () => {
  const opening = selectOpening();
  assert.ok(opening.includes('aria-label="Pickup time"'), "the label is kept");
  assert.ok(opening.includes('value={pickupAt ?? ""}'));
  assert.ok(opening.includes("disabled={disabled}"));
  assert.ok(opening.includes("onChange={(e) => onPickupAt(e.target.value || null)}"));
  const block = selectBlock();
  assert.match(block, /<option value=""[^>]*>Pick a time<\/option>/);
  assert.ok(block.includes("{(activeDay?.times ?? []).map((t) => ("));
  assert.match(block, /<option key=\{t\.start\} value=\{t\.start\}[^>]*>\s*\{t\.label\}\s*<\/option>/);
  const none = code.indexOf("No pickup times this day");
  assert.ok(none > 0 && none < code.indexOf("<select"), "a day with no times still says so instead");
  assert.match(code, /setDay\(d\.date\);\s*onPickupAt\(null\);/, "a new day still clears the time");
});

test("ALLOW (F428): the box keeps the site's font, as the ZIP box does", () => {
  // Tailwind's base styles give every select and input `font: inherit`; a
  // font class on either would override the site's font.
  const setsFont = (c: string) => /^(font-(sans|serif|mono)|font-\[|\[font)/.test(c);
  assert.equal(selectClasses(null).filter(setsFont).length, 0);
  assert.equal(zipClasses().filter(setsFont).length, 0);
  const css = fs.readFileSync(new URL("../../styles/globals.css", import.meta.url), "utf8");
  assert.ok(css.includes('@import "tailwindcss";'), "the base styles are loaded");
});
