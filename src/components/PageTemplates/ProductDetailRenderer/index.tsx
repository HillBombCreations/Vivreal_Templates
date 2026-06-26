"use client";

import { useMemo, useState } from "react";
import { DetailPageTemplate } from "@hillbombcreations/site-renderer";
import type {
  DetailProductData,
  DetailPageConfig,
  SiteData as RendererSiteData,
  PageCtaConfig as RendererPageCtaConfig,
} from "@hillbombcreations/site-renderer";
import type { Product } from "@/types/Products";
import type { SiteData } from "@/types/SiteData";
import { useCartContext } from "@/contexts/CartContext";
import SiteRendererBridge from "@/components/SiteRendererBridge";
import FloatingCartDialog from "@/components/PageTemplates/ProductDetailClient/FloatingCartDialog";

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
 * Maps the Templates `Product` → renderer `DetailProductData`. Field names are
 * shared across both repos, so this is a direct structural pass-through that
 * also carries `stock` + `lowStockThreshold` for the renderer's per-variant
 * stock display.
 */
function templatesProductToRenderer(product: Product, siteLogo: string): DetailProductData {
  return {
    _id: product._id,
    name: product.name,
    price: product.price,
    description: product.description,
    // Fall back to the site logo when the product has no image — matches the
    // products list (ProductsPageClient).
    imageUrl: product.imageUrl || siteLogo,
    // srcset only for the non-variant (flat string) image — when imageUrl is a
    // variant map (or the siteLogo fallback) there is no flat derivative set.
    imageSrcSet:
      typeof product.imageUrl === "string" && typeof product.imageSrcSet === "string"
        ? product.imageSrcSet || undefined
        : undefined,
    // Gallery has NO siteLogo fallback: an empty gallery signals the hero to
    // use the single-image (imageUrl) path. Only real galleries populate it.
    gallery: product.gallery,
    // Index-aligned only for a FLAT gallery (variant galleries carry no flat srcset).
    gallerySrcSet: Array.isArray(product.gallery) ? product.gallerySrcSet : undefined,
    link: product.link,
    productType: product.productType,
    buttonLabel: product.buttonLabel,
    usingVariant: product.usingVariant,
    default_price: product.default_price,
    quantityOptions: product.quantityOptions,
    quantityUnit: product.quantityUnit,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    // Public-sale DISPLAY fields (plan §5). Display only — Stripe applies the
    // authoritative discount at checkout. Absent ⇒ detail price renders as before.
    salePercent: product.salePercent,
    saleAmount: product.saleAmount,
    saleStart: product.saleStart,
    saleEnd: product.saleEnd,
  };
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
