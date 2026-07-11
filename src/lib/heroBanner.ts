import type { PageConfig } from "@/types/SiteData";

/**
 * Whether the renderer's `composePage()` will emit a synthetic `kind:'banner'`
 * hero section for this page — mirrors the renderer's OWN gate exactly
 * (`vivreal-site-renderer/src/composition/blocks.ts` `mapBlocks`:
 * `!isHome && !hasHomeSectionBlock && buttonLabel && buttonLink`). `isHome` is
 * omitted here because it is always `false` on the generic composed-page path
 * both page wrappers use (`renderComposedPage`/`[slug]/page.tsx` never render
 * the home route through this helper).
 *
 * SINGLE SOURCE OF TRUTH for the two page-wrapper files that each carry a bare
 * `labels.title`/`labels.subtitle` "transitional title band" fallback
 * (`renderComposedPage.tsx`, `app/[slug]/page.tsx`) — that fallback MUST
 * self-disable exactly when this returns `true`, or the page renders the same
 * title twice: once bare/button-less (the fallback), once correctly inside the
 * banner with its subtitle + button (2026-07-10, confirmed on `/studio-demo`:
 * "Build a site in under 60 seconds" rendered twice before this fix). Import
 * this rather than re-deriving the condition inline in a third place — the two
 * page wrappers already hand-duplicate their OWN title-band gate (documented
 * "mirrors X so the two cannot drift"), which is exactly the kind of
 * copy-drift that let the double-title bug through in the first place.
 */
export function willRenderHeroBanner(page: Pick<PageConfig, "labels" | "blocks">): boolean {
  const hasHomeSectionBlock = (page.blocks ?? []).some(
    (b) => b?.type?.kind === "home-section",
  );
  const buttonLabel = (page.labels?.buttonLabel ?? "").trim();
  const buttonLink = (page.labels?.buttonLink ?? "").trim();
  return !hasHomeSectionBlock && !!buttonLabel && !!buttonLink;
}
