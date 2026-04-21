'use client';

import { useState } from 'react';
import {
  DetailPageTemplate,
  type DetailItem,
  type DetailPageConfig,
  type DetailProductData,
  type DetailSupplementalData,
  type DetailTikTokEmbed,
  type SiteData as RendererSiteData,
} from '@hillbombcreations/site-renderer';
import FloatingCartDialog from '@/components/Cart/FloatingCartDialog';
import { useOptionalCart } from '@/contexts/CartContext';
import type { Product } from '@/types/Products';
import type { PageCtaConfig } from '@/types/SiteData';

export interface DetailPageClientProps {
  slug: string;
  item: DetailItem;
  format: string;
  cta?: PageCtaConfig;
  detailPage?: DetailPageConfig;
  siteData: RendererSiteData;
  socialEmbeds: DetailTikTokEmbed[];
  supplementalFeeds: DetailSupplementalData[];
}

/**
 * Client-side wrapper around the renderer's `DetailPageTemplate`.
 *
 * Its job is to own the floating "Added to bag" dialog that the old
 * `ProductDetailClient` used to render. The renderer doesn't ship a
 * floating toast (intentional — that chrome is app-specific), so the
 * consumer (this file) handles it via the `onProductAddedToCart` callback
 * the template exposes.
 *
 * For non-product formats this component is a thin pass-through.
 */
export default function DetailPageClient({
  slug,
  item,
  format,
  cta,
  detailPage,
  siteData,
  socialEmbeds,
  supplementalFeeds,
}: DetailPageClientProps) {
  const cart = useOptionalCart();

  // Snapshot held while the floating dialog is open, so user variant/qty
  // changes underneath don't mutate the confirmation state.
  const [addedOpen, setAddedOpen] = useState(false);
  const [addedSnapshot, setAddedSnapshot] = useState<{
    product: DetailProductData;
    variant: string | null;
    quantity: number;
  } | null>(null);

  const cartCount = cart
    ? Object.values(cart.cart).reduce((t, i) => t + (i?.quantity || 0), 0)
    : 0;

  return (
    <>
      <DetailPageTemplate
        slug={slug}
        item={item}
        format={format}
        cta={cta}
        detailPage={detailPage}
        siteData={siteData}
        socialEmbeds={socialEmbeds}
        supplementalFeeds={supplementalFeeds}
        onProductAddedToCart={(snapshot) => {
          setAddedSnapshot(snapshot);
          setAddedOpen(true);
        }}
      />

      {format === 'products' && addedSnapshot ? (
        <FloatingCartDialog
          open={addedOpen}
          onClose={() => setAddedOpen(false)}
          product={addedSnapshot.product as unknown as Product}
          quantity={addedSnapshot.quantity}
          cartCount={cartCount}
          variant={addedSnapshot.variant}
        />
      ) : null}
    </>
  );
}
