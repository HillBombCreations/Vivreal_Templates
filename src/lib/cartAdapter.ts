'use client';

/**
 * Cart adapter — binds `@hillbombcreations/site-renderer`'s `CartAdapter`
 * interface to this repo's `useCartContext`-backed cart.
 *
 * Created for v0.4.0 renderer's `DetailPageTemplate` (Phase 5b). The
 * renderer's `DetailAddToCart` + `DetailVariants` sub-components read the
 * adapter from `SiteRendererContext`, so we build one here and feed it
 * into `NextSiteRendererProvider` at the layout level.
 */

import { useMemo } from 'react';
import type { CartAdapter, DetailProductData } from '@hillbombcreations/site-renderer';
import type { Product } from '@/types/Products';
import { useCartContext } from '@/contexts/CartContext';
import { useSiteData } from '@/contexts/SiteDataContext';
import { handleAddToCart, handleCheckout } from '@/lib/utils/cartUtils';
import { resolveVariant, resolveVariantableString, getSafeFieldValue } from '@/lib/utils/variantUtils';

/**
 * Hook returning a stable `CartAdapter` bound to the Templates cart
 * context. Memoized on dependencies — re-creates when `cart` / `setCart`
 * identity changes.
 */
export function useCartAdapter(): CartAdapter {
  const { cart, setCart } = useCartContext();
  const siteData = useSiteData();

  return useMemo<CartAdapter>(
    () => ({
      addToCart: ({ product, variant, quantity }) => {
        handleAddToCart({
          product: product as Product,
          selectedVariant: variant,
          quantity,
          cart,
          setCart,
        });
      },
      buyNow: async ({ product, variant, quantity }) => {
        const resolvedVariant = resolveVariant(variant, product as Product) ?? 'default';
        const priceID = resolveVariantableString((product as Product).default_price, variant) ?? '';
        const name = getSafeFieldValue(product as Product, 'name', variant) ?? '';
        const price = getSafeFieldValue(product as Product, 'price', variant) ?? '';
        const imageUrl = getSafeFieldValue(product as Product, 'imageUrl', variant) ?? '';
        await handleCheckout({
          cart: {
            [`${(product as DetailProductData)._id}_${resolvedVariant}`]: {
              _id: (product as DetailProductData)._id,
              quantity,
              name,
              price,
              priceID,
              imageUrl,
              variant: resolvedVariant,
            },
          },
          requiresShipping: siteData?.businessInfo?.shipping !== false,
          originUrl: window.location.origin,
        });
      },
      getCartCount: () => {
        return Object.values(cart).reduce(
          (total, item) => total + (item?.quantity || 0),
          0,
        );
      },
    }),
    [cart, setCart, siteData],
  );
}
