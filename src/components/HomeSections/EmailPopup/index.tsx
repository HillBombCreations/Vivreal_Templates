"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SubscribeDialog } from "@hillbombcreations/site-renderer";
import type { EmailPopupConfig } from "@hillbombcreations/site-renderer";
import type { SiteData } from "@/types/SiteData";
import { subscribeUser } from "@/lib/api/subscribe/client";

// REUSE the live wrapper's existing keys so users mid-cap aren't reset.
// vivreal_subscribed = permanent "never again" (set on subscribe).
// vivreal_popup_dismissed_at = the dismiss cap timer.
const SUBSCRIBE_KEY = "vivreal_subscribed";
const DISMISS_KEY = "vivreal_popup_dismissed_at";
// Per-tab "session" frequency cap. sessionStorage clears on tab close, so this
// only suppresses re-shows within the same browsing session.
const SESSION_KEY = "vivreal_popup_seen_session";
const DAY_MS = 24 * 60 * 60 * 1000;

// Legacy defaults — absent config MUST reproduce today's behavior byte-for-byte.
const LEGACY_DELAY_MS = 3000;
const LEGACY_FREQUENCY_DAYS = 1; // 24h cap (NOT the 7d editor default)

export interface EmailPopupProps {
  /**
   * The site-level `emailPopup` config. ABSENT (or `{}`) ⇒ legacy behavior:
   * home-only, 3000ms delay, 24h cap, default copy, on-iff-subscribers-collection.
   * Each field resolves independently: absent ⇒ legacy default, present ⇒ override.
   */
  config?: EmailPopupConfig | null;
  siteData: SiteData;
}

/**
 * Thin client wrapper around the renderer's presentational SubscribeDialog. Owns
 * the trigger policy (delay / scroll / exit-intent), the frequency cap
 * (localStorage/sessionStorage), the page-targeting (self-gates by route since
 * it now mounts in the shared layout on EVERY route), the collectionId
 * resolution, and the subscribe API call. The dialog presentation lives in the
 * renderer so the Studio preview shows the exact same overlay the live site does.
 *
 * No-regression: with no `config`, every field falls back to the legacy default,
 * so an un-authored site behaves identically to before the layout mount-move
 * (home-only, 3000ms, 24h cap, default copy).
 */
