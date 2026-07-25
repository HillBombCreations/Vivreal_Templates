"use client";

import { useMemo, useState } from "react";
import { DetailPageTemplate } from "@hillbombcreations/site-renderer";
import type {
  DetailPageConfig,
  SiteData as RendererSiteData,
  PageCtaConfig as RendererPageCtaConfig,
} from "@hillbombcreations/site-renderer";
import type { Product } from "@/types/Products";
import type { SiteData } from "@/types/SiteData";
import { useCartContext } from "@/contexts/CartContext";
import SiteRendererBridge from "@/components/SiteRendererBridge";
import FloatingCartDialog from "@/components/PageTemplates/ProductDetailClient/FloatingCartDialog";
import { templatesProductToRenderer } from "./templatesProductToRenderer";

interface ProductDetailRendererProps {
  product: Product;
  siteData: SiteData;
  slug: string;
  /** Per-page detail config (sections, hero variant, related, field visibility). */
  detailPage?: DetailPageConfig;
  /** Per-page CTA config (rendered by DetailPageTemplate's `cta` section). */
  cta?: RendererPageCtaConfig;
}

/**
 * Client wrapper for the product detail route. Renders the renderer's
 * `DetailPageTemplate` (variants + add-to-cart + stock, driven by the
 * CartAdapter from `SiteRendererBridge`) and reuses the existing
 * `FloatingCartDialog` for the post-add confirmation.
 */
export default function ProductDetailRenderer({
  product,
  siteData,
  slug,
  detailPage,
  cta,
}: ProductDetailRendererProps) {
  const { cart } = useCartContext();
  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";
  const rendererProduct = useMemo(() => templatesProductToRenderer(product, siteLogo), [product, siteLogo]);

  const [addedOpen, setAddedOpen] = useState(false);
  // Snapshot the variant/quantity at add time so the dialog doesn't follow
  // later selection changes (matches ProductDetailClient behavior).
  const [addedVariant, setAddedVariant] = useState<string | null>(null);
  const [addedQuantity, setAddedQuantity] = useState(1);

  const cartCount = useMemo(
    () => Object.values(cart || {}).reduce((total, item) => total + (item?.quantity || 0), 0),
    [cart],
  );

  return (
    <SiteRendererBridge>
      <DetailPageTemplate
        slug={slug}
        item={rendererProduct}
        format="products"
        siteData={siteData as unknown as RendererSiteData}
        detailPage={detailPage}
        cta={cta}
        onProductAddedToCart={({ variant, quantity }) => {
          setAddedVariant(variant);
          setAddedQuantity(quantity);
          setAddedOpen(true);
        }}
      />
      <FloatingCartDialog
        open={addedOpen}
        onClose={() => setAddedOpen(false)}
        product={product}
        quantity={addedQuantity}
        cartCount={cartCount}
        variant={addedVariant}
      />
    </SiteRendererBridge>
  );
}
