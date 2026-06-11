import { PageSkeleton } from "@hillbombcreations/site-renderer";

/**
 * Whole-page loading skeleton — single-sourced from the renderer (1.6.0)
 * so the live site and the Studio preview-shell boot identically.
 */
export default function PageLoading() {
  return <PageSkeleton />;
}
