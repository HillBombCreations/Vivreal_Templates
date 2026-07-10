import { PageSkeleton } from "@hillbombcreations/site-renderer";

/**
 * Home skeleton — single-sourced from the renderer's `PageSkeleton`
 * (`variant="home"`) so the live site and the Studio preview-shell boot
 * identically. Used as both the route-level `loading.tsx` fallback AND the
 * inline `<Suspense fallback={<HomeLoading/>}>` in `page.tsx` (same import).
 *
 * `variant` isn't in published renderer 1.24.0's `PageSkeletonProps` yet — it
 * lands with the `feat/test-vivreal-residual-parity` branch in
 * vivreal-site-renderer, currently unpublished. Spread-cast until that bump
 * publishes (same pattern as the old Navbar headerWidth/logoHeight cast),
 * then drop to a plain `variant="home"` prop.
 */
export default function HomeLoading() {
  return <PageSkeleton {...({ variant: "home" } as Record<string, unknown>)} />;
}
