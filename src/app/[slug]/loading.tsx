import { PageSkeleton } from "@hillbombcreations/site-renderer";

/**
 * Whole-page loading skeleton — single-sourced from the renderer (1.6.0)
 * so the live site and the Studio preview-shell boot identically.
 *
 * `variant="list"` is the renderer's default (byte-identical to the bare
 * `<PageSkeleton />` call this replaces) — passed explicitly for parity with
 * the home/detail skeletons so the archetype is obvious at a glance. `variant`
 * isn't in published renderer 1.24.0's `PageSkeletonProps` yet — spread-cast
 * until that bump publishes, then drop to a plain prop.
 */
export default function PageLoading() {
  return <PageSkeleton {...({ variant: "list" } as Record<string, unknown>)} />;
}
