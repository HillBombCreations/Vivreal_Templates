import { CartItem, FloatingCartDialog, HandleCheckoutProps } from "@/types/Cart";
import { resolveVariant, resolveVariantableString } from "@/lib/variantUtils";

const resolvePriceId = (item: CartItem) => {
    return typeof item?.priceID === "object" && item?.variant ? item.priceID[item.variant] : item?.priceID;
};

export const handleAddToCart = (props: FloatingCartDialog) => {
    const {
        product,
        selectedVariant,
        quantity,
        cart,
        setCart,
        setAddedOpen
    } = props;
    if (!product) return;

    const variant = resolveVariant(selectedVariant, product);
    const safeVariant = variant ?? "default";
    const cartKey = `${product._id}_${safeVariant}`;
    const siteLogo = "/heroImage.png"
    const name = resolveVariantableString(product.name, variant) ?? product._id;

    const price = resolveVariantableString(product.price, variant) ?? "";
    const priceID = resolveVariantableString(product.default_price, variant) ?? ""; 

    const imageUrl =
      resolveVariantableString(product.imageUrl, variant) ?? siteLogo;

    const next = { ...(cart ?? {}) };

    const itemAdded: CartItem = {
      _id: product._id,
      quantity,
      name,
      price,
      priceID,
      imageUrl,
      variant: safeVariant,
    };

    if (next[cartKey]) next[cartKey].quantity += quantity;
    else next[cartKey] = itemAdded;

    setCart(next);
    setAddedOpen(true);
};

export const handleCheckout = async ({ itemsArray, businessInfo, originUrl, setOpenCartMenu, setLoadingCheckout }: HandleCheckoutProps) => {
    if (!itemsArray.length) return;

    setLoadingCheckout(true);
    try {
      const products = itemsArray.map((item: CartItem) => ({
        price: resolvePriceId(item),
        quantity: item.quantity,
        name: item.name,
      }));

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          products: products,
          requiresShipping: !!businessInfo?.shipping,
          originUrl: originUrl
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await res.json();
      if (data && !(data?.status && data.status === 400)) {
        setOpenCartMenu(false);
        window.location.replace(data.url);
      }
    } catch (e) {
      console.error("[CartDialog] checkout error:", e);
    } finally {
      setLoadingCheckout(false);
    }
};