/**
 * Two-axis detail-route design, Phase 3 (§7.1/§15.2)
 * (docs/projects/industry-example-site-templates/two-axis-detail-route-design.md).
 *
 * `detailPage.seo.canonicalFrom`:
 *   - `'self'`    — this scoped cell IS a distinct page; canonicalize to its
 *                   own URL. The decided default when `scope` is present
 *                   (§15.2 — "cells are distinct by construction").
 *   - `'primary'` — canonicalize to the UNSCOPED host of the same item pool
 *                   (the anti-doorway lever for a future tenant that wants
 *                   scoped cells folded into one ranking URL).
 *
 * Pure (no fetch) — the caller already has `pageConfigs` from `siteData`.
 */
import type { PageConfig } from "@/types/SiteData";

/**
 * Deliberately NOT importing the renderer's `itemSegment` here: this file is
 * unit-tested under plain `node --test`, and the renderer package's barrel
 * (`index.ts`) pulls in client components that import `next/link` — the
 * exact "server-only lesson" this repo has hit before (`mapItem.ts`'s header
 * comment). A 4-line duplicate is cheaper than a module-resolution failure.
 * Semantics MUST stay identical to `vivreal-site-renderer/src/lib/itemSegment.ts`.
 */
function itemSegment(item: { id?: string; raw?: Record<string, unknown> }, itemKeyField?: string): string {
  if (itemKeyField) {
    const v = item.raw?.[itemKeyField];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return item.id ?? "";
}

export interface CanonicalArgs {
  origin: string;
  pageConfigs: PageConfig[];
  currentPage: PageConfig;
  currentUrl: string;
  item: { id: string; raw?: Record<string, unknown> };
  canonicalFrom: "self" | "primary" | undefined;
}

/**
 * Resolve the canonical URL for a detail-route cell. Absent `canonicalFrom`
 * ⇒ `undefined` (no `alternates.canonical` emitted — today's behavior).
 */
export function resolveDetailCanonical({
  origin,
  pageConfigs,
  currentPage,
  currentUrl,
  item,
  canonicalFrom,
}: CanonicalArgs): string | undefined {
  if (!canonicalFrom) return undefined;
  if (canonicalFrom === "self") return currentUrl;

  // 'primary' — find another page hosting the SAME item pool with no scope
  // (the unscoped taxonomy host). No pool identity to compare, or no such
  // host exists ⇒ degrade to 'self' rather than omit the tag entirely — a
  // missing canonical is worse than a self-canonical on a scoped cell.
  const collectionId = currentPage.detailPage?.itemCollectionId;
  if (!collectionId) return currentUrl;
  const primaryPage = pageConfigs.find(
    (p) =>
      p.slug !== currentPage.slug &&
      p.detailPage?.itemCollectionId === collectionId &&
      !p.detailPage?.scope,
  );
  if (!primaryPage) return currentUrl;

  const segment = itemSegment(item, primaryPage.detailPage?.itemKeyField);
  return `${origin}/${primaryPage.slug}/${segment}`;
}
