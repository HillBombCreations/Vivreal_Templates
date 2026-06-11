"use client";

import { useEffect, useState } from "react";
import { SubscribeDialog } from "@hillbombcreations/site-renderer";
import { subscribeUser } from "@/lib/api/subscribe/client";
import type { HomeSectionProps } from "../index";

const SUBSCRIBE_KEY = "vivreal_subscribed";
const DISMISS_KEY = "vivreal_popup_dismissed_at";
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Thin wrapper around the renderer's SubscribeDialog (1.6.0). This component
 * keeps ONLY the trigger policy (localStorage subscribe/dismiss gates + delay
 * timer), the collectionId resolution, and the subscribe API call — the
 * dialog presentation lives in the renderer so the Studio preview shows the
 * exact same overlay the deployed site does.
 */
const EmailPopup = ({ config, siteData }: HomeSectionProps) => {
  // Resolve collectionId: explicit config, or find the subscribers page's collectionId
  const collectionId =
    (config.collectionId as string) ||
    siteData?.pageConfigs?.find((p) => p.format === "subscribers")?.collectionId ||
    "";

  const delayMs = (config.delayMs as number) || 3000;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const subscribed = localStorage.getItem(SUBSCRIBE_KEY);
    const lastDismissed = localStorage.getItem(DISMISS_KEY);
    const now = Date.now();

    if (!subscribed) {
      if (!lastDismissed || now - parseInt(lastDismissed, 10) > DAY_MS) {
        const timer = setTimeout(() => setOpen(true), delayMs);
        return () => clearTimeout(timer);
      }
    }
  }, [delayMs]);

  return (
    <SubscribeDialog
      open={open}
      onClose={() => {
        setOpen(false);
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
      }}
      siteName={siteData?.businessInfo?.name || siteData?.name || "us"}
      accent={siteData?.primary}
      surface={siteData?.surface}
      textInverse={siteData?.["text-inverse"]}
      onSubscribe={async (email) => {
        const ok = await subscribeUser(email, collectionId);
        if (ok) localStorage.setItem(SUBSCRIBE_KEY, "true");
        return ok;
      }}
    />
  );
};

export default EmailPopup;
