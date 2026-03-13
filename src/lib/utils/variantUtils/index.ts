import type { Product, ProductVariantKey, Variantable } from "@/types/Products";

export function getProductKey(product: Product): string {
  return product._id;
}

export function isVariantMap(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function resolveVariant(
  selectedVariant: string | null,
  product: Product
): string | null {
  if (selectedVariant) return selectedVariant;
  if (product.usingVariant?.values?.length) {
    return product.usingVariant.values[0];
  }
  return null;
}

export function resolveVariantableString(
  value: Variantable<string> | undefined,
  variant: string | null
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (isVariantMap(value)) {
    if (variant && variant in value) return String(value[variant]);
    if ("default" in value) return String(value["default"]);
    const keys = Object.keys(value);
    return keys.length > 0 ? String(value[keys[0]]) : undefined;
  }
  return undefined;
}

export function getSafeFieldValue(
  product: Product,
  key: ProductVariantKey,
  selectedVariant: string | null
): string | undefined {
  const value = product[key] as Variantable<string> | undefined;
  if (value === undefined) return undefined;

  const variant = resolveVariant(selectedVariant, product);

  // If product has variants, validate the variant exists
  if (product.usingVariant?.values?.length && variant) {
    if (!product.usingVariant.values.includes(variant)) {
      return resolveVariantableString(value, null);
    }
  }

  return resolveVariantableString(value, variant);
}
