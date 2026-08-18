"use client";

import {
  ScheduleProvider,
  ScheduleStorefront,
} from "@hillbombcreations/site-renderer";
import type {
  ScheduleStop,
  SchedulePageConfig,
  ScheduleStorefrontSlots,
  SiteData as RendererSiteData,
  ScheduleView,
} from "@hillbombcreations/site-renderer";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useSiteData } from "@/contexts/SiteDataContext";

// S2 — local props type matching the renderer's CoordinatedScheduleProps (not
// yet exported in the installed 1.17.0; this interface will be replaced by the
// imported type once the renderer is published and the package is bumped).
// The shape MUST match `CoordinatedScheduleProps` in the renderer's
// `src/composition/types.ts` — `contract.types.ts` will enforce this post-publish.
interface ShapedSchedulePayload {
  upNext: ScheduleStop | null;
  upcoming: ScheduleStop[];
  past: ScheduleStop[];
  recurring: ScheduleStop[];
  pageConfig: SchedulePageConfig;
  showHeader?: boolean;
}

interface CoordinatedScheduleProps {
  shaped: ShapedSchedulePayload;
  slots: ScheduleStorefrontSlots;
  siteData: RendererSiteData;
  slug: string;
  initialView?: ScheduleView;
  /** NEW-A page-h1 election verdict — MUST be forwarded to ScheduleProvider. */
  pageHeadingLevel?: "h1" | "h2";
}

/**
 * Live wiring for the ATOMIZED schedule topology — `group(coordinated:'schedule')`.
 *
 * Injected into composePage via `CompositionOptions.components.CoordinatedSchedule`
 * (S2). The renderer's coordinated arm (`renderGroup`) resolves the schedule
 * payload ONCE at the group boundary and hands THIS component
 * `{ shaped, slots, siteData, slug, initialView }`; composePage renders the BARE
 * `<ScheduleProvider><ScheduleStorefront/>` (uncontrolled) for the Studio preview,
 * so the preview is unaffected.
 *
 * S2 responsibilities vs the bare preview path:
 *   1. `?view=` URL-sync: `onViewChange` pushes `?view=<v>` to the URL via
 *      router.replace (shallow, no scroll). Browser back/forward changes the
 *      URL → Next.js re-renders the [slug] server component with the new
 *      searchParam → `initialView` changes → the ScheduleProvider's controlled-
 *      view `useEffect` fires → the active tab switches. This is the full
 *      round-trip for shareable tab URLs (OD#3 LOCKED).
 *   2. Keyed Google Maps: `mapsApiKey` flows from SiteRendererContext (injected
 *      by the NextSiteRendererProvider in the app's Providers) → ScheduleProvider
 *      reads it from context → passes it to mapEmbedUrl → keyed Embed API URL.
 *      No extra prop threading needed here.
 *
 * It renders `ScheduleProvider` + `ScheduleStorefront` DIRECTLY (not the monolith
 * `SchedulePage`) so it can pass `slots` — it MUST forward `slots` so hidden
 * parts stay hidden. It MUST NOT double-provider (the renderer arm no longer
 * wraps it when this override is set).
 */
export default function CoordinatedScheduleComposed({
  shaped,
  slots,
  slug,
  initialView,
  pageHeadingLevel,
}: CoordinatedScheduleProps) {
  const siteData = useSiteData();
  const router = useRouter();

  // S2/OD#3 — URL-sync callback. Called by ScheduleProvider's setView wrapper.
  // router.replace is used (not push) so tab switches don't pollute history —
  // only navigating TO the schedule page adds a history entry.
  // `scroll: false` prevents the page from jumping to top on tab switch.
  const onViewChange = useCallback(
    (v: "agenda" | "month" | "map") => {
      const url = new URL(window.location.href);
      url.searchParams.set("view", v);
      router.replace(url.pathname + url.search, { scroll: false });
    },
    [router],
  );

  return (
    <ScheduleProvider
      upNext={shaped.upNext}
      upcoming={shaped.upcoming}
      past={shaped.past}
      recurring={shaped.recurring}
      pageConfig={shaped.pageConfig}
      slug={slug}
      siteData={siteData as unknown as RendererSiteData}
      showHeader={shaped.showHeader}
      // NEW-A (Item 8): dropping this is preview-green/live-red — the Studio
      // preview renders the renderer's bare provider, live renders THIS wrapper.
      pageHeadingLevel={pageHeadingLevel}
      initialView={initialView}
      onViewChange={onViewChange}
    >
      <ScheduleStorefront slots={slots} />
    </ScheduleProvider>
  );
}
