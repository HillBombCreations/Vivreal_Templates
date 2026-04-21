'use client';

import type { ReactNode } from 'react';
import { NextSiteRendererProvider } from '@hillbombcreations/site-renderer';
import { useOptionalCart } from '@/contexts/CartContext';
import { useCartAdapter } from '@/lib/cartAdapter';

/**
 * Bridges this repo's `CartContext` to the renderer's `SiteRendererContext`
 * via the v0.4.0 `CartAdapter` prop on `NextSiteRendererProvider`. Mounted
 * beneath `CartProvider` so `useCartAdapter` can read `useCartContext`.
 *
 * On sites without a CartProvider (showcase / team sites that don't render
 * product pages), we fall through to a provider without a cart adapter —
 * `DetailAddToCart` handles the null-adapter case by rendering a disabled
 * placeholder.
 */
export default function SiteRendererBridge({ children }: { children: ReactNode }) {
  const cart = useOptionalCart();
  // useCartAdapter calls useCartContext() which throws outside the provider,
  // so only call it when we have a cart. Render two branches to satisfy
  // hook rules.
  if (cart) {
    return <SiteRendererBridgeWithCart>{children}</SiteRendererBridgeWithCart>;
  }
  return <NextSiteRendererProvider>{children}</NextSiteRendererProvider>;
}

function SiteRendererBridgeWithCart({ children }: { children: ReactNode }) {
  const adapter = useCartAdapter();
  return (
    <NextSiteRendererProvider CartAdapter={adapter}>
      {children}
    </NextSiteRendererProvider>
  );
}
