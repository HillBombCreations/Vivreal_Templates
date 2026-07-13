import NeutralPageLoading from "@/components/NeutralPageLoading";

/**
 * Root route-level fallback — shape-neutral chrome (see NeutralPageLoading
 * for the full rationale). The home page renders its hero-shaped skeleton
 * via its own inline Suspense boundary (app/page.tsx → HomeLoading); every
 * other page renders its structure-derived ComposedPageSkeleton behind the
 * page-owned boundary. This file only covers the brief window before a
 * page's config resolves.
 */
export default function RootLoading() {
  return <NeutralPageLoading />;
}
