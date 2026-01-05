import { Product, ProductVariantKey, Variantable } from "@/types/Products";

export const getProductKey = (p: Product) => p?._id;

const  isVariantMap = (v: unknown): v is Record<string, unknown> => {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const resolveVariant = (selectedVariant: string | null, product: Product) =>
    selectedVariant || product?.usingVariant?.values?.[0] || null;

export const resolveVariantableString = (
    value: Variantable<string> | undefined,
    variant: string | null
): string | undefined => {
    if (typeof value === "string") return value;

    if (value && typeof value === "object" && !Array.isArray(value)) {
        if (variant && typeof value[variant] === "string") return value[variant] as string;
        if (typeof value["default"] === "string") return value["default"] as string;
    }

    return undefined;
}

export const getSafeFieldValue = <K extends ProductVariantKey>(
    product: Product,
    key: K,
    selectedVariant: string | null
  ): string | undefined => {
    if (!product) return undefined;

    const raw = product[key];

    const selectedOk =
      !!selectedVariant &&
      Array.isArray(product.usingVariant?.values) &&
      product.usingVariant.values.includes(selectedVariant);

    if (selectedOk && isVariantMap(raw)) {
      const v = raw[selectedVariant];
      return typeof v === "string" ? v : undefined;
    }

    return typeof raw === "string" ? raw : undefined;
};