import { test } from "node:test";
import assert from "node:assert/strict";
// Explicit .ts extension: this file runs directly under plain Node
// (`node --experimental-strip-types --test`, see package.json "test"), which
// needs a resolvable specifier — Node does not do extensionless or .js->.ts
// resolution. `allowImportingTsExtensions` (tsconfig.json) is the standard,
// noEmit-only-safe TypeScript flag that permits this same specifier under tsc.
import { willRenderHeroBanner } from "./heroBanner.ts";
import type { PageConfig } from "@/types/SiteData";

// Regression coverage for the 2026-07-10 /studio-demo double-title bug: the
// page wrappers' bare "transitional title band" must self-disable exactly
// when the renderer's mapBlocks will ALSO emit a synthetic hero banner from
// the same page.labels (buttonLabel + buttonLink) — otherwise the title
// renders twice. This is the single source of truth both page wrappers
// (`renderComposedPage.tsx`, `app/[slug]/page.tsx`) import instead of
// re-deriving the condition inline.

function page(o: Partial<Pick<PageConfig, "labels" | "blocks">> = {}): Pick<PageConfig, "labels" | "blocks"> {
  return { labels: {}, ...o };
}

test("willRenderHeroBanner: /studio-demo shape (title + subtitle + buttonLabel + buttonLink, no blocks) -> true", () => {
  const p = page({
    labels: {
      title: "Build a site in under 60 seconds",
      subtitle: "No signup. No commitment. Edit a real Studio in your browser.",
      buttonLabel: "Try the Studio",
      buttonLink: "https://vivreal.io/app/studio-demo",
    },
  });
  assert.equal(willRenderHeroBanner(p), true);
});

test("willRenderHeroBanner: no buttonLabel/buttonLink at all -> false (today's ordinary standard page)", () => {
  const p = page({ labels: { title: "About us" } });
  assert.equal(willRenderHeroBanner(p), false);
});

test("willRenderHeroBanner: buttonLabel only (no buttonLink) -> false", () => {
  const p = page({ labels: { title: "About us", buttonLabel: "Learn more" } });
  assert.equal(willRenderHeroBanner(p), false);
});

test("willRenderHeroBanner: buttonLink only (no buttonLabel) -> false", () => {
  const p = page({ labels: { title: "About us", buttonLink: "/contact" } });
  assert.equal(willRenderHeroBanner(p), false);
});

test("willRenderHeroBanner: whitespace-only buttonLabel/buttonLink -> false", () => {
  const p = page({ labels: { title: "About us", buttonLabel: "   ", buttonLink: "   " } });
  assert.equal(willRenderHeroBanner(p), false);
});

test("willRenderHeroBanner: an authored home-section:hero block suppresses the banner (PageHero already owns the title)", () => {
  const p = page({
    labels: { title: "Acme", buttonLabel: "Go", buttonLink: "/go" },
    blocks: [
      {
        id: "hero1",
        order: 0,
        enabled: true,
        type: { kind: "home-section", dispatchId: "hero" },
        config: { bindings: [] },
      },
    ],
  });
  assert.equal(willRenderHeroBanner(p), false);
});

test("willRenderHeroBanner: missing labels object entirely -> false (never throws)", () => {
  assert.equal(willRenderHeroBanner({} as Pick<PageConfig, "labels" | "blocks">), false);
});
