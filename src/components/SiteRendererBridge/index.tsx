"use client";

import type { ReactNode } from "react";
import { NextSiteRendererProvider } from "@hillbombcreations/site-renderer";
import { useCartAdapter } from "@/lib/cartAdapter";

/**
 * Bridges server components into the renderer's client context with a real,
 * cart-backed `CartAdapter`.
 *
 * The root `Providers` already mounts a `NextSiteRendererProvider`, but the
 * `CartAdapter` it can supply depends on `useCartContext` (only present on
 * ecommerce sites). This bridge re-provides the context with the live adapter
 * around product list/detail routes so renderer cart sections work end-to-end.
 *
 * Must be rendered inside a `CartProvider` (it reads the cart via the hook).
 */
export default function SiteRendererBridge({ children }: { children: ReactNode }) {
  const cartAdapter = useCartAdapter();
  return (
    <NextSiteRendererProvider CartAdapter={cartAdapter}>
      {children}
    </NextSiteRendererProvider>
  );
}
