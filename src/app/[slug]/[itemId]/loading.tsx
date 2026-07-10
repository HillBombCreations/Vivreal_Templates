import { PageSkeleton } from "@hillbombcreations/site-renderer";

/**
 * Item-detail skeleton — single-sourced from the renderer's `PageSkeleton`
 * (`variant="detail"`) so the live site and the Studio preview-shell boot
 * identically.
 *
 * `variant` isn't in published renderer 1.24.0's `PageSkeletonProps` yet — it
 * lands with the `feat/test-vivreal-residual-parity` branch in
 * vivreal-site-renderer, currently unpublished. Spread-cast until that bump
 * publishes (same pattern as the old Navbar headerWidth/logoHeight cast),
 * then drop to a plain `variant="detail"` prop.
 */
export default function ItemLoading() {
  return <PageSkeleton {...({ variant: "detail" } as Record<string, unknown>)} />;
}
