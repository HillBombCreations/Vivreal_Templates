import type { Cart, CartItem } from "@/types/Cart";
import type { Product } from "@/types/Products";
import { resolveVariant, getSafeFieldValue } from "../variantUtils";
import type { Dispatch, SetStateAction } from "react";

interface AddToCartProps {
  product: Product;
  selectedVariant: string | null;
  quantity: number;
  cart: Cart;
  setCart: Dispatch<SetStateAction<Cart>>;
}

export function handleAddToCart({
  product,
  selectedVariant,
  quantity,
  cart,
  setCart,
}: AddToCartProps): void {
  const variant = resolveVariant(selectedVariant, product) ?? "default";
  const cartKey = `${product._id}_${variant}`;
  const name = getSafeFieldValue(product, "name", selectedVariant) ?? "";
  const price = getSafeFieldValue(product, "price", selectedVariant) ?? "";
  const imageUrl = getSafeFieldValue(product, "imageUrl", selectedVariant) ?? "";
  const priceID = product.default_price ?? "";

  const existing = cart[cartKey];
  const newQty = existing ? existing.quantity + quantity : quantity;

  const item: CartItem = {
    _id: product._id,
    quantity: newQty,
    name,
    price,
    priceID,
    imageUrl,
    variant,
  };

  setCart((prev) => ({ ...prev, [cartKey]: item }));
}

interface CheckoutProps {
  cart: Cart;
  requiresShipping: boolean;
  originUrl: string;
}

export async function handleCheckout({
  cart,
  requiresShipping,
  originUrl,
}: CheckoutProps): Promise<void> {
  const products = Object.values(cart).map((item) => ({
    price: item.priceID,
    quantity: item.quantity,
    name: item.name,
  }));

  if (products.length === 0) return;

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products, requiresShipping, originUrl }),
  });

  const data = await res.json();
  if (data.url) {
    window.location.replace(data.url);
  }
}
