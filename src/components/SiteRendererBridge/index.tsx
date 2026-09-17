"use client";

import type { ReactNode } from "react";
import { NextSiteRendererProvider } from "@hillbombcreations/site-renderer";
import { useCartAdapter } from "@/lib/cartAdapter";
import { useSiteData } from "@/contexts/SiteDataContext";

/**
 * Bridges server components into the renderer's client context with the live
 * cart adapter (null when the site mounts no bag) and the group's payments
 * state, which opts the storefront into the Phase 0.2 purchase rule.
 *
 * The root `Providers` already mounts a `NextSiteRendererProvider`, but the
 * `CartAdapter` it can supply depends on `useCartContext` (only present on
 * ecommerce sites). This bridge re-provides the context with the live adapter
 * around product list/detail routes so renderer cart sections work end-to-end.
 */
export default function SiteRendererBridge({ children }: { children: ReactNode }) {
  const cartAdapter = useCartAdapter();
  const siteData = useSiteData();
  return (
    <NextSiteRendererProvider
      CartAdapter={cartAdapter}
      commerce={{ paymentsProvider: siteData?.paymentsProvider }}
    >
      {children}
    </NextSiteRendererProvider>
  );
}
