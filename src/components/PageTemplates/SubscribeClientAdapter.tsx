"use client";

/**
 * SP-6 Task 3 — SubscribeClient adapter for composePage injection (MANDATORY for tsc).
 *
 * SubscribeClient.labels is Record<string, string> (narrower).
 * The renderer's SubscribePageProps.labels is Record<string, unknown> (wider).
 * Props are contravariant: SubscribeClient cannot satisfy ComponentType<SubscribePageProps>
 * directly — it would only be safe if it accepted the WIDER type, but it declares the
 * NARROWER one. This adapter bridges the gap:
 *   - Accepts props matching the renderer's SubscribePageProps shape
 *     (NOTE: SubscribePageProps is NOT re-exported from the renderer's package
 *     entry point — the type is declared inline here to avoid a deep-import that
 *     violates the package's exports map; keep in sync with
 *     site-renderer/src/PageTemplates/SubscribePage.tsx if the props change)
 *   - Narrows labels from Record<string,unknown> to Record<string,string>
 *   - Forwards collectionId and stringified labels to SubscribeClient
 *
 * SubscribeClient ignores the injected siteData/slug props (reads useSiteData()
 * context internally) — the adapter only forwards the load-bearing fields.
 */

import SubscribeClient from "@/components/PageTemplates/SubscribeClient";

/** Local mirror of the renderer's SubscribePageProps (not exported from package entry). */
interface SubscribeAdapterProps {
  labels?: Record<string, unknown>;
  siteData?: unknown;
  slug?: string;
  collectionId?: string;
  /** §11.8 — a composed page-header hero owns the h1; the client demotes its heading to h2. */
  headerDemoted?: boolean;
}

export default function SubscribeClientAdapter({
  collectionId,
  labels,
  headerDemoted,
}: SubscribeAdapterProps) {
  // Narrow Record<string, unknown> → Record<string, string> by discarding non-string values.
  // SubscribeClient reads: title, subtitle, placeholder, buttonLabel, successMessage,
  // disclaimer — all string fields in practice. Unknown values silently become undefined.
  const stringLabels: Record<string, string> = {};
  for (const [k, v] of Object.entries(labels ?? {})) {
    if (typeof v === "string") stringLabels[k] = v;
  }

  return (
    <SubscribeClient
      collectionId={collectionId ?? ""}
      labels={stringLabels}
      headerDemoted={headerDemoted}
    />
  );
}
