import NeutralPageLoading from "@/components/NeutralPageLoading";

/**
 * [slug] route-level fallback — shape-neutral chrome (see NeutralPageLoading
 * for the full rationale). Every [slug] page now streams its own
 * structure-derived skeleton (ComposedPageSkeleton) from the page component
 * itself, where format/labels/displayAs ARE known — this file only covers
 * the brief window before the page's cached config resolves. The old
 * card-grid guess rendered the wrong shape for catalogs, menus, schedules.
 */
export default function PageLoading() {
  return <NeutralPageLoading />;
}
