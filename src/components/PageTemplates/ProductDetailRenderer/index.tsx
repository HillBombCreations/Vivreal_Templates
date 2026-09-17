"use client";

import { useMemo, useState } from "react";
import { DetailPageTemplate } from "@hillbombcreations/site-renderer";
import type {
  DetailPageConfig,
  DetailProductData,
  SiteData as RendererSiteData,
  PageCtaConfig as RendererPageCtaConfig,
  StorefrontSectionConfig,
} from "@hillbombcreations/site-renderer";
import type { SiteData } from "@/types/SiteData";
import { useOptionalCart } from "@/contexts/CartContext";
import { rendererProductToTemplates } from "@/lib/cartProduct";
import SiteRendererBridge from "@/components/SiteRendererBridge";
import FloatingCartDialog from "@/components/PageTemplates/ProductDetailClient/FloatingCartDialog";

interface ProductDetailRendererProps {
  /** The product in the renderer's shape: a provider product via `templatesProductToRenderer`, or a collection item via `contentItemToProduct`. */
  item: DetailProductData;
  siteData: SiteData;
  slug: string;
  detailPage?: DetailPageConfig;
  cta?: RendererPageCtaConfig;
  /** Storefront Phase 0: the page's storefront binding config (Contract 1: purchase mode, spec fields, shell). */
  storefrontConfig?: StorefrontSectionConfig;
}

/**
 * Client wrapper for the product detail route. Renders the renderer's
 * `DetailPageTemplate` inside `SiteRendererBridge`. The post-add confirmation
 * mounts only when the site has a bag: an inquiry-only site (Storefront Phase
 * 0.2) mounts no CartProvider, and the dialog would throw without one.
 */
export default function ProductDetailRenderer({
  item,
  siteData,
  slug,
  detailPage,
  cta,
  storefrontConfig,
}: ProductDetailRendererProps) {
  const cartCtx = useOptionalCart();
  const cartProduct = useMemo(() => rendererProductToTemplates(item), [item]);
  const [addedOpen, setAddedOpen] = useState(false);
  const [addedVariant, setAddedVariant] = useState<string | null>(null);
  const [addedQuantity, setAddedQuantity] = useState(1);
  const cartCount = useMemo(
    () => Object.values(cartCtx?.cart || {}).reduce((total, line) => total + (line?.quantity || 0), 0),
    [cartCtx?.cart],
  );

  return (
    <SiteRendererBridge>
      <DetailPageTemplate
        slug={slug}
        item={item}
        format="products"
        siteData={siteData as unknown as RendererSiteData}
        detailPage={detailPage}
        cta={cta}
        storefrontConfig={storefrontConfig}
        onProductAddedToCart={({ variant, quantity }) => {
          setAddedVariant(variant);
          setAddedQuantity(quantity);
          setAddedOpen(true);
        }}
      />
      {cartCtx ? (
        <FloatingCartDialog
          open={addedOpen}
          onClose={() => setAddedOpen(false)}
          product={cartProduct}
          quantity={addedQuantity}
          cartCount={cartCount}
          variant={addedVariant}
        />
      ) : null}
    </SiteRendererBridge>
  );
}