const EmailPopup = ({ config, siteData }: EmailPopupProps) => {
  const cfg = config ?? {};
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // ── Enabled: explicit override, else legacy implicit-on (subscribers exists).
  const hasSubscribers = (siteData?.pageConfigs ?? []).some(
    (p) => p.format === "subscribers",
  );
  const enabled = cfg.enabled ?? hasSubscribers;

  // ── Page-targeting. The wrapper now mounts on every route via the layout, so
  // it MUST self-gate. ABSENT pages config ⇒ HOME-ONLY (legacy). Authored:
  // 'all' ⇒ every page; 'include' ⇒ slug ∈ slugs; 'exclude' ⇒ slug ∉ slugs.
  // Home route is "/" (Templates has no basePath); other pages are "/{slug}".
  const currentSlug = (pathname ?? "/").replace(/^\/+/, "").replace(/\/+$/, "");
  const isHome = currentSlug === "";
  const pageAllowed = ((): boolean => {
    const pages = cfg.pages;
    if (!pages?.mode) return isHome; // legacy: home-only
    if (pages.mode === "all") return true;
    const slugs = pages.slugs ?? [];
    if (pages.mode === "include") return slugs.includes(currentSlug);
    if (pages.mode === "exclude") return !slugs.includes(currentSlug);
    return isHome;
  })();

  // ── Resolve collectionId. Precedence (per SP-6 Task 6 / OQ-7):
  //   1. cfg.collectionId — Studio-authored EmailPopup override. MUST stay FIRST:
  //      demoting it would silently re-target the live popup to the wrong list on
  //      any site that set an explicit override (reviewer Concern #1).
  //   2. subscribe block binding on the synthetic subscribers page (D-G, Task 8).
  //      After VR_Client_API Task 8 deploys, the synthetic page carries a
  //      page-template:subscribe block whose binding.collectionId matches the
  //      legacy collectionId field exactly — this path becomes the canonical read.
  //   3. Legacy subPage.collectionId — fallback through the SP-7 $unset window.
  //      Before Task 8 deploys, the block lookup misses and this leg keeps the
  //      live popup working. After Task 8, both legs return the same value; the
  //      block leg wins first, the legacy leg remains as a belt-and-suspenders
  //      fallback until SP-7 $unsets it.
  //   4. "" — no subscribers collection found; subscribeUser is a no-op.
  const subPage = siteData?.pageConfigs?.find((p) => p.format === "subscribers");
  const collectionId =
    cfg.collectionId ??
    subPage?.blocks
      ?.find(
        (b) =>
          b?.type?.kind === "page-template" &&
          b?.type?.dispatchId === "subscribe",
      )
      ?.config?.bindings?.find((bd) => bd.collectionId)?.collectionId ??
    subPage?.collectionId ??
    "";

  // Guard so trigger listeners can't fire after we've decided to open / unmount.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !pageAllowed) return;

    // ── Frequency cap. ABSENT ⇒ 'days' 24h (legacy). Subscribe is always a
    // permanent never-again regardless of mode.
    if (localStorage.getItem(SUBSCRIBE_KEY)) return;

    const freqMode = cfg.frequency?.mode ?? "days";
    if (freqMode === "session") {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } else if (freqMode === "ever") {
      // Permanent dismiss: any prior dismiss timestamp suppresses forever.
      if (localStorage.getItem(DISMISS_KEY)) return;
    } else {
      // 'days' — timestamp + N days. Absent days ⇒ legacy 24h.
      const days = cfg.frequency?.days ?? LEGACY_FREQUENCY_DAYS;
      const lastDismissed = localStorage.getItem(DISMISS_KEY);
      if (lastDismissed) {
        const elapsed = Date.now() - parseInt(lastDismissed, 10);
        if (Number.isFinite(elapsed) && elapsed <= days * DAY_MS) return;
      }
    }

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      setOpen(true);
    };

    // ── Trigger. ABSENT ⇒ 'delay' 3000ms (legacy).
    const triggerMode = cfg.trigger?.mode ?? "delay";

    if (triggerMode === "scroll") {
      const pct = Math.min(Math.max(cfg.trigger?.scrollPct ?? 50, 0), 100);
      const onScroll = () => {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - doc.clientHeight;
        // Degenerate (non-scrollable) page: fire immediately so the popup
        // isn't unreachable.
        const reached =
          scrollable <= 0 || (doc.scrollTop / scrollable) * 100 >= pct;
        if (reached) fire();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll(); // evaluate initial position
      return () => window.removeEventListener("scroll", onScroll);
    }

    if (triggerMode === "exit") {
      // Exit-intent only works with a fine pointer that can leave the top
      // viewport edge. On touch / coarse pointers, fall back to delay so those
      // users still see the popup.
      const hasFinePointer =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (hasFinePointer) {
        const onMouseOut = (e: MouseEvent) => {
          // Leaving the document through the top edge (relatedTarget null).
          if (!e.relatedTarget && e.clientY <= 0) fire();
        };
        document.addEventListener("mouseout", onMouseOut);
        return () => document.removeEventListener("mouseout", onMouseOut);
      }
      // Fall through to delay on touch / coarse pointer.
      const timer = setTimeout(fire, LEGACY_DELAY_MS);
      return () => clearTimeout(timer);
    }

    // 'delay' (default).
    const delayMs = cfg.trigger?.delayMs ?? LEGACY_DELAY_MS;
    const timer = setTimeout(fire, delayMs);
    return () => clearTimeout(timer);
    // Re-evaluate when route changes (pageAllowed) or config identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pageAllowed, pathname, cfg.trigger?.mode, cfg.trigger?.delayMs, cfg.trigger?.scrollPct, cfg.frequency?.mode, cfg.frequency?.days]);

  if (!enabled || !pageAllowed) return null;

  const copy = cfg.copy ?? {};

  return (
    <SubscribeDialog
      open={open}
      onClose={() => {
        setOpen(false);
        // 'session' mode records per-tab; all others record the dismiss
        // timestamp ('ever' treats any timestamp as permanent; 'days' caps).
        if ((cfg.frequency?.mode ?? "days") === "session") {
          sessionStorage.setItem(SESSION_KEY, "1");
        } else {
          localStorage.setItem(DISMISS_KEY, Date.now().toString());
        }
      }}
      siteName={siteData?.businessInfo?.name || siteData?.name || "us"}
      accent={siteData?.primary}
      surface={siteData?.surface}
      textInverse={siteData?.["text-inverse"]}
      heading={copy.heading}
      subtitle={copy.subtitle}
      placeholder={copy.placeholder}
      buttonLabel={copy.buttonLabel}
      successText={copy.successText}
      errorText={copy.errorText}
      consentText={copy.consentText}
      // Levain round — split-image layout. Pass-through only (image.src is a
      // ready URL per the pre-signed contract); absent ⇒ centered legacy card.
      variant={cfg.variant}
      image={cfg.image}
      onSubscribe={async (email) => {
        const ok = await subscribeUser(email, collectionId);
        // Permanent "never again" on success, regardless of frequency mode.
        if (ok) localStorage.setItem(SUBSCRIBE_KEY, "true");
        return ok;
      }}
    />
  );
};

export default EmailPopup;
