import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripComments } from "../source/stripComments.ts";

/**
 * RW4-7 (rewalk-r4.md, verified 2026-10-08 against `next build` + `next start`
 * with VR_Client_API down and the fetch cache empty): every page answered 500
 * with `private, no-cache, no-store` (so nothing was cached), but the slug
 * pages' document title read "Not Found | ". On a degraded read the page list
 * is empty because nothing was read, and generateMetadata turned that absence
 * into a "this page does not exist" claim, the one degraded.ts exists to stop.
 *
 * The routes are .tsx modules importing next/*, which the plain-Node runner
 * cannot load, so this pins that each generateMetadata returns `{}` on degraded
 * data BEFORE any branch that can title the page "Not Found".
 */
const ROUTES = [
  "../../app/[slug]/page.tsx",
  "../../app/[slug]/[itemId]/page.tsx",
  "../../app/[...segments]/page.tsx",
];

const GUARD = "if (isDegradedSiteData(siteData)) return {};";

function metadataBody(route: string): string {
  const code = stripComments(fs.readFileSync(new URL(route, import.meta.url), "utf8"));
  const start = code.indexOf("export async function generateMetadata(");
  assert.ok(start >= 0, `${route}: control, generateMetadata exists`);
  return code.slice(start);
}

for (const route of ROUTES) {
  test(`REFUSE (RW4-7): ${route} never titles a degraded render "Not Found"`, () => {
    const body = metadataBody(route);
    const notFound = body.indexOf("Not Found |");
    assert.ok(notFound > 0, "control: the Not Found title is still there for a real miss");
    const guard = body.indexOf(GUARD);
    assert.ok(guard > 0, "the degraded guard is in generateMetadata");
    assert.ok(guard < notFound, "and it runs before any Not Found branch");
    assert.ok(body.indexOf("await getSiteData()") < guard, "on the data it just read");
  });

  test(`ALLOW (RW4-7): ${route} imports the one degraded marker, not an inference`, () => {
    const code = stripComments(fs.readFileSync(new URL(route, import.meta.url), "utf8"));
    assert.match(code, /import \{[^}]*\bisDegradedSiteData\b[^}]*\} from "@\/lib\/api\/siteData\/degraded"/);
  });
}

test("RW4-7: the shopper error page offers Try again, as a full reload", () => {
  const code = stripComments(fs.readFileSync(new URL("../../app/error.tsx", import.meta.url), "utf8"));
  assert.match(code, /onClick=\{\(\) => window\.location\.reload\(\)\}/);
  assert.match(code, />\s*Try again\s*</);
  assert.match(code, /type="button"/);
});
